import {
  and,
  asc,
  enrollments,
  eq,
  gte,
  inArray,
  isNotNull,
  mailboxes,
  messages,
  sequenceMailboxes,
  sequenceSteps,
  sequences,
  sql,
  suppressions,
  tableRows,
  type Db,
  type MailboxAssignment,
  type SequenceStatus,
  type SQL,
} from "@meerko/db";
import { rampState } from "./sending/ramp.ts";
import { isValidTimezone } from "./sending/window.ts";
import { getTable, NotFoundError } from "./tables.ts";
import { renderTemplate, templateVars } from "./template.ts";

export class SequenceError extends Error {}

export interface StepInput {
  subject?: string | null;
  body: string;
  delayDays?: number;
}

export interface SequenceInput {
  tableId: string;
  /** The pool: every lead gets one of these mailboxes and keeps it for all steps. */
  mailboxIds: string[];
  /** How new leads are spread: most free capacity first (default), or the same number each. */
  assignment?: MailboxAssignment;
  name: string;
  steps: StepInput[];
  timezone?: string;
  windowStartHour?: number;
  windowEndHour?: number;
}

const MAX_POOL = 50;
const DAY_MS = 24 * 60 * 60_000;

function validate(input: Partial<SequenceInput>) {
  if (input.mailboxIds) {
    if (input.mailboxIds.length === 0) throw new SequenceError("A sequence needs at least one mailbox");
    if (input.mailboxIds.length > MAX_POOL) throw new SequenceError(`A sequence can send from at most ${MAX_POOL} mailboxes`);
  }
  if (input.steps) {
    if (input.steps.length === 0) throw new SequenceError("A sequence needs at least one step");
    if (!input.steps[0]!.subject?.trim()) throw new SequenceError("The first step needs a subject");
    if (input.steps.some((s) => !s.body.trim())) throw new SequenceError("Every step needs a body");
  }
  if (input.timezone && !isValidTimezone(input.timezone)) throw new SequenceError(`Unknown timezone "${input.timezone}"`);
  const start = input.windowStartHour ?? 9;
  const end = input.windowEndHour ?? 17;
  if (start < 0 || end > 24 || start >= end) throw new SequenceError("The send window must satisfy 0 <= start < end <= 24");
}

const stepRows = (sequenceId: string, steps: StepInput[]) =>
  steps.map((s, position) => ({
    sequenceId,
    position,
    delayDays: position === 0 ? 0 : (s.delayDays ?? 3),
    // Follow-ups reply in the thread, so their subject is ignored.
    subject: position === 0 ? s.subject!.trim() : null,
    body: s.body,
  }));

async function assertMailboxes(db: Db, workspaceId: string, mailboxIds: string[]) {
  const ids = [...new Set(mailboxIds)];
  const found = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), inArray(mailboxes.id, ids)));
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (missing.length) throw new NotFoundError(`Mailbox ${missing.join(", ")} not found`);
  return ids;
}

async function poolOf(db: Db, sequenceId: string) {
  const rows = await db.select({ id: sequenceMailboxes.mailboxId }).from(sequenceMailboxes).where(eq(sequenceMailboxes.sequenceId, sequenceId));
  return rows.map((r) => r.id);
}

export async function createSequence(db: Db, workspaceId: string, input: SequenceInput) {
  validate(input);
  await getTable(db, workspaceId, input.tableId);
  const pool = await assertMailboxes(db, workspaceId, input.mailboxIds);
  const seq = await db.transaction(async (tx) => {
    const [seq] = await tx
      .insert(sequences)
      .values({
        workspaceId,
        tableId: input.tableId,
        assignment: input.assignment,
        name: input.name,
        timezone: input.timezone,
        windowStartHour: input.windowStartHour,
        windowEndHour: input.windowEndHour,
      })
      .returning();
    await tx.insert(sequenceSteps).values(stepRows(seq!.id, input.steps));
    await tx.insert(sequenceMailboxes).values(pool.map((mailboxId) => ({ sequenceId: seq!.id, mailboxId })));
    return seq!;
  });
  return { ...seq, mailboxIds: pool };
}

export async function getSequence(db: Db, workspaceId: string, id: string) {
  const [seq] = await db
    .select()
    .from(sequences)
    .where(and(eq(sequences.workspaceId, workspaceId), eq(sequences.id, id)));
  if (!seq) throw new NotFoundError(`Sequence ${id} not found`);
  const [steps, mailboxIds] = await Promise.all([
    db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, id)).orderBy(asc(sequenceSteps.position)),
    poolOf(db, id),
  ]);
  return { ...seq, mailboxIds, steps };
}

export function listSequences(db: Db, workspaceId: string) {
  return db
    .select({
      id: sequences.id,
      name: sequences.name,
      status: sequences.status,
      tableId: sequences.tableId,
      assignment: sequences.assignment,
      mailboxIds: sql<string[]>`coalesce((select array_agg(${sequenceMailboxes}.mailbox_id) from ${sequenceMailboxes} where ${sequenceMailboxes}.sequence_id = ${sequences}.id), '{}')`,
      // Qualified by hand: in a select without joins, drizzle renders columns unqualified, so "id" would bind to enrollments.
      enrolled: sql<number>`(select count(*)::int from ${enrollments} where ${enrollments}.sequence_id = ${sequences}.id)`,
      createdAt: sequences.createdAt,
    })
    .from(sequences)
    .where(eq(sequences.workspaceId, workspaceId))
    .orderBy(sequences.createdAt);
}

/** Edits a sequence. Steps can't change while it's active, so in-flight emails stay consistent. */
export async function updateSequence(db: Db, workspaceId: string, id: string, input: Partial<Omit<SequenceInput, "tableId">>) {
  const seq = await getSequence(db, workspaceId, id);
  validate({ ...input, windowStartHour: input.windowStartHour ?? seq.windowStartHour, windowEndHour: input.windowEndHour ?? seq.windowEndHour });
  if (input.steps && seq.status === "active") throw new SequenceError("Pause the sequence before changing its steps");
  const pool = input.mailboxIds ? await assertMailboxes(db, workspaceId, input.mailboxIds) : null;
  await db.transaction(async (tx) => {
    const { steps, mailboxIds: _, ...fields } = input;
    if (Object.keys(fields).length) await tx.update(sequences).set(fields).where(eq(sequences.id, id));
    if (steps) {
      await tx.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, id));
      await tx.insert(sequenceSteps).values(stepRows(id, steps));
    }
    if (pool) {
      await tx.delete(sequenceMailboxes).where(eq(sequenceMailboxes.sequenceId, id));
      await tx.insert(sequenceMailboxes).values(pool.map((mailboxId) => ({ sequenceId: id, mailboxId })));
    }
  });
  // Leads not emailed yet move off mailboxes that left the pool; leads mid-thread stay on theirs.
  if (pool) await reassignUnsent(db, workspaceId, id);
  return getSequence(db, workspaceId, id);
}

/**
 * Deletes a sequence with its steps, enrollments and pool. Replies it got stay in the inbox. Refuses while it's
 * sending, so an agent can't stop a live campaign by accident: pause it first.
 */
export async function deleteSequence(db: Db, workspaceId: string, id: string) {
  const seq = await getSequence(db, workspaceId, id);
  if (seq.status === "active") throw new SequenceError(`Pause "${seq.name}" first: it's still sending.`);
  await db.delete(sequences).where(and(eq(sequences.workspaceId, workspaceId), eq(sequences.id, id)));
  return { deleted: true };
}

export async function setSequenceStatus(db: Db, workspaceId: string, id: string, status: Exclude<SequenceStatus, "draft">) {
  const seq = await getSequence(db, workspaceId, id);
  if (status === "active") {
    const pool = seq.mailboxIds.length ? await db.select({ status: mailboxes.status }).from(mailboxes).where(inArray(mailboxes.id, seq.mailboxIds)) : [];
    if (!pool.some((m) => m.status === "active")) {
      throw new SequenceError("None of the sequence's mailboxes can send; reconnect one with `meerko mailboxes connect`");
    }
  }
  await db.update(sequences).set({ status }).where(eq(sequences.id, id));
  return { ...seq, status };
}

/** Variables used across all steps' subjects and bodies. */
const stepVars = (steps: { subject: string | null; body: string }[]) =>
  [...new Set(steps.flatMap((s) => templateVars(`${s.subject ?? ""}\n${s.body}`)))];

const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** Renders every step for one row (the first row by default), and reports variables the row is missing. */
export async function previewSequence(db: Db, workspaceId: string, id: string, rowId?: string) {
  const seq = await getSequence(db, workspaceId, id);
  const [row] = await db
    .select({ id: tableRows.id, data: tableRows.data })
    .from(tableRows)
    .where(rowId ? and(eq(tableRows.tableId, seq.tableId), eq(tableRows.id, rowId)) : eq(tableRows.tableId, seq.tableId))
    .orderBy(tableRows.seq)
    .limit(1);
  if (!row) throw new NotFoundError(rowId ? `Row ${rowId} not found in this sequence's table` : "The sequence's table has no rows");
  const firstSubject = seq.steps[0]?.subject ?? "";
  return {
    rowId: row.id,
    to: row.data.email ?? null,
    missingVars: stepVars(seq.steps).filter((v) => isBlank(row.data[v])),
    steps: seq.steps.map((s) => ({
      position: s.position,
      delayDays: s.delayDays,
      subject: s.position === 0 ? renderTemplate(firstSubject, row.data) : `Re: ${renderTemplate(firstSubject, row.data)}`,
      body: renderTemplate(s.body, row.data),
    })),
  };
}

export type SkipReason = "no_email" | "undeliverable" | "suppressed" | "missing_vars" | "already_enrolled";

/**
 * Enrolls rows from the sequence's table. Rows are skipped, with a reason, when emailing them would be
 * unsafe or broken: no address, an address known to bounce, a suppressed address, or a template
 * variable the row can't fill (no "Hi ," emails).
 */
export async function enrollRows(
  db: Db,
  workspaceId: string,
  id: string,
  opts: { rowIds?: string[]; filter?: Record<string, unknown>; limit?: number; now?: Date } = {},
) {
  const seq = await getSequence(db, workspaceId, id);
  const vars = stepVars(seq.steps);

  const conds: SQL[] = [eq(tableRows.tableId, seq.tableId)];
  if (opts.rowIds?.length) conds.push(sql`${tableRows.id} in ${opts.rowIds}`);
  if (opts.filter && Object.keys(opts.filter).length) conds.push(sql`${tableRows.data} @> ${JSON.stringify(opts.filter)}::jsonb`);
  const rows = await db
    .select({ id: tableRows.id, data: tableRows.data })
    .from(tableRows)
    .where(and(...conds))
    .orderBy(tableRows.seq)
    .limit(Math.min(opts.limit ?? 1000, 5000));

  const [suppressed, existing] = await Promise.all([
    db.select({ email: suppressions.email }).from(suppressions).where(eq(suppressions.workspaceId, workspaceId)),
    db.select({ rowId: enrollments.rowId }).from(enrollments).where(eq(enrollments.sequenceId, id)),
  ]);
  const suppressedSet = new Set(suppressed.map((s) => s.email));
  const enrolledSet = new Set(existing.map((e) => e.rowId));

  const skipped: Record<SkipReason, number> = { no_email: 0, undeliverable: 0, suppressed: 0, missing_vars: 0, already_enrolled: 0 };
  const toInsert: { sequenceId: string; rowId: string; email: string; nextSendAt: Date; mailboxId?: string }[] = [];
  const now = opts.now ?? new Date();
  for (const row of rows) {
    const email = typeof row.data.email === "string" ? row.data.email.trim().toLowerCase() : "";
    if (enrolledSet.has(row.id)) skipped.already_enrolled++;
    else if (!email.includes("@")) skipped.no_email++;
    else if (row.data.email_verification === "undeliverable") skipped.undeliverable++;
    else if (suppressedSet.has(email)) skipped.suppressed++;
    else if (vars.some((v) => isBlank(row.data[v]))) skipped.missing_vars++;
    else toInsert.push({ sequenceId: id, rowId: row.id, email, nextSendAt: now });
  }
  if (toInsert.length) {
    const assigned = await assignMailboxes(db, seq, toInsert.length, now);
    toInsert.forEach((e, i) => (e.mailboxId = assigned[i]));
    await db.insert(enrollments).values(toInsert).onConflictDoNothing();
  }
  const byMailbox: Record<string, number> = {};
  for (const e of toInsert) byMailbox[e.mailboxId!] = (byMailbox[e.mailboxId!] ?? 0) + 1;
  return { enrolled: toInsert.length, skipped, byMailbox };
}

/**
 * Picks a mailbox from the sequence's pool for each of `count` new leads. "capacity" puts each lead on the
 * mailbox with the least work per email it may send today (so a ramping inbox gets fewer); "even" gives each
 * the same number. Mailboxes that lost access are skipped.
 */
export async function assignMailboxes(db: Db, seq: { id: string; assignment: MailboxAssignment; mailboxIds: string[] }, count: number, now = new Date()) {
  if (seq.mailboxIds.length === 0) throw new SequenceError("The sequence has no mailboxes to send from");
  const pool = await db
    .select({ id: mailboxes.id, status: mailboxes.status, heldAt: mailboxes.heldAt, dailyLimit: mailboxes.dailyLimit, rampStartedAt: mailboxes.rampStartedAt })
    .from(mailboxes)
    .where(inArray(mailboxes.id, seq.mailboxIds));
  // A mailbox on hold (too many bounces or spam rejections) takes no new leads until a person resumes it.
  const usable = pool.filter((m) => m.status === "active" && !m.heldAt);
  if (usable.length === 0) throw new SequenceError("None of the sequence's mailboxes can send: reconnect one with `meerko mailboxes connect`, or resume one that Meerko put on hold");
  // Current load: leads still being emailed, from this sequence ("even") or from any sequence ("capacity").
  const load = await db
    .select({ mailboxId: enrollments.mailboxId, n: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.state, "active"),
        inArray(enrollments.mailboxId, usable.map((m) => m.id)),
        ...(seq.assignment === "even" ? [eq(enrollments.sequenceId, seq.id)] : []),
      ),
    )
    .groupBy(enrollments.mailboxId);
  const counts = new Map(usable.map((m) => [m.id, load.find((l) => l.mailboxId === m.id)?.n ?? 0]));
  const weight = new Map(usable.map((m) => [m.id, seq.assignment === "even" ? 1 : rampState(m, now).effectiveLimit]));
  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    let best = usable[0]!.id;
    for (const m of usable) {
      if (counts.get(m.id)! / weight.get(m.id)! < counts.get(best)! / weight.get(best)!) best = m.id;
    }
    picks.push(best);
    counts.set(best, counts.get(best)! + 1);
  }
  return picks;
}

/**
 * Moves leads that haven't been emailed yet off mailboxes that are no longer in their sequence's pool (or
 * were deleted). Leads already mid-thread can't switch mailbox, so if theirs is gone they stop.
 */
export async function reassignUnsent(db: Db, workspaceId?: string, sequenceId?: string, now = new Date()) {
  const orphans = await db
    .select({ id: enrollments.id, sequenceId: enrollments.sequenceId, nextStep: enrollments.nextStep })
    .from(enrollments)
    .innerJoin(sequences, eq(enrollments.sequenceId, sequences.id))
    .where(
      and(
        eq(enrollments.state, "active"),
        ...(workspaceId ? [eq(sequences.workspaceId, workspaceId)] : []),
        ...(sequenceId ? [eq(enrollments.sequenceId, sequenceId)] : []),
        sql`(${enrollments.mailboxId} is null or not exists (select 1 from ${sequenceMailboxes} sm where sm.sequence_id = ${enrollments.sequenceId} and sm.mailbox_id = ${enrollments.mailboxId}))`,
      ),
    );
  if (orphans.length === 0) return { moved: 0, stopped: 0 };
  const midThread = orphans.filter((o) => o.nextStep > 0);
  if (midThread.length) {
    await db
      .update(enrollments)
      .set({ state: "stopped", nextSendAt: null, lastError: "Its mailbox left the sequence, and follow-ups must come from the same mailbox" })
      .where(inArray(enrollments.id, midThread.map((o) => o.id)));
  }
  let moved = 0;
  const unsent = orphans.filter((o) => o.nextStep === 0);
  for (const seqId of new Set(unsent.map((o) => o.sequenceId))) {
    const [seq] = await db.select({ id: sequences.id, assignment: sequences.assignment }).from(sequences).where(eq(sequences.id, seqId));
    const ids = unsent.filter((o) => o.sequenceId === seqId).map((o) => o.id);
    let picks: string[];
    try {
      picks = await assignMailboxes(db, { ...seq!, mailboxIds: await poolOf(db, seqId) }, ids.length, now);
    } catch {
      continue; // No usable mailbox right now; they wait.
    }
    for (const [i, id] of ids.entries()) await db.update(enrollments).set({ mailboxId: picks[i] }).where(eq(enrollments.id, id));
    moved += ids.length;
  }
  return { moved, stopped: midThread.length };
}

/** The sequence's mailboxes with today's sending and how many of its leads each one has, for the pool panel. */
export async function sequencePool(db: Db, workspaceId: string, id: string, now = new Date()) {
  const seq = await getSequence(db, workspaceId, id);
  if (seq.mailboxIds.length === 0) return { assignment: seq.assignment, sentToday: 0, capacityToday: 0, mailboxes: [] };
  const since = new Date(now.getTime() - DAY_MS);
  const [rows, sent, leads] = await Promise.all([
    db
      .select({ id: mailboxes.id, email: mailboxes.email, displayName: mailboxes.displayName, status: mailboxes.status, heldAt: mailboxes.heldAt, dailyLimit: mailboxes.dailyLimit, rampStartedAt: mailboxes.rampStartedAt })
      .from(mailboxes)
      .where(inArray(mailboxes.id, seq.mailboxIds))
      .orderBy(mailboxes.email),
    db
      .select({ mailboxId: messages.mailboxId, n: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(inArray(messages.mailboxId, seq.mailboxIds), eq(messages.direction, "out"), gte(messages.sentAt, since)))
      .groupBy(messages.mailboxId),
    db
      .select({ mailboxId: enrollments.mailboxId, n: sql<number>`count(*)::int` })
      .from(enrollments)
      .where(and(eq(enrollments.sequenceId, id), isNotNull(enrollments.mailboxId)))
      .groupBy(enrollments.mailboxId),
  ]);
  const list = rows.map((m) => {
    const ramp = rampState(m, now);
    return {
      id: m.id,
      email: m.email,
      displayName: m.displayName,
      status: m.status,
      held: m.heldAt !== null,
      dailyLimit: m.dailyLimit,
      effectiveLimit: ramp.effectiveLimit,
      rampDay: ramp.rampDay,
      sentToday: sent.find((s) => s.mailboxId === m.id)?.n ?? 0,
      leads: leads.find((l) => l.mailboxId === m.id)?.n ?? 0,
    };
  });
  return {
    assignment: seq.assignment,
    sentToday: list.reduce((n, m) => n + m.sentToday, 0),
    capacityToday: list.filter((m) => m.status === "active" && !m.held).reduce((n, m) => n + m.effectiveLimit, 0),
    mailboxes: list,
  };
}

export async function sequenceStats(db: Db, workspaceId: string, id: string) {
  const seq = await getSequence(db, workspaceId, id);
  const byState = await db
    .select({ state: enrollments.state, n: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(eq(enrollments.sequenceId, id))
    .groupBy(enrollments.state);
  const [sent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(enrollments, eq(messages.enrollmentId, enrollments.id))
    // Sequence emails only: approved reply drafts are outbound too, but have no step.
    .where(and(eq(enrollments.sequenceId, id), eq(messages.direction, "out"), isNotNull(messages.step)));
  // Per step: how many got it, and how many answered after it (their last email was this step).
  const sentByStep = await db
    .select({ step: messages.step, n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(enrollments, eq(messages.enrollmentId, enrollments.id))
    .where(and(eq(enrollments.sequenceId, id), eq(messages.direction, "out")))
    .groupBy(messages.step);
  const repliedByStep = await db
    .select({ next: enrollments.nextStep, n: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(and(eq(enrollments.sequenceId, id), eq(enrollments.state, "replied")))
    .groupBy(enrollments.nextStep);
  const states = Object.fromEntries(byState.map((r) => [r.state, r.n]));
  const enrolled = byState.reduce((n, r) => n + r.n, 0);
  return {
    id,
    name: seq.name,
    status: seq.status,
    enrolled,
    /** People who will still get emails: enrolled, not finished, not stopped. */
    remaining: states.active ?? 0,
    emailsSent: sent?.n ?? 0,
    states,
    replyRate: enrolled ? Math.round(((states.replied ?? 0) / enrolled) * 1000) / 10 : 0,
    steps: seq.steps.map((s) => ({
      position: s.position,
      sent: sentByStep.find((r) => r.step === s.position)?.n ?? 0,
      repliedAfter: repliedByStep.find((r) => r.next === s.position + 1)?.n ?? 0,
    })),
  };
}

/** Everyone in a sequence and where they stand, newest activity first. */
export async function listSequenceRecipients(db: Db, workspaceId: string, id: string, limit = 200) {
  await getSequence(db, workspaceId, id);
  return db
    .select({
      enrollmentId: enrollments.id,
      rowId: enrollments.rowId,
      email: enrollments.email,
      firstName: sql<string | null>`${tableRows.data}->>'first_name'`,
      lastName: sql<string | null>`${tableRows.data}->>'last_name'`,
      company: sql<string | null>`${tableRows.data}->>'company'`,
      state: enrollments.state,
      /** Steps sent so far. */
      stepsSent: enrollments.nextStep,
      mailboxEmail: mailboxes.email,
      nextSendAt: enrollments.nextSendAt,
      lastError: enrollments.lastError,
      // to_json gives an ISO 8601 string, which every browser parses; the raw timestamptz text isn't.
      lastSentAt: sql<string | null>`to_json((select max(${messages.sentAt}) from ${messages} where ${messages.enrollmentId} = ${enrollments.id} and ${messages.direction} = 'out')) #>> '{}'`,
    })
    .from(enrollments)
    .innerJoin(tableRows, eq(enrollments.rowId, tableRows.id))
    .leftJoin(mailboxes, eq(enrollments.mailboxId, mailboxes.id))
    .where(eq(enrollments.sequenceId, id))
    .orderBy(sql`coalesce((select max(${messages.sentAt}) from ${messages} where ${messages.enrollmentId} = ${enrollments.id}), ${enrollments.createdAt}) desc`)
    .limit(Math.min(limit, 1000));
}

