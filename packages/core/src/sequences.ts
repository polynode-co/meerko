import {
  and,
  asc,
  enrollments,
  eq,
  mailboxes,
  messages,
  sequenceSteps,
  sequences,
  sql,
  suppressions,
  tableRows,
  type Db,
  type SequenceStatus,
  type SQL,
} from "@meerko/db";
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
  mailboxId: string;
  name: string;
  steps: StepInput[];
  timezone?: string;
  windowStartHour?: number;
  windowEndHour?: number;
}

function validate(input: Partial<SequenceInput>) {
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

async function assertMailbox(db: Db, workspaceId: string, mailboxId: string) {
  const [mb] = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, mailboxId)));
  if (!mb) throw new NotFoundError(`Mailbox ${mailboxId} not found`);
}

export async function createSequence(db: Db, workspaceId: string, input: SequenceInput) {
  validate(input);
  await getTable(db, workspaceId, input.tableId);
  await assertMailbox(db, workspaceId, input.mailboxId);
  return db.transaction(async (tx) => {
    const [seq] = await tx
      .insert(sequences)
      .values({
        workspaceId,
        tableId: input.tableId,
        mailboxId: input.mailboxId,
        name: input.name,
        timezone: input.timezone,
        windowStartHour: input.windowStartHour,
        windowEndHour: input.windowEndHour,
      })
      .returning();
    await tx.insert(sequenceSteps).values(stepRows(seq!.id, input.steps));
    return seq!;
  });
}

export async function getSequence(db: Db, workspaceId: string, id: string) {
  const [seq] = await db
    .select()
    .from(sequences)
    .where(and(eq(sequences.workspaceId, workspaceId), eq(sequences.id, id)));
  if (!seq) throw new NotFoundError(`Sequence ${id} not found`);
  const steps = await db.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, id)).orderBy(asc(sequenceSteps.position));
  return { ...seq, steps };
}

export function listSequences(db: Db, workspaceId: string) {
  return db
    .select({
      id: sequences.id,
      name: sequences.name,
      status: sequences.status,
      tableId: sequences.tableId,
      mailboxId: sequences.mailboxId,
      enrolled: sql<number>`(select count(*)::int from ${enrollments} where ${enrollments.sequenceId} = ${sequences.id})`,
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
  if (input.mailboxId) await assertMailbox(db, workspaceId, input.mailboxId);
  await db.transaction(async (tx) => {
    const { steps, ...fields } = input;
    if (Object.keys(fields).length) await tx.update(sequences).set(fields).where(eq(sequences.id, id));
    if (steps) {
      await tx.delete(sequenceSteps).where(eq(sequenceSteps.sequenceId, id));
      await tx.insert(sequenceSteps).values(stepRows(id, steps));
    }
  });
  return getSequence(db, workspaceId, id);
}

export async function setSequenceStatus(db: Db, workspaceId: string, id: string, status: Exclude<SequenceStatus, "draft">) {
  const seq = await getSequence(db, workspaceId, id);
  if (status === "active") {
    const [mb] = await db.select({ status: mailboxes.status }).from(mailboxes).where(eq(mailboxes.id, seq.mailboxId));
    if (mb?.status !== "active") throw new SequenceError("The sequence's mailbox lost access; reconnect it with `meerko mailboxes connect`");
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
  const toInsert: { sequenceId: string; rowId: string; email: string; nextSendAt: Date }[] = [];
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
  if (toInsert.length) await db.insert(enrollments).values(toInsert).onConflictDoNothing();
  return { enrolled: toInsert.length, skipped };
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
    .where(and(eq(enrollments.sequenceId, id), eq(messages.direction, "out")));
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
      nextSendAt: enrollments.nextSendAt,
      lastError: enrollments.lastError,
      // to_json gives an ISO 8601 string, which every browser parses; the raw timestamptz text isn't.
      lastSentAt: sql<string | null>`to_json((select max(${messages.sentAt}) from ${messages} where ${messages.enrollmentId} = ${enrollments.id} and ${messages.direction} = 'out')) #>> '{}'`,
    })
    .from(enrollments)
    .innerJoin(tableRows, eq(enrollments.rowId, tableRows.id))
    .where(eq(enrollments.sequenceId, id))
    .orderBy(sql`coalesce((select max(${messages.sentAt}) from ${messages} where ${messages.enrollmentId} = ${enrollments.id}), ${enrollments.createdAt}) desc`)
    .limit(Math.min(limit, 1000));
}

