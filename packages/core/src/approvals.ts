// Approval before sending. Each workspace chooses whether a person approves every email first (the default) or
// Meerko sends on its own, separately for sequence emails and for the agent's reply drafts. Approving a sequence
// email lets the sender take that one step when it's due; the next step waits for its own approval.
import { and, asc, enrollments, eq, inArray, sequenceSteps, sequences, sql, tableRows, workspaces, type Db } from "@meerko/db";
import { renderEmail } from "./sending/sender.ts";

export type ApprovalMode = "approve" | "auto";

export interface SendingMode {
  sequence_emails: ApprovalMode;
  reply_drafts: ApprovalMode;
}

const mode = (approve: boolean): ApprovalMode => (approve ? "approve" : "auto");

export async function getSendingMode(db: Db, workspaceId: string): Promise<SendingMode> {
  const [ws] = await db
    .select({ seq: workspaces.approveSequenceEmails, drafts: workspaces.approveReplyDrafts })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return { sequence_emails: mode(ws?.seq ?? true), reply_drafts: mode(ws?.drafts ?? true) };
}

export async function setSendingMode(db: Db, workspaceId: string, input: Partial<SendingMode>) {
  const set: Partial<typeof workspaces.$inferInsert> = {};
  if (input.sequence_emails) set.approveSequenceEmails = input.sequence_emails === "approve";
  if (input.reply_drafts) set.approveReplyDrafts = input.reply_drafts === "approve";
  if (Object.keys(set).length) await db.update(workspaces).set(set).where(eq(workspaces.id, workspaceId));
  return getSendingMode(db, workspaceId);
}

export interface PendingEmail {
  enrollment_id: string;
  sequence_id: string;
  sequence_name: string;
  to: string;
  /** 1 is the first email, 2 the first follow-up… */
  step: number;
  subject: string;
  body: string;
  /** When it goes once approved (or later, inside the sequence's send window and the mailbox's limits). */
  send_at: string | null;
}

/**
 * Sequence emails waiting for a person, soonest first: each active lead's next step that nobody approved yet, in active
 * sequences. Empty when the workspace sends sequence emails on its own.
 */
export async function listPendingEmails(db: Db, workspaceId: string, opts: { sequenceId?: string; limit?: number } = {}): Promise<PendingEmail[]> {
  if ((await getSendingMode(db, workspaceId)).sequence_emails === "auto") return [];
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      sequenceId: sequences.id,
      sequenceName: sequences.name,
      to: enrollments.email,
      nextStep: enrollments.nextStep,
      nextSendAt: enrollments.nextSendAt,
      data: tableRows.data,
    })
    .from(enrollments)
    .innerJoin(sequences, eq(enrollments.sequenceId, sequences.id))
    .innerJoin(tableRows, eq(enrollments.rowId, tableRows.id))
    .where(
      and(
        eq(sequences.workspaceId, workspaceId),
        eq(sequences.status, "active"),
        eq(enrollments.state, "active"),
        sql`${enrollments.approvedStep} is distinct from ${enrollments.nextStep}`,
        ...(opts.sequenceId ? [eq(sequences.id, opts.sequenceId)] : []),
      ),
    )
    .orderBy(sql`${enrollments.nextSendAt} asc nulls last`, asc(enrollments.createdAt))
    .limit(Math.min(opts.limit ?? 50, 200));
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((r) => r.sequenceId))];
  const steps = await db
    .select({ sequenceId: sequenceSteps.sequenceId, subject: sequenceSteps.subject, body: sequenceSteps.body })
    .from(sequenceSteps)
    .where(inArray(sequenceSteps.sequenceId, ids))
    .orderBy(asc(sequenceSteps.position));
  const bySequence = new Map<string, { subject: string | null; body: string }[]>();
  for (const s of steps) bySequence.set(s.sequenceId, [...(bySequence.get(s.sequenceId) ?? []), s]);

  return rows.flatMap((r) => {
    const email = renderEmail(bySequence.get(r.sequenceId) ?? [], r.nextStep, r.data);
    if (!email) return [];
    return [
      {
        enrollment_id: r.enrollmentId,
        sequence_id: r.sequenceId,
        sequence_name: r.sequenceName,
        to: r.to,
        step: r.nextStep + 1,
        subject: email.subject,
        body: email.body,
        send_at: r.nextSendAt?.toISOString() ?? null,
      },
    ];
  });
}

/**
 * Approves the next email of the given leads, or of every lead waiting in a sequence. Returns how many were approved;
 * leads that already moved on (sent, replied, stopped) are left alone.
 */
export async function approveEmails(db: Db, workspaceId: string, input: { enrollmentIds?: string[]; sequenceId?: string }) {
  if (!input.enrollmentIds?.length && !input.sequenceId) return { approved: 0 };
  const inWorkspace = db.select({ id: sequences.id }).from(sequences).where(eq(sequences.workspaceId, workspaceId));
  const approved = await db
    .update(enrollments)
    .set({ approvedStep: sql`${enrollments.nextStep}` })
    .where(
      and(
        inArray(enrollments.sequenceId, inWorkspace),
        eq(enrollments.state, "active"),
        sql`${enrollments.approvedStep} is distinct from ${enrollments.nextStep}`,
        ...(input.enrollmentIds?.length ? [inArray(enrollments.id, input.enrollmentIds)] : []),
        ...(input.sequenceId ? [eq(enrollments.sequenceId, input.sequenceId)] : []),
      ),
    )
    .returning({ id: enrollments.id });
  return { approved: approved.length };
}
