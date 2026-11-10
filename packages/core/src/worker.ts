import type { Db } from "@meerko/db";
import { runRoutinesTick, type RoutinesTickResult } from "./routines/routines.ts";
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
  send: TickResult;
}

/**
 * One pass of all background work. Runs replies first, so a reply that just arrived stops a follow-up
 * due in the same pass. Called on an interval by `apps/worker` (self-host) or by Cloud Scheduler through
 * `POST /internal/tick` (cloud, so nothing has to stay running). Overlapping passes are safe: sends are
 * claimed with SKIP LOCKED and each inbound Gmail message is stored once.
 */
export async function runWorkerTick(db: Db, deps: SenderDeps & { appUrl?: string; hookFetch?: typeof fetch; allowPrivateHooks?: boolean; slackFetch?: typeof fetch }, opts: { replies: boolean }): Promise<WorkerTickResult> {
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
  }
  // Autopilot runs every pass, after the reply scan so a replies routine sees what just arrived.
  try {
    result.routines = await runRoutinesTick(db, { box: deps.box, appUrl: deps.appUrl, now: deps.now, fetch: deps.hookFetch, allowPrivate: deps.allowPrivateHooks });
  } catch (err) {
    result.routineError = err instanceof Error ? err.message : String(err);
  }
  return { ...result, send: await runSendTick(db, deps) };
}
