import { and, asc, enrollments, eq, mailboxes, messages, replyDrafts, sql, suppressions, tableRows, type Db } from "@meerko/db";
import { GmailClient, type GoogleOAuth } from "../mail/gmail.ts";
import { buildMime } from "../mail/mime.ts";
import { markMailboxError } from "../mailboxes.ts";
import { EncryptionNotConfiguredError, type SecretBox } from "../provider-keys.ts";
import { NotFoundError } from "../tables.ts";
import { ReplyError } from "./replies.ts";

async function getReply(db: Db, workspaceId: string, replyId: string) {
  const [reply] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, replyId), eq(messages.direction, "in")));
  if (!reply) throw new NotFoundError(`Reply ${replyId} not found`);
  return reply;
}

/** Saves the agent's answer to a reply as a pending draft, replacing any earlier pending draft. */
export async function draftReply(db: Db, workspaceId: string, replyId: string, body: string) {
  if (!body.trim()) throw new ReplyError("The draft is empty");
  await getReply(db, workspaceId, replyId);
  const [draft] = await db
    .insert(replyDrafts)
    .values({ workspaceId, replyId, body })
    .onConflictDoUpdate({
      target: replyDrafts.replyId,
      targetWhere: sql`${replyDrafts.status} = 'pending'`,
      set: { body, updatedAt: sql`now()` },
    })
    .returning();
  return draft!;
}

/** Pending drafts with the reply they answer, the thread so far and the prospect's row, for review. */
export async function listDrafts(db: Db, workspaceId: string, status: "pending" | "sent" | "discarded" = "pending") {
  const drafts = await db
    .select({
      id: replyDrafts.id,
      body: replyDrafts.body,
      status: replyDrafts.status,
      updatedAt: replyDrafts.updatedAt,
      replyId: messages.id,
      to: messages.fromEmail,
      replySubject: messages.subject,
      replyBody: messages.body,
      intent: messages.intent,
      enrollmentId: messages.enrollmentId,
      row: tableRows.data,
    })
    .from(replyDrafts)
    .innerJoin(messages, eq(replyDrafts.replyId, messages.id))
    .leftJoin(enrollments, eq(messages.enrollmentId, enrollments.id))
    .leftJoin(tableRows, eq(enrollments.rowId, tableRows.id))
    .where(and(eq(replyDrafts.workspaceId, workspaceId), eq(replyDrafts.status, status)))
    .orderBy(asc(replyDrafts.createdAt));

  const ids = drafts.map((d) => d.enrollmentId).filter((v): v is string => !!v);
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
  return drafts.map(({ enrollmentId, ...d }) => ({
    ...d,
    thread: history.filter((h) => h.enrollmentId === enrollmentId).map(({ enrollmentId: _, ...h }) => h),
  }));
}

export async function discardDraft(db: Db, workspaceId: string, draftId: string) {
  const [row] = await db
    .update(replyDrafts)
    .set({ status: "discarded", updatedAt: sql`now()` })
    .where(and(eq(replyDrafts.workspaceId, workspaceId), eq(replyDrafts.id, draftId), eq(replyDrafts.status, "pending")))
    .returning({ id: replyDrafts.id });
  if (!row) throw new NotFoundError(`No pending draft ${draftId}`);
}

export interface ApproveDeps {
  box: SecretBox | null;
  oauth: GoogleOAuth;
  fetch?: typeof fetch;
}

/**
 * Sends an approved draft (optionally with the human's edits) as a reply in the same Gmail thread,
 * from the mailbox that received the reply, and marks the reply handled.
 */
export async function approveDraft(db: Db, workspaceId: string, draftId: string, deps: ApproveDeps, editedBody?: string) {
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const [draft] = await db
    .select()
    .from(replyDrafts)
    .where(and(eq(replyDrafts.workspaceId, workspaceId), eq(replyDrafts.id, draftId)));
  if (!draft) throw new NotFoundError(`Draft ${draftId} not found`);
  if (draft.status !== "pending") throw new ReplyError(`This draft was already ${draft.status}`);
  const body = editedBody?.trim() ? editedBody : draft.body;

  const reply = await getReply(db, workspaceId, draft.replyId);
  if (!reply.mailboxId) throw new ReplyError("The mailbox that received this reply was disconnected");
  const [suppressed] = await db
    .select({ reason: suppressions.reason })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, workspaceId), eq(suppressions.email, reply.fromEmail)));
  if (suppressed) throw new ReplyError(`${reply.fromEmail} is on the do-not-email list (${suppressed.reason})`);

  const [mailbox] = await db.select().from(mailboxes).where(eq(mailboxes.id, reply.mailboxId));
  if (!mailbox || mailbox.status !== "active") throw new ReplyError("The mailbox lost access; reconnect it with `meerko mailboxes connect`");
  const [enrollment] = reply.enrollmentId ? await db.select().from(enrollments).where(eq(enrollments.id, reply.enrollmentId)) : [];

  // Thread on the reply itself: In-Reply-To its Message-ID, References the whole conversation.
  const references = [...(enrollment?.messageIds ?? []), ...(reply.rfcMessageId ? [reply.rfcMessageId] : [])];
  const subject = `Re: ${(reply.subject ?? "").replace(/^(\s*(re|aw|sv|fw|fwd)\s*:\s*)+/i, "")}`;
  const { raw, messageId } = buildMime({
    from: { email: mailbox.email, name: mailbox.displayName },
    to: reply.fromEmail,
    subject,
    text: body,
    inReplyTo: reply.rfcMessageId ?? undefined,
    references,
  });

  // Claim the draft before sending, so a double approval can't send the email twice.
  const claimed = await db
    .update(replyDrafts)
    .set({ status: "sent", body, updatedAt: sql`now()` })
    .where(and(eq(replyDrafts.id, draftId), eq(replyDrafts.status, "pending")))
    .returning({ id: replyDrafts.id });
  if (claimed.length === 0) throw new ReplyError("This draft is already being sent");

  const gmail = new GmailClient(deps.oauth, deps.box.decrypt(mailbox.encryptedRefreshToken), deps.fetch);
  let sent;
  try {
    sent = await gmail.send(raw, reply.gmailThreadId ?? undefined);
  } catch (err) {
    await db.update(replyDrafts).set({ status: "pending" }).where(eq(replyDrafts.id, draftId));
    if ((err as { needsReconnect?: boolean }).needsReconnect) await markMailboxError(db, mailbox.id, (err as Error).message);
    throw err;
  }

  return db.transaction(async (tx) => {
    const [out] = await tx
      .insert(messages)
      .values({
        workspaceId,
        mailboxId: mailbox.id,
        enrollmentId: reply.enrollmentId,
        direction: "out",
        gmailId: sent.id,
        gmailThreadId: sent.threadId,
        rfcMessageId: messageId,
        fromEmail: mailbox.email,
        toEmail: reply.fromEmail,
        subject,
        body,
      })
      .returning({ id: messages.id });
    await tx.update(replyDrafts).set({ sentMessageId: out!.id }).where(eq(replyDrafts.id, draftId));
    await tx.update(messages).set({ handledAt: sql`coalesce(${messages.handledAt}, now())` }).where(eq(messages.id, reply.id));
    if (enrollment) {
      // Keep the thread's history complete so a later answer threads correctly too.
      await tx
        .update(enrollments)
        .set({ messageIds: [...references, messageId] })
        .where(eq(enrollments.id, enrollment.id));
    }
    return { sent: true, to: reply.fromEmail, subject, messageId: out!.id };
  });
}
