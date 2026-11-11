import type { MicrosoftOAuth } from "../mail/outlook.ts";
import {
  and,
  asc,
  desc,
  enrollments,
  eq,
  isNotNull,
  isNull,
  mailboxes,
  messages,
  replyDrafts,
  sequences,
  sequenceSteps,
  sql,
  suppressions,
  tableRows,
  type Db,
  type SQL,
} from "@meerko/db";
import { mailClient, type MailClient } from "../mail/client.ts";
import { GmailError, type GmailMessage, type GoogleOAuth } from "../mail/gmail.ts";
import type { ImapConnectors } from "../mail/imap-common.ts";
import { addressOf, bodyText, header, stripQuoted } from "../mail/parse.ts";
import { markMailboxError } from "../mailboxes.ts";
import { EncryptionNotConfiguredError, type SecretBox } from "../provider-keys.ts";
import { advanceStage } from "../pipeline.ts";
import { unsubscribe } from "../sending/sender.ts";
import { NotFoundError } from "../tables.ts";
import { AGENT_INTENTS, classifyByRules, type AgentIntent, type RuleIntent } from "./classify.ts";

/** Re-scan this much before the last check, so mail delivered late isn't missed. Duplicates are ignored. */
const OVERLAP_MS = 60 * 60_000;
/** Only threads with an email sent in this window are watched. */
const WATCH_DAYS = 60;

export interface ReplyDeps {
  box: SecretBox | null;
  oauth?: GoogleOAuth;
  now?: () => Date;
  fetch?: typeof fetch;
  imap?: ImapConnectors;
  microsoft?: MicrosoftOAuth;
}

export interface ReplyTickResult {
  scanned: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
  outOfOffice: number;
}

interface Watched {
  enrollmentId: string;
  workspaceId: string;
  email: string;
  originalSubject: string;
}

/**
 * Scans each connected inbox for new mail in Meerko threads (or from enrolled addresses), stores those
 * messages, and acts on them: a reply stops the person's sequences, a bounce or unsubscribe request
 * suppresses the address, and an out-of-office is recorded without stopping anything.
 * Mail unrelated to a sequence is never fetched in full or stored.
 */
export async function runReplyTick(db: Db, deps: ReplyDeps): Promise<ReplyTickResult> {
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const now = (deps.now ?? (() => new Date()))();
  const result: ReplyTickResult = { scanned: 0, replies: 0, bounces: 0, unsubscribes: 0, outOfOffice: 0 };
  const watchFrom = new Date(now.getTime() - WATCH_DAYS * 24 * 60 * 60_000).toISOString();

  const boxes = await db.select().from(mailboxes).where(eq(mailboxes.status, "active"));
  for (const mb of boxes) {
    let client: MailClient | undefined;
    // Opened only when the mailbox has something to check.
    const open = () => (client ??= mailClient(mb, { box: deps.box!, oauth: deps.oauth, microsoft: deps.microsoft, fetch: deps.fetch, imap: deps.imap, db }));
    try {
      await scanMailbox(db, mb, open, now, watchFrom, result);
    } catch (err) {
      if (err instanceof GmailError && err.needsReconnect) await markMailboxError(db, mb.id, err.message);
      else throw err;
    } finally {
      await client?.close();
    }
  }
  return result;
}

type MailboxRow = typeof mailboxes.$inferSelect;

async function scanMailbox(db: Db, mb: MailboxRow, open: () => MailClient, now: Date, watchFrom: string, result: ReplyTickResult) {
  await fillMissingThreadIds(db, mb.id, open, watchFrom);
  // Threads this mailbox started for a sequence, with the first step's subject.
  const watched = await db
    .selectDistinctOn([enrollments.id], {
      enrollmentId: enrollments.id,
      workspaceId: sequences.workspaceId,
      email: enrollments.email,
      threadId: enrollments.gmailThreadId,
      messageIds: enrollments.messageIds,
      originalSubject: sequenceSteps.subject,
      firstSentAt: sql<string>`(select min(${messages.sentAt}) from ${messages} where ${messages.enrollmentId} = ${enrollments.id})`,
    })
    .from(enrollments)
    .innerJoin(sequences, eq(enrollments.sequenceId, sequences.id))
    .innerJoin(sequenceSteps, and(eq(sequenceSteps.sequenceId, sequences.id), eq(sequenceSteps.position, 0)))
    .where(
      and(
        // The mailbox this lead was emailed from (rotation spreads a sequence over several).
        eq(enrollments.mailboxId, mb.id),
        isNotNull(enrollments.gmailThreadId),
        sql`exists (select 1 from ${messages} where ${messages.enrollmentId} = ${enrollments.id} and ${messages.sentAt} >= ${watchFrom})`,
      ),
    );
  if (watched.length === 0) return;

  const byThread = new Map<string, Watched>();
  const byEmail = new Map<string, Watched>();
  for (const w of watched) {
    const entry = { enrollmentId: w.enrollmentId, workspaceId: w.workspaceId, email: w.email, originalSubject: w.originalSubject ?? "" };
    byThread.set(w.threadId!, entry);
    // Generic IMAP replies are matched by the Message-IDs they answer.
    for (const id of w.messageIds) byThread.set(id, entry);
    byEmail.set(w.email, entry);
  }

  const earliest = Math.min(...watched.map((w) => Date.parse(w.firstSentAt)));
  const since = Math.max(earliest, (mb.repliesCheckedAt?.getTime() ?? earliest) - OVERLAP_MS);

  const client = open();
  const ids = await client.listInbound(new Date(since));
  const known = new Set(
    (
      await db
        .select({ gmailId: messages.gmailId })
        .from(messages)
        .where(and(eq(messages.mailboxId, mb.id), sql`${messages.gmailId} in ${ids.length ? ids.map((i) => i.id) : [""]}`))
    ).map((m) => m.gmailId),
  );

  for (const { id, threadId, refs } of ids) {
    if (known.has(id)) continue;
    result.scanned++;
    let target = byThread.get(threadId) ?? refs?.map((r) => byThread.get(r)).find(Boolean);
    if (!target) {
      // Not one of our threads: a cheap header-only fetch tells us if an enrolled person wrote in fresh.
      const meta = await client.getMessage(id, "metadata", ["From"]);
      target = byEmail.get(addressOf(header(meta, "From")));
      if (!target) continue;
    }
    const full = await client.getMessage(id, "full");
    const intent = await recordInbound(db, mb.id, mb.email, target, full);
    if (intent === undefined) continue;
    if (intent === "bounce") result.bounces++;
    else if (intent === "unsubscribe") result.unsubscribes++;
    else if (intent === "out_of_office") result.outOfOffice++;
    else result.replies++;
  }
  await db.update(mailboxes).set({ repliesCheckedAt: now }).where(eq(mailboxes.id, mb.id));
}

/**
 * Over IMAP a sent email's Gmail ids come from finding its copy, which can lag the send. Looks up the
 * ones still missing, so their threads are watched for replies.
 */
async function fillMissingThreadIds(db: Db, mailboxId: string, open: () => MailClient, watchFrom: string) {
  const missing = await db
    .select({ id: messages.id, enrollmentId: messages.enrollmentId, rfcMessageId: messages.rfcMessageId })
    .from(messages)
    .where(
      and(
        eq(messages.mailboxId, mailboxId),
        eq(messages.direction, "out"),
        isNull(messages.gmailThreadId),
        isNotNull(messages.rfcMessageId),
        sql`${messages.sentAt} >= ${watchFrom}`,
      ),
    );
  if (!missing.length) return;
  const client = open();
  if (!client.findByMessageId) return;
  for (const m of missing) {
    const found = await client.findByMessageId(m.rfcMessageId!);
    if (!found.id || !found.threadId) continue;
    await db.update(messages).set({ gmailId: found.id, gmailThreadId: found.threadId }).where(eq(messages.id, m.id));
    if (m.enrollmentId) {
      await db
        .update(enrollments)
        .set({ gmailThreadId: found.threadId })
        .where(and(eq(enrollments.id, m.enrollmentId), isNull(enrollments.gmailThreadId)));
    }
  }
}

/** Stores one inbound message and applies its effect. Returns undefined if it was already stored. */
async function recordInbound(db: Db, mailboxId: string, mailboxEmail: string, target: Watched, msg: GmailMessage) {
  const replyText = stripQuoted(bodyText(msg));
  const intent: RuleIntent | null = classifyByRules(msg, replyText, target.originalSubject);

  const inserted = await db
    .insert(messages)
    .values({
      workspaceId: target.workspaceId,
      mailboxId,
      enrollmentId: target.enrollmentId,
      direction: "in",
      gmailId: msg.id,
      gmailThreadId: msg.threadId,
      rfcMessageId: header(msg, "Message-ID") ?? null,
      fromEmail: addressOf(header(msg, "From")) || "unknown",
      toEmail: mailboxEmail,
      subject: header(msg, "Subject") ?? null,
      body: replyText || msg.snippet || "",
      intent,
      // Rule-handled messages need no human attention; real replies wait in the inbox.
      handledAt: intent ? new Date() : null,
      sentAt: msg.internalDate ? new Date(Number(msg.internalDate)) : new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: messages.id });
  if (inserted.length === 0) return undefined;

  if (intent === "bounce") {
    await db.transaction(async (tx) => {
      await tx.insert(suppressions).values({ workspaceId: target.workspaceId, email: target.email, reason: "bounced" }).onConflictDoNothing();
      await stopPerson(tx, target.workspaceId, target.email, "bounced");
    });
  } else if (intent === "unsubscribe") {
    await unsubscribe(db, target.workspaceId, target.email);
  } else if (intent === null) {
    // A human answered: stop every sequence to them in this workspace, finished ones included for stats,
    // and move their lead forward in the pipeline.
    await stopPerson(db, target.workspaceId, target.email, "replied", true);
    const [en] = await db.select({ rowId: enrollments.rowId }).from(enrollments).where(eq(enrollments.id, target.enrollmentId));
    if (en) await advanceStage(db, [en.rowId], "replied");
  }
  return intent;
}

async function stopPerson(
  db: Pick<Db, "update">,
  workspaceId: string,
  email: string,
  state: "replied" | "bounced",
  includeCompleted = false,
) {
  const states = includeCompleted ? sql`('active', 'completed')` : sql`('active')`;
  await db
    .update(enrollments)
    .set({ state, nextSendAt: null })
    .where(
      and(
        eq(enrollments.email, email),
        sql`${enrollments.state} in ${states}`,
        sql`${enrollments.sequenceId} in (select id from ${sequences} where ${sequences.workspaceId} = ${workspaceId})`,
      ),
    );
}

// ---------- Inbox for the user's agent ----------

export interface ListRepliesOptions {
  sequenceId?: string;
  intent?: string;
  /** Only replies no one has classified yet (the default). */
  unclassified?: boolean;
  /** Include out-of-office, bounces and unsubscribes (hidden by default). */
  includeAutomatic?: boolean;
  /**
   * What waits on the person: unclassified replies, plus unhandled ones with a draft to approve (an agent that
   * labels a reply and drafts an answer hasn't finished with it until someone sends or discards the draft).
   */
  needsYou?: boolean;
  limit?: number;
}

/** Inbound replies with the conversation so far and the prospect's row, for the agent to read and classify. */
export async function listReplies(db: Db, workspaceId: string, opts: ListRepliesOptions = {}) {
  const conds: SQL[] = [eq(messages.workspaceId, workspaceId), eq(messages.direction, "in")];
  if (opts.sequenceId) conds.push(eq(enrollments.sequenceId, opts.sequenceId));
  if (opts.intent) conds.push(eq(messages.intent, opts.intent));
  else if (opts.needsYou) {
    conds.push(
      sql`(${messages.intent} is null or (${messages.handledAt} is null and exists (select 1 from ${replyDrafts} where ${replyDrafts.replyId} = ${messages.id} and ${replyDrafts.status} = 'pending')))`,
    );
  } else if (opts.unclassified ?? true) conds.push(sql`${messages.intent} is null`);
  if (!opts.includeAutomatic && !opts.intent) conds.push(sql`coalesce(${messages.intent}, '') not in ('bounce', 'out_of_office', 'unsubscribe')`);

  const replies = await db
    .select({
      id: messages.id,
      from: messages.fromEmail,
      subject: messages.subject,
      body: messages.body,
      intent: messages.intent,
      receivedAt: messages.sentAt,
      handledAt: messages.handledAt,
      enrollmentId: messages.enrollmentId,
      sequenceId: enrollments.sequenceId,
      sequenceName: sequences.name,
      row: tableRows.data,
    })
    .from(messages)
    .leftJoin(enrollments, eq(messages.enrollmentId, enrollments.id))
    .leftJoin(sequences, eq(enrollments.sequenceId, sequences.id))
    .leftJoin(tableRows, eq(enrollments.rowId, tableRows.id))
    .where(and(...conds))
    .orderBy(desc(messages.sentAt))
    .limit(Math.min(opts.limit ?? 25, 100));

  const ids = replies.map((r) => r.enrollmentId).filter((v): v is string => !!v);
  const history = ids.length
    ? await db
        .select({
          enrollmentId: messages.enrollmentId,
          id: messages.id,
          direction: messages.direction,
          step: messages.step,
          subject: messages.subject,
          body: messages.body,
          sentAt: messages.sentAt,
        })
        .from(messages)
        .where(sql`${messages.enrollmentId} in ${ids}`)
        .orderBy(asc(messages.sentAt))
    : [];
  return replies.map((r) => ({
    ...r,
    thread: history.filter((h) => h.enrollmentId === r.enrollmentId).map(({ enrollmentId: _, ...h }) => h),
  }));
}

export class ReplyError extends Error {}

/** The user's agent sets a reply's intent; `handled` also takes it out of the inbox. */
export async function classifyReply(db: Db, workspaceId: string, messageId: string, intent: AgentIntent, handled = false) {
  if (!AGENT_INTENTS.includes(intent)) throw new ReplyError(`intent must be one of: ${AGENT_INTENTS.join(", ")}`);
  const [row] = await db
    .update(messages)
    .set({ intent, ...(handled ? { handledAt: new Date() } : {}) })
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId), eq(messages.direction, "in")))
    .returning({ id: messages.id, intent: messages.intent, handledAt: messages.handledAt });
  if (!row) throw new NotFoundError(`Reply ${messageId} not found`);
  return row;
}
