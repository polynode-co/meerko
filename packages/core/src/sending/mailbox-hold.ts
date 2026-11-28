import {
  and,
  eq,
  isNotNull,
  isNull,
  mailboxes,
  mailboxRejections,
  memberships,
  sql,
  users,
  workspaces,
  type Db,
  type MailboxHoldReason,
} from "@meerko/db";
import type { SystemMail, SystemMailer } from "../mail/system-mail.ts";
import { NotFoundError } from "../tables.ts";
import { postSlackNotice } from "../slack.ts";
import type { SecretBox } from "../provider-keys.ts";

/**
 * Auto-hold (decided 2026-11-11, #121): a mailbox stops sending on its own when its mail is going wrong, so one bad
 * inbox can't burn the user's domain. The rest of the pool keeps sending; only a person resumes it.
 * - bounces: at least 5 hard bounces, and at least 5% of what it sent, over the last 7 days;
 * - rejections: 3 sends refused by the recipient's provider as spam or for a blocklist (SMTP 5.7.x) in 24 hours.
 * Counting restarts when a person resumes the mailbox, so a resume isn't undone by the bounces that caused the hold.
 */
export const MAILBOX_HOLD = { minBounces: 5, bounceRate: 0.05, bounceDays: 7, rejections: 3, rejectionHours: 24 } as const;

const HOUR_MS = 3_600_000;

/** A send refused for policy or reputation (spam, a blocklist), not for a bad address: it says something about the mailbox. */
export function isPolicyRejection(message: string) {
  return /\b5\.7\.\d{1,3}\b/.test(message) || (/\b55[0-4]\b/.test(message) && /spam|block(ed|list)?|blacklist|listed|reputation|policy/i.test(message));
}

export async function recordRejection(db: Db, mailboxId: string, error: string, now = new Date()) {
  await db.insert(mailboxRejections).values({ mailboxId, error: error.slice(0, 500), createdAt: now });
}

export interface MailboxHoldDeps {
  mailer?: SystemMailer | null;
  box?: SecretBox | null;
  appUrl?: string;
  /** For Slack. */
  fetch?: typeof fetch;
  now?: () => Date;
}

export interface MailboxHoldResult {
  held: number;
  notified: number;
}

const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString("en")}%`;

/** Mailboxes that should go on hold now, with the reason and what tripped it. */
async function tripped(db: Db, now: Date) {
  const bounceSince = new Date(now.getTime() - MAILBOX_HOLD.bounceDays * 24 * HOUR_MS).toISOString();
  const rejectSince = new Date(now.getTime() - MAILBOX_HOLD.rejectionHours * HOUR_MS).toISOString();
  // Each window starts at the later of its usual start and the last resume.
  const from = (since: string) => sql`greatest(${since}::timestamptz, coalesce(m.hold_counts_from, '-infinity'::timestamptz))`;
  const rows = (await db.execute(sql`
    select m.id, m.workspace_id as "workspaceId", m.email,
      (select count(*) from messages x where x.mailbox_id = m.id and x.direction = 'out' and x.sent_at >= ${from(bounceSince)})::int as sent,
      (select count(*) from messages x where x.mailbox_id = m.id and x.direction = 'in' and x.intent = 'bounce' and x.sent_at >= ${from(bounceSince)})::int as bounces,
      (select count(*) from mailbox_rejections r where r.mailbox_id = m.id and r.created_at >= ${from(rejectSince)})::int as rejections
    from mailboxes m
    where m.held_at is null
      and (exists (select 1 from messages x where x.mailbox_id = m.id and x.direction = 'in' and x.intent = 'bounce' and x.sent_at >= ${from(bounceSince)})
        or exists (select 1 from mailbox_rejections r where r.mailbox_id = m.id and r.created_at >= ${from(rejectSince)}))
  `)) as unknown as { id: string; workspaceId: string; email: string; sent: number; bounces: number; rejections: number }[];
  const list = [...rows];
  const out: { id: string; reason: MailboxHoldReason; detail: string }[] = [];
  for (const m of list) {
    if (m.rejections >= MAILBOX_HOLD.rejections) {
      out.push({ id: m.id, reason: "rejections", detail: `${m.rejections} emails refused as spam or for a blocklist in the last ${MAILBOX_HOLD.rejectionHours} hours` });
    } else if (m.bounces >= MAILBOX_HOLD.minBounces && m.bounces >= MAILBOX_HOLD.bounceRate * m.sent) {
      const rate = m.sent ? ` (${pct(m.bounces / m.sent)})` : "";
      out.push({ id: m.id, reason: "bounces", detail: `${m.bounces} hard bounces in ${m.sent} emails over ${MAILBOX_HOLD.bounceDays} days${rate}` });
    }
  }
  return out;
}

/**
 * One pass, run by the worker before sending: puts mailboxes that tripped a threshold on hold, then tells the owners of
 * any hold not yet announced (email right away, and Slack when it's connected). The dashboard, the digest and
 * list_mailboxes show the hold for as long as it lasts.
 */
export async function runMailboxHoldTick(db: Db, deps: MailboxHoldDeps = {}): Promise<MailboxHoldResult> {
  const now = (deps.now ?? (() => new Date()))();
  const result: MailboxHoldResult = { held: 0, notified: 0 };
  for (const t of await tripped(db, now)) {
    const done = await db
      .update(mailboxes)
      .set({ heldAt: now, holdReason: t.reason, holdDetail: t.detail, holdNotifiedAt: null })
      .where(and(eq(mailboxes.id, t.id), isNull(mailboxes.heldAt)))
      .returning({ id: mailboxes.id });
    result.held += done.length;
  }

  const pending = await db
    .select({ id: mailboxes.id, workspaceId: mailboxes.workspaceId, email: mailboxes.email, detail: mailboxes.holdDetail, reason: mailboxes.holdReason, workspaceName: workspaces.name })
    .from(mailboxes)
    .innerJoin(workspaces, eq(workspaces.id, mailboxes.workspaceId))
    .where(and(isNotNull(mailboxes.heldAt), isNull(mailboxes.holdNotifiedAt)));
  for (const m of pending) {
    const notice = { mailbox: m.email, workspaceName: m.workspaceName, reason: m.reason ?? "bounces", detail: m.detail ?? "", appUrl: deps.appUrl };
    if (deps.mailer) {
      const owners = await db
        .select({ email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.workspaceId, m.workspaceId), eq(memberships.role, "owner")));
      for (const o of owners) {
        try {
          await deps.mailer.send(mailboxHoldMail({ to: o.email, ...notice }));
        } catch {
          // Best effort: the dashboard, the digest and list_mailboxes still show the hold.
        }
      }
    }
    await postSlackNotice(db, { box: deps.box ?? null, fetch: deps.fetch }, m.workspaceId, mailboxHoldText(notice));
    // Announced once, whatever reached the user: retrying a failing mailer every 30s helps nobody.
    await db.update(mailboxes).set({ holdNotifiedAt: now }).where(eq(mailboxes.id, m.id));
    result.notified++;
  }
  return result;
}

/** Lifts a hold. Only a person does this (dashboard, CLI or their agent); counting restarts from now. */
export async function resumeMailbox(db: Db, workspaceId: string, id: string, now = new Date()) {
  const [row] = await db
    .update(mailboxes)
    .set({ heldAt: null, holdReason: null, holdDetail: null, holdNotifiedAt: null, holdCountsFrom: now })
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, id)))
    .returning({ id: mailboxes.id });
  if (!row) throw new NotFoundError(`Mailbox ${id} not found`);
}

interface HoldNotice {
  mailbox: string;
  workspaceName: string;
  reason: MailboxHoldReason;
  detail: string;
  appUrl?: string;
}

const advice: Record<MailboxHoldReason, string> = {
  bounces: "Check the list it was sending to: verify the emails, or drop the rows that bounced. Then resume it.",
  rejections:
    "Mail providers are treating it as spam. Check its domain's SPF, DKIM and DMARC (list_mailboxes with check_domains), lower its daily limit, and give it a few days before resuming.",
};

/** The Slack line and the email's first sentence. */
export function mailboxHoldText(n: HoldNotice) {
  return `Meerko paused sending from ${n.mailbox} (${n.workspaceName}): ${n.detail}. Its other mailboxes keep sending. ${advice[n.reason]}`;
}

export function mailboxHoldMail(n: HoldNotice & { to: string }): SystemMail {
  const settings = n.appUrl ? new URL("/app/settings", n.appUrl).toString() : null;
  const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const text = [
    `Meerko paused sending from ${n.mailbox} in ${n.workspaceName}.`,
    "",
    `Why: ${n.detail}.`,
    "Its queued emails wait; the workspace's other mailboxes keep sending.",
    "",
    advice[n.reason],
    "",
    settings ? `Resume it in Settings → Mailboxes: ${settings}` : "Resume it with `meerko mailboxes resume <id>` or from your agent (manage_mailbox).",
    "It won't resume on its own.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f6f6f3;font-family:system-ui,-apple-system,sans-serif;color:#0b0b0c">
<div style="max-width:520px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e3e3dc">
<p style="margin:0 0 16px;font-size:18px;font-weight:600">Meerko paused sending from ${esc(n.mailbox)}</p>
<p style="margin:0 0 12px">In ${esc(n.workspaceName)}. Why: ${esc(n.detail)}.</p>
<p style="margin:0 0 12px">Its queued emails wait; the workspace's other mailboxes keep sending.</p>
<p style="margin:0 0 20px">${esc(advice[n.reason])}</p>
${settings ? `<p style="margin:0 0 12px"><a href="${esc(settings)}" style="color:#0b0b0c">Resume it in Settings → Mailboxes</a></p>` : ""}
<p style="margin:0;font-size:13px;color:#6b6b63">It won't resume on its own.</p>
</div></body></html>`;
  return { to: n.to, subject: `Paused: ${n.mailbox} stopped sending`, text, html };
}
