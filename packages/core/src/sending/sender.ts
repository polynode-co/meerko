import type { MicrosoftOAuth } from "../mail/outlook.ts";
import {
  and,
  asc,
  enrollments,
  eq,
  gte,
  isNull,
  lte,
  mailboxes,
  messages,
  sequenceSteps,
  sequences,
  sql,
  suppressions,
  or,
  tableRows,
  workspaces,
  type Db,
} from "@meerko/db";
import { mailClient, type MailClient, type SentIds } from "../mail/client.ts";
import { GmailError, type GoogleOAuth } from "../mail/gmail.ts";
import type { ImapConnectors } from "../mail/imap-common.ts";
import { buildMime } from "../mail/mime.ts";
import { markMailboxError } from "../mailboxes.ts";
import { isPolicyRejection, recordRejection } from "./mailbox-hold.ts";
import { EncryptionNotConfiguredError, type SecretBox } from "../provider-keys.ts";
import { advanceStage } from "../pipeline.ts";
import { reassignUnsent } from "../sequences.ts";
import { renderTemplate } from "../template.ts";
import { rampState } from "./ramp.ts";
import { nextWindowStart, type SendWindow } from "./window.ts";

const DAY_MS = 24 * 60 * 60_000;

/**
 * Due work the sender may take: in a workspace that approves sequence emails, only the step a person approved.
 * Needs `sequences` and `workspaces` joined.
 */
export const sendable = () => or(eq(workspaces.approveSequenceEmails, false), sql`${enrollments.approvedStep} = ${enrollments.nextStep}`)!;

/** The subject and body of an enrollment's next email, as the lead will get it. Follow-ups reply to the first subject. */
export function renderEmail(steps: { subject: string | null; body: string }[], stepIndex: number, data: Record<string, unknown>) {
  const step = steps[stepIndex];
  if (!step) return null;
  const firstSubject = renderTemplate(steps[0]!.subject ?? "", data);
  return { subject: stepIndex === 0 ? firstSubject : `Re: ${firstSubject}`, body: renderTemplate(step.body, data) };
}
/** Sends from one mailbox are 3-7 minutes apart, so they don't look automated. */
const MIN_GAP_MS = 3 * 60_000;
const GAP_JITTER_MS = 4 * 60_000;
/** Follow-ups land up to an hour after their nominal delay. */
const FOLLOWUP_JITTER_MS = 60 * 60_000;

export interface SenderDeps {
  box: SecretBox | null;
  /** Unset when Google OAuth isn't configured; only mailboxes connected through the Gmail API need it. */
  oauth?: GoogleOAuth;
  /** Base URL for unsubscribe links, e.g. MEERKO_PUBLIC_URL. */
  publicUrl: string;
  now?: () => Date;
  random?: () => number;
  fetch?: typeof fetch;
  imap?: ImapConnectors;
  microsoft?: MicrosoftOAuth;
  /** Checked before each mailbox: true stops the pass, leaving the rest for the next tick. */
  stop?: () => boolean;
}

// ---------- Unsubscribe tokens ----------

export function createUnsubscribeToken(box: SecretBox, workspaceId: string, email: string) {
  return Buffer.from(box.encrypt(JSON.stringify({ w: workspaceId, e: email })), "base64").toString("base64url");
}

export function readUnsubscribeToken(box: SecretBox, token: string): { workspaceId: string; email: string } | null {
  try {
    const { w, e } = JSON.parse(box.decrypt(Buffer.from(token, "base64url").toString("base64")));
    return typeof w === "string" && typeof e === "string" ? { workspaceId: w, email: e } : null;
  } catch {
    return null;
  }
}

/** Suppresses the address for the workspace and stops every active enrollment to it. */
export async function unsubscribe(db: Db, workspaceId: string, email: string) {
  const address = email.toLowerCase();
  await db.transaction(async (tx) => {
    await tx.insert(suppressions).values({ workspaceId, email: address, reason: "unsubscribed" }).onConflictDoNothing();
    await tx
      .update(enrollments)
      .set({ state: "unsubscribed", nextSendAt: null })
      .where(
        and(
          eq(enrollments.email, address),
          eq(enrollments.state, "active"),
          sql`${enrollments.sequenceId} in (select id from ${sequences} where ${sequences.workspaceId} = ${workspaceId})`,
        ),
      );
  });
}

// ---------- Sending ----------

export interface TickResult {
  sent: number;
  deferred: number;
  failed: number;
  skippedMailboxes: { mailboxId: string; reason: "daily_limit" | "spacing" | "error" }[];
  /** Mailboxes with due work left for the next tick because the tick's time budget ran out. */
  unreachedMailboxes?: number;
}

/**
 * One pass of the sender: at most one email per mailbox, so sends are spaced out naturally.
 * Run it every ~30s from the worker. Safe to run on several instances (rows are claimed with SKIP LOCKED).
 */
export async function runSendTick(db: Db, deps: SenderDeps): Promise<TickResult> {
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const now = (deps.now ?? (() => new Date()))();
  const random = deps.random ?? Math.random;
  const result: TickResult = { sent: 0, deferred: 0, failed: 0, skippedMailboxes: [] };

  // Leads whose mailbox left the pool (or was deleted) get a new one before anything is sent.
  await reassignUnsent(db, undefined, undefined, now);

  // Mailboxes that have due work in an active sequence. Each lead is sent from the mailbox it was assigned.
  const due = await db
    .selectDistinct({ id: mailboxes.id, dailyLimit: mailboxes.dailyLimit, rampStartedAt: mailboxes.rampStartedAt })
    .from(enrollments)
    .innerJoin(sequences, eq(enrollments.sequenceId, sequences.id))
    .innerJoin(mailboxes, eq(enrollments.mailboxId, mailboxes.id))
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .where(and(eq(enrollments.state, "active"), lte(enrollments.nextSendAt, now), eq(sequences.status, "active"), eq(mailboxes.status, "active"), isNull(mailboxes.heldAt), sendable()));

  for (const [i, mb] of due.entries()) {
    if (deps.stop?.()) {
      result.unreachedMailboxes = due.length - i;
      break;
    }
    const [{ sentToday, lastSentAt }] = (await db
      .select({
        sentToday: sql<number>`count(*) filter (where ${messages.sentAt} >= ${new Date(now.getTime() - DAY_MS).toISOString()})::int`,
        lastSentAt: sql<Date | null>`max(${messages.sentAt})`,
      })
      .from(messages)
      .where(and(eq(messages.mailboxId, mb.id), eq(messages.direction, "out"), gte(messages.sentAt, new Date(now.getTime() - DAY_MS))))) as [
      { sentToday: number; lastSentAt: Date | string | null },
    ];
    // A new mailbox sends less while it ramps up.
    if (sentToday >= rampState(mb, now).effectiveLimit) {
      result.skippedMailboxes.push({ mailboxId: mb.id, reason: "daily_limit" });
      continue;
    }
    if (lastSentAt && now.getTime() - new Date(lastSentAt).getTime() < MIN_GAP_MS + random() * GAP_JITTER_MS) {
      result.skippedMailboxes.push({ mailboxId: mb.id, reason: "spacing" });
      continue;
    }
    const outcome = await sendNextForMailbox(db, deps, mb.id, now, random);
    if (typeof outcome === "object") result.deferred += outcome.deferred;
    else if (outcome === "sent") result.sent++;
    else if (outcome === "failed") result.failed++;
    else if (outcome === "mailbox_error") result.skippedMailboxes.push({ mailboxId: mb.id, reason: "error" });
  }
  return result;
}

type Outcome = "sent" | "failed" | "mailbox_error" | "none" | { deferred: number };

async function sendNextForMailbox(db: Db, deps: SenderDeps, mailboxId: string, now: Date, random: () => number): Promise<Outcome> {
  return db.transaction(async (tx) => {
    // Claim the oldest due enrollment for this mailbox; other workers skip it.
    const [claimed] = await tx
      .select({ enrollment: enrollments, sequence: sequences })
      .from(enrollments)
      .innerJoin(sequences, eq(enrollments.sequenceId, sequences.id))
      .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
      .where(
        and(
          eq(enrollments.mailboxId, mailboxId),
          eq(sequences.status, "active"),
          eq(enrollments.state, "active"),
          lte(enrollments.nextSendAt, now),
          sendable(),
        ),
      )
      .orderBy(asc(enrollments.nextSendAt))
      .limit(1)
      .for("update", { of: enrollments, skipLocked: true });
    if (!claimed) return "none";
    const { enrollment: en, sequence: seq } = claimed;

    // Outside the send window: push the sequence's whole due batch to the next opening, each with its
    // own random offset so they don't all fire at 09:00 sharp.
    const window: SendWindow = { timezone: seq.timezone, startHour: seq.windowStartHour, endHour: seq.windowEndHour };
    const opening = nextWindowStart(now, window);
    if (opening.getTime() > now.getTime()) {
      const deferred = await tx
        .update(enrollments)
        .set({ nextSendAt: sql`${opening.toISOString()}::timestamptz + random() * interval '30 minutes'` })
        .where(and(eq(enrollments.sequenceId, seq.id), eq(enrollments.state, "active"), lte(enrollments.nextSendAt, now)))
        .returning({ id: enrollments.id });
      return { deferred: deferred.length };
    }

    const [suppressed] = await tx
      .select({ id: suppressions.id })
      .from(suppressions)
      .where(and(eq(suppressions.workspaceId, seq.workspaceId), eq(suppressions.email, en.email)));
    if (suppressed) {
      await tx.update(enrollments).set({ state: "unsubscribed", nextSendAt: null }).where(eq(enrollments.id, en.id));
      return "none";
    }

    const steps = await tx.select().from(sequenceSteps).where(eq(sequenceSteps.sequenceId, seq.id)).orderBy(asc(sequenceSteps.position));
    const step = steps[en.nextStep];
    if (!step) {
      await tx.update(enrollments).set({ state: "completed", nextSendAt: null }).where(eq(enrollments.id, en.id));
      return "none";
    }
    const [row] = await tx.select({ data: tableRows.data }).from(tableRows).where(eq(tableRows.id, en.rowId));
    const [mailbox] = await tx.select().from(mailboxes).where(eq(mailboxes.id, mailboxId));
    if (!row || !mailbox) {
      await tx.update(enrollments).set({ state: "stopped", nextSendAt: null, lastError: "Row or mailbox was deleted" }).where(eq(enrollments.id, en.id));
      return "failed";
    }

    const unsubUrl = new URL(`/u/${createUnsubscribeToken(deps.box!, seq.workspaceId, en.email)}`, deps.publicUrl).toString();
    const { subject, body } = renderEmail(steps, en.nextStep, row.data)!;
    const lastMessageId = en.messageIds.at(-1);
    const { raw, messageId } = buildMime({
      from: { email: mailbox.email, name: mailbox.displayName },
      to: en.email,
      subject,
      text: `${body}\n\n--\nIf you'd rather not hear from me again: ${unsubUrl}`,
      inReplyTo: lastMessageId,
      references: en.messageIds,
      headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    });

    let sent: SentIds;
    let client: MailClient | undefined;
    try {
      client = mailClient(mailbox, { box: deps.box!, oauth: deps.oauth, microsoft: deps.microsoft, fetch: deps.fetch, imap: deps.imap, db });
      sent = await client.send({ raw, messageId, from: mailbox.email, to: en.email }, en.gmailThreadId ?? undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof GmailError && err.needsReconnect) {
        // Leave the enrollment due; it resumes once the mailbox is reconnected.
        await markMailboxError(db, mailboxId, message);
        return "mailbox_error";
      }
      // Refused as spam or for a blocklist: counts toward putting this mailbox on hold (mailbox-hold.ts).
      if (isPolicyRejection(message)) await recordRejection(db, mailboxId, message, now);
      await tx.update(enrollments).set({ state: "failed", nextSendAt: null, lastError: message }).where(eq(enrollments.id, en.id));
      return "failed";
    } finally {
      await client?.close();
    }

    await tx.insert(messages).values({
      workspaceId: seq.workspaceId,
      mailboxId,
      enrollmentId: en.id,
      direction: "out",
      step: en.nextStep,
      gmailId: sent.id,
      gmailThreadId: sent.threadId,
      rfcMessageId: sent.rfcMessageId ?? messageId,
      fromEmail: mailbox.email,
      toEmail: en.email,
      subject,
      body,
      sentAt: now,
    });
    await advanceStage(tx, [en.rowId], "contacted");
    const next = steps[en.nextStep + 1];
    await tx
      .update(enrollments)
      .set({
        nextStep: en.nextStep + 1,
        // Over IMAP the ids can be missing until the reply tick finds the sent copy.
        gmailThreadId: sent.threadId ?? en.gmailThreadId,
        messageIds: [...en.messageIds, sent.rfcMessageId ?? messageId],
        state: next ? "active" : "completed",
        nextSendAt: next ? new Date(now.getTime() + next.delayDays * DAY_MS + random() * FOLLOWUP_JITTER_MS) : null,
        lastError: null,
      })
      .where(eq(enrollments.id, en.id));
    return "sent";
  });
}
