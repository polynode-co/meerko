import type { Db } from "@meerko/db";
import { expireCredits } from "./credits.ts";
import { runCrmSyncTick, type CrmTickResult } from "./crm.ts";
import { runAnnualCreditsTick } from "./billing.ts";
import { runRoutinesTick, type RoutinesTickResult } from "./routines/routines.ts";
import { runDigestTick, type DigestResult } from "./digest.ts";
import type { SystemMailer } from "./mail/system-mail.ts";
import { runReplyTick, type ReplyTickResult } from "./replies/replies.ts";
import { runMailboxHoldTick, type MailboxHoldResult } from "./sending/mailbox-hold.ts";
import { runSendTick, type SenderDeps, type TickResult } from "./sending/sender.ts";
import { runSlackNotifyTick, type SlackNotifyResult } from "./slack.ts";
import { tickBudget } from "./tick-budget.ts";

export interface WorkerTickResult {
  replies?: ReplyTickResult;
  /** A failed reply scan (e.g. Gmail down) is reported but doesn't stop sending. */
  replyError?: string;
  /** Autopilot: routines started, missed and never checked in to. */
  routines?: RoutinesTickResult;
  routineError?: string;
  /** Replies and drafts posted to Slack. */
  slack?: SlackNotifyResult;
  slackError?: string;
  /** Pro monthly credits that lapsed this pass. */
  expired?: { grants: number; credits: number };
  expireError?: string;
  /** Contacted leads pushed to the workspace's CRM. */
  crm?: CrmTickResult;
  crmError?: string;
  /** Annual Pro months whose credits came due. */
  annualCredits?: { granted: number };
  annualCreditsError?: string;
  /** Daily digests emailed to workspace owners. */
  digest?: DigestResult;
  digestError?: string;
  /** Mailboxes put on hold for bounces or spam rejections, and holds announced to their owners. */
  holds?: MailboxHoldResult;
  holdError?: string;
  send: TickResult;
  /** How long the pass took, and each step, in milliseconds. */
  ms: number;
  steps: Record<string, number>;
  /** Steps left for the next pass because its time budget ran out. */
  skipped?: string[];
}

/**
 * Shares of the time budget, as fractions of it: the reply scan stops starting mailboxes at half of it, the steps
 * after it are left for the next pass past three quarters, and sending stops starting mailboxes at the end. The
 * mailbox-hold check always runs, since it must come right before sending.
 */
const REPLIES_SHARE = 0.5;
const OPTIONAL_SHARE = 0.75;

type Deps = SenderDeps & { appUrl?: string; hookFetch?: typeof fetch; allowPrivateHooks?: boolean; slackFetch?: typeof fetch; mailer?: SystemMailer | null; crmFetch?: typeof fetch };

/**
 * One pass of all background work. Runs replies first, so a reply that just arrived stops a follow-up
 * due in the same pass. Called on an interval by `apps/worker` (self-host) or by Cloud Scheduler through
 * `POST /internal/tick` (cloud, so nothing has to stay running). Overlapping passes are safe: sends are
 * claimed with SKIP LOCKED and each inbound Gmail message is stored once.
 *
 * With `budgetMs`, the pass stops starting new work once that much time has passed and leaves the rest to the
 * next pass; work already started (one mailbox's scan, one send) finishes.
 */
export async function runWorkerTick(db: Db, deps: Deps, opts: { replies: boolean; budgetMs?: number; clock?: () => number }): Promise<WorkerTickResult> {
  const budget = tickBudget(opts.budgetMs, opts.clock);
  const share = (f: number) => (opts.budgetMs === undefined ? undefined : opts.budgetMs * f);
  const optional = { skipAfter: share(OPTIONAL_SHARE) };
  const result: Partial<WorkerTickResult> = {};
  // A step's failure is reported in `<key>Error` and doesn't stop the steps after it.
  const run = async <K extends keyof WorkerTickResult>(key: K, errorKey: keyof WorkerTickResult, fn: () => Promise<WorkerTickResult[K]>, o?: { skipAfter?: number }) => {
    try {
      const value = await budget.step(key, fn, o);
      if (value !== undefined) result[key] = value;
    } catch (err) {
      (result as Record<string, unknown>)[errorKey] = err instanceof Error ? err.message : String(err);
    }
  };

  if (opts.replies) {
    const stop = share(REPLIES_SHARE);
    await run("replies", "replyError", () =>
      runReplyTick(db, { box: deps.box, oauth: deps.oauth, microsoft: deps.microsoft, imap: deps.imap, now: deps.now, fetch: deps.fetch, stop: stop === undefined ? undefined : budget.stopAt(stop) }),
    );
    // And post new replies and the drafts written so far to Slack.
    await run("slack", "slackError", () => runSlackNotifyTick(db, { box: deps.box, appUrl: deps.appUrl, now: deps.now, fetch: deps.slackFetch }), optional);
    // And push leads whose stage moved to the workspace's CRM.
    await run("crm", "crmError", () => runCrmSyncTick(db, { box: deps.box ?? null, fetch: deps.crmFetch }), optional);
    // Annual Pro is invoiced yearly; its later months' credits are granted here as they come due.
    await run("annualCredits", "annualCreditsError", () => runAnnualCreditsTick(db, deps.now?.()), optional);
    // And email owners the daily digest of replies waiting, when it's due.
    await run("digest", "digestError", () => runDigestTick(db, { mailer: deps.mailer, box: deps.box, appUrl: deps.appUrl, publicUrl: deps.publicUrl, now: deps.now }), optional);
  }
  // Autopilot runs every pass, after the reply scan so a replies routine sees what just arrived.
  await run("routines", "routineError", () => runRoutinesTick(db, { box: deps.box, appUrl: deps.appUrl, now: deps.now, fetch: deps.hookFetch, allowPrivate: deps.allowPrivateHooks }), optional);
  // Monthly credits past their rollover month.
  await run("expired", "expireError", () => expireCredits(db, deps.now?.()), optional);
  // Right before sending, so a mailbox that just crossed a bounce or rejection threshold sends nothing more.
  await run("holds", "holdError", () => runMailboxHoldTick(db, { mailer: deps.mailer, box: deps.box, appUrl: deps.appUrl, fetch: deps.slackFetch, now: deps.now }));
  const end = share(1);
  const send = await budget.step("send", () => runSendTick(db, { ...deps, stop: end === undefined ? undefined : budget.stopAt(end) }));
  return { ...result, send: send!, ms: budget.elapsed(), steps: budget.durations, ...(budget.skipped.length ? { skipped: budget.skipped } : {}) };
}
