// The daily digest: one email a day to each workspace owner when people have replied ("3 replies waiting"), so
// replies don't sit unseen when nobody has the dashboard, Slack or an agent hook open. On by default; every email
// carries a one-click unsubscribe, and Settings turns it back on.
import { and, desc, eq, isNotNull, mailboxes, memberships, messages, sql, users, workspaces, type Db } from "@meerko/db";
import type { SystemMail, SystemMailer } from "./mail/system-mail.ts";
import type { SecretBox } from "./provider-keys.ts";
import { humanReply } from "./slack.ts";

/** Digests go out from this hour (UTC) onwards, once per UTC day: early morning in Europe, before the US wakes up. */
export const DIGEST_HOUR_UTC = 7;
/** How many replies the email lists; the rest are a count and a link. */
const LISTED = 5;

export interface DigestDeps {
  mailer: SystemMailer | null | undefined;
  box: SecretBox | null | undefined;
  /** The dashboard, for "Open the inbox" and the Settings link. */
  appUrl?: string;
  /** The API, which serves the unsubscribe link. */
  publicUrl: string;
  now?: () => Date;
}

export interface DigestResult {
  sent: number;
  failed: number;
}

export interface DigestReply {
  from: string;
  subject: string | null;
  intent: string | null;
  sentAt: Date;
}

/** Whether the signed-in person gets the digest for this workspace. Only owners get one. */
export async function getDigest(db: Db, userId: string, workspaceId: string) {
  const [m] = await db
    .select({ role: memberships.role, enabled: memberships.digestEnabled, lastSentAt: memberships.digestSentAt })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)));
  if (!m) return null;
  return { eligible: m.role === "owner", enabled: m.role === "owner" && m.enabled, last_sent_at: m.lastSentAt?.toISOString() ?? null };
}

export async function setDigest(db: Db, userId: string, workspaceId: string, enabled: boolean) {
  await db
    .update(memberships)
    .set({ digestEnabled: enabled })
    .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)));
  return getDigest(db, userId, workspaceId);
}

const tokenData = (userId: string, workspaceId: string) => `digest:${userId}:${workspaceId}`;

/** The unsubscribe token in each digest: who and which workspace, signed so it works without signing in. */
export function digestUnsubscribeToken(box: SecretBox, userId: string, workspaceId: string) {
  return `${userId}.${workspaceId}.${box.sign(tokenData(userId, workspaceId))}`;
}

/** Turns the digest off for the token's person and workspace. False when the token isn't one of ours. */
export async function unsubscribeDigest(db: Db, box: SecretBox, token: string) {
  const [userId, workspaceId, tag] = token.split(".");
  if (!userId || !workspaceId || !tag || !box.verify(tokenData(userId, workspaceId), tag)) return false;
  await setDigest(db, userId, workspaceId, false);
  return true;
}

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * One pass: from DIGEST_HOUR_UTC, each owner with the digest on who hasn't had one today gets one, if people have
 * replied since their last digest (or since they joined). Nothing new, no email, and the next pass checks again.
 * The send is recorded only after the mailer accepts it.
 */
export async function runDigestTick(db: Db, deps: DigestDeps): Promise<DigestResult> {
  const result: DigestResult = { sent: 0, failed: 0 };
  if (!deps.mailer || !deps.box) return result;
  const now = (deps.now ?? (() => new Date()))();
  if (now.getUTCHours() < DIGEST_HOUR_UTC) return result;
  const today = startOfUtcDay(now);

  const since = sql`coalesce(${memberships.digestSentAt}, ${memberships.createdAt})`;
  const due = await db
    .select({
      userId: memberships.userId,
      workspaceId: memberships.workspaceId,
      email: users.email,
      workspaceName: workspaces.name,
      newCount: sql<number>`count(*) filter (where ${messages.sentAt} > ${since})`.mapWith(Number),
      waiting: sql<number>`count(*)`.mapWith(Number),
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .innerJoin(messages, and(eq(messages.workspaceId, memberships.workspaceId), humanReply()))
    .where(
      and(
        eq(memberships.role, "owner"),
        eq(memberships.digestEnabled, true),
        sql`(${memberships.digestSentAt} is null or ${memberships.digestSentAt} < ${today.toISOString()}::timestamptz)`,
      ),
    )
    .groupBy(memberships.userId, memberships.workspaceId, users.email, workspaces.name, memberships.digestSentAt, memberships.createdAt)
    .having(sql`count(*) filter (where ${messages.sentAt} > ${since}) > 0`);

  for (const d of due) {
    try {
      const replies = await db
        .select({ from: messages.fromEmail, subject: messages.subject, intent: messages.intent, sentAt: messages.sentAt })
        .from(messages)
        .where(and(eq(messages.workspaceId, d.workspaceId), humanReply()))
        .orderBy(desc(messages.sentAt))
        .limit(LISTED);
      // Mailboxes Meerko paused (mailbox-hold.ts) stay in every digest until someone resumes them.
      const held = await db
        .select({ email: mailboxes.email, detail: mailboxes.holdDetail })
        .from(mailboxes)
        .where(and(eq(mailboxes.workspaceId, d.workspaceId), isNotNull(mailboxes.heldAt)));
      const unsubscribeUrl = new URL(`/digest/unsubscribe?t=${encodeURIComponent(digestUnsubscribeToken(deps.box, d.userId, d.workspaceId))}`, deps.publicUrl).toString();
      await deps.mailer.send(
        digestMail({ to: d.email, workspaceName: d.workspaceName, waiting: d.waiting, newCount: d.newCount, replies, held, appUrl: deps.appUrl, unsubscribeUrl }),
      );
      await db
        .update(memberships)
        .set({ digestSentAt: now })
        .where(and(eq(memberships.userId, d.userId), eq(memberships.workspaceId, d.workspaceId)));
      result.sent += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

/** The digest email. Plain text first, like the sign-in link, with List-Unsubscribe for the mail app's own button. */
export function digestMail(input: {
  to: string;
  workspaceName: string;
  waiting: number;
  newCount: number;
  replies: DigestReply[];
  /** Mailboxes Meerko paused for bounces or spam rejections. */
  held?: { email: string; detail: string | null }[];
  appUrl?: string;
  unsubscribeUrl: string;
}): SystemMail {
  const held = input.held ?? [];
  const heldLine = (h: { email: string; detail: string | null }) => `${h.email} is paused${h.detail ? `: ${h.detail}` : ""}. Resume it in Settings once it's fixed.`;
  const { waiting, newCount, replies, workspaceName, unsubscribeUrl } = input;
  const inbox = input.appUrl ? new URL("/app/inbox", input.appUrl).toString() : null;
  const settings = input.appUrl ? new URL("/app/settings", input.appUrl).toString() : null;
  const headline = `${plural(waiting, "reply", "replies")} waiting`;
  const sub = newCount === waiting ? `in ${workspaceName}` : `in ${workspaceName}, ${newCount.toLocaleString("en")} of them new since the last email`;
  const line = (r: DigestReply) => `${r.from}${r.subject ? `: ${r.subject}` : ""}${r.intent ? ` (${r.intent.replace(/_/g, " ")})` : ""}`;
  const more = waiting - replies.length;

  const text = [
    `${headline} ${sub}.`,
    "",
    ...replies.map((r) => `- ${line(r)}`),
    ...(more > 0 ? [`- and ${plural(more, "more", "more")}`] : []),
    "",
    ...(inbox ? [`Answer them: ${inbox}`, ""] : []),
    ...(held.length ? [...held.map(heldLine), ""] : []),
    "You get this once a day, only when people have replied.",
    `Stop these emails: ${unsubscribeUrl}`,
  ].join("\n");

  const rows = replies
    .map(
      (r) =>
        `<li style="margin:0 0 8px"><strong>${escapeHtml(r.from)}</strong>${r.subject ? ` <span style="color:#6b6b63">${escapeHtml(r.subject)}</span>` : ""}${r.intent ? ` <span style="font-size:12px;color:#6b6b63">(${escapeHtml(r.intent.replace(/_/g, " "))})</span>` : ""}</li>`,
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f6f6f3;font-family:system-ui,-apple-system,sans-serif;color:#0b0b0c">
<div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e3e3dc">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b6b63">Meerko</p>
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.25">${escapeHtml(headline)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#6b6b63">${escapeHtml(sub)}</p>
<ul style="margin:0 0 24px;padding-left:18px;font-size:15px;line-height:1.5">${rows}${more > 0 ? `<li style="color:#6b6b63">and ${escapeHtml(plural(more, "more", "more"))}</li>` : ""}</ul>
${held.map((h) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#b5462a">${escapeHtml(heldLine(h))}</p>`).join("")}
${inbox ? `<p style="margin:0 0 24px"><a href="${escapeHtml(inbox)}" style="display:inline-block;background:#0b0b0c;color:#a8f326;padding:13px 20px;font-size:14px;font-weight:600;text-decoration:none">Open the inbox</a></p>` : ""}
<p style="margin:0;font-size:13px;line-height:1.6;color:#6b6b63">You get this once a day, only when people have replied. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b6b63">Stop these emails</a>${settings ? `, or turn them back on in <a href="${escapeHtml(settings)}" style="color:#6b6b63">Settings</a>` : ""}.</p>
</div></body></html>`;

  return {
    to: input.to,
    subject: `${headline} in Meerko`,
    text,
    html,
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
