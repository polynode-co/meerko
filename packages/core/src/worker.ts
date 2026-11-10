import type { Db } from "@meerko/db";
import { expireCredits } from "./credits.ts";
import { runCrmSyncTick, type CrmTickResult } from "./crm.ts";
import { runRoutinesTick, type RoutinesTickResult } from "./routines/routines.ts";
import { runDigestTick, type DigestResult } from "./digest.ts";
import type { SystemMailer } from "./mail/system-mail.ts";
import { runReplyTick, type ReplyTickResult } from "./replies/replies.ts";
import { runSendTick, type SenderDeps, type TickResult } from "./sending/sender.ts";
import { runSlackNotifyTick, type SlackNotifyResult } from "./slack.ts";

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
  /** Daily digests emailed to workspace owners. */
  digest?: DigestResult;
  digestError?: string;
  send: TickResult;
}

/**
 * One pass of all background work. Runs replies first, so a reply that just arrived stops a follow-up
 * due in the same pass. Called on an interval by `apps/worker` (self-host) or by Cloud Scheduler through
 * `POST /internal/tick` (cloud, so nothing has to stay running). Overlapping passes are safe: sends are
 * claimed with SKIP LOCKED and each inbound Gmail message is stored once.
 */
export async function runWorkerTick(db: Db, deps: SenderDeps & { appUrl?: string; hookFetch?: typeof fetch; allowPrivateHooks?: boolean; slackFetch?: typeof fetch; mailer?: SystemMailer | null; crmFetch?: typeof fetch }, opts: { replies: boolean }): Promise<WorkerTickResult> {
  const result: Partial<WorkerTickResult> = {};
  if (opts.replies) {
    try {
      result.replies = await runReplyTick(db, { box: deps.box, oauth: deps.oauth, microsoft: deps.microsoft, imap: deps.imap, now: deps.now, fetch: deps.fetch });
    } catch (err) {
      result.replyError = err instanceof Error ? err.message : String(err);
    }
    // And post new replies and the drafts written so far to Slack.
    try {
      result.slack = await runSlackNotifyTick(db, { box: deps.box, appUrl: deps.appUrl, now: deps.now, fetch: deps.slackFetch });
    } catch (err) {
      result.slackError = err instanceof Error ? err.message : String(err);
    }
    // And push leads whose stage moved to the workspace's CRM.
    try {
      result.crm = await runCrmSyncTick(db, { box: deps.box ?? null, fetch: deps.crmFetch });
    } catch (err) {
      result.crmError = err instanceof Error ? err.message : String(err);
    }
    // And email owners the daily digest of replies waiting, when it's due.
    try {
      result.digest = await runDigestTick(db, { mailer: deps.mailer, box: deps.box, appUrl: deps.appUrl, publicUrl: deps.publicUrl, now: deps.now });
    } catch (err) {
      result.digestError = err instanceof Error ? err.message : String(err);
    }
  }
  // Autopilot runs every pass, after the reply scan so a replies routine sees what just arrived.
  try {
    result.routines = await runRoutinesTick(db, { box: deps.box, appUrl: deps.appUrl, now: deps.now, fetch: deps.hookFetch, allowPrivate: deps.allowPrivateHooks });
  } catch (err) {
    result.routineError = err instanceof Error ? err.message : String(err);
  }
  // Monthly credits past their rollover month.
  try {
    result.expired = await expireCredits(db, deps.now?.());
  } catch (err) {
    result.expireError = err instanceof Error ? err.message : String(err);
  }
  return { ...result, send: await runSendTick(db, deps) };
}
