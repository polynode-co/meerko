import type { Db } from "@meerko/db";
import { runReplyTick, type ReplyTickResult } from "./replies/replies.ts";
import { runSendTick, type SenderDeps, type TickResult } from "./sending/sender.ts";

export interface WorkerTickResult {
  replies?: ReplyTickResult;
  /** A failed reply scan (e.g. Gmail down) is reported but doesn't stop sending. */
  replyError?: string;
  send: TickResult;
}

/**
 * One pass of all background work. Runs replies first, so a reply that just arrived stops a follow-up
 * due in the same pass. Called on an interval by `apps/worker` (self-host) or by Cloud Scheduler through
 * `POST /internal/tick` (cloud, so nothing has to stay running). Overlapping passes are safe: sends are
 * claimed with SKIP LOCKED and each inbound Gmail message is stored once.
 */
export async function runWorkerTick(db: Db, deps: SenderDeps, opts: { replies: boolean }): Promise<WorkerTickResult> {
  const result: Partial<WorkerTickResult> = {};
  if (opts.replies) {
    try {
      result.replies = await runReplyTick(db, { box: deps.box, oauth: deps.oauth, now: deps.now, fetch: deps.fetch });
    } catch (err) {
      result.replyError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ...result, send: await runSendTick(db, deps) };
}
