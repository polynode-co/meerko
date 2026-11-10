// Background jobs for self-hosting: the email sender every 30s and the reply scan every 2 minutes.
// Meerko Cloud doesn't run this process; Cloud Scheduler calls POST /internal/tick on the API instead.
import { GoogleOAuth, MicrosoftOAuth, runWorkerTick, SecretBox } from "@meerko/core";
import { createDb } from "@meerko/db";

const TICK_MS = 30_000;
const REPLY_EVERY_TICKS = 4;
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MEERKO_PUBLIC_URL, MEERKO_APP_URL, MEERKO_ALLOW_PRIVATE_HOOKS } = process.env;
const publicUrl = MEERKO_PUBLIC_URL ?? "http://localhost:8787";
const box = SecretBox.fromEnv();

if (!box) {
  console.log("Sender idle: set MEERKO_ENCRYPTION_KEY to send email.");
  // Stay up so `pnpm dev` doesn't fail; there's nothing to do without stored mailbox credentials.
  setInterval(() => {}, 1 << 30);
} else {
  const db = createDb();
  // Only mailboxes connected through the Gmail API need it; app-password mailboxes work without.
  const oauth =
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? new GoogleOAuth({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          redirectUri: new URL("/oauth/google/callback", publicUrl).toString(),
        })
      : undefined;
  // Outlook / Microsoft 365 mailboxes.
  const microsoft =
    MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET
      ? new MicrosoftOAuth({
          clientId: MICROSOFT_CLIENT_ID,
          clientSecret: MICROSOFT_CLIENT_SECRET,
          redirectUri: new URL("/oauth/microsoft/callback", publicUrl).toString(),
        })
      : undefined;
  let busy = false;
  let stopping = false;
  let ticks = 0;

  const tick = async () => {
    busy = true;
    try {
      const { replies: r, replyError, routines, routineError, slack, slackError, send: res } = await runWorkerTick(
        db,
        { box, oauth, microsoft, publicUrl, appUrl: MEERKO_APP_URL, allowPrivateHooks: MEERKO_ALLOW_PRIVATE_HOOKS === "1" },
        { replies: ticks++ % REPLY_EVERY_TICKS === 0 },
      );
      if (replyError) console.error("reply scan failed:", replyError);
      if (routineError) console.error("autopilot failed:", routineError);
      if (slackError) console.error("slack notify failed:", slackError);
      if (slack && (slack.drafts || slack.replies || slack.failed)) console.log(`slack: ${slack.drafts} drafts and ${slack.replies} replies posted, ${slack.failed} failed`);
      if (routines && (routines.started || routines.failed || routines.missed || routines.noCallback))
        console.log(`autopilot: ${routines.started} started (${routines.replies} replies), ${routines.failed} failed, ${routines.missed} missed, ${routines.noCallback} never checked in`);
      if (r && (r.replies || r.bounces || r.unsubscribes || r.outOfOffice)) {
        console.log(`replies: ${r.replies} replies, ${r.bounces} bounces, ${r.unsubscribes} unsubscribes, ${r.outOfOffice} out of office`);
      }
      if (res.sent || res.failed || res.deferred) console.log(`sender: ${res.sent} sent, ${res.deferred} deferred, ${res.failed} failed`);
    } catch (err) {
      console.error("sender tick failed:", err);
    } finally {
      busy = false;
    }
    if (stopping) await shutdown();
  };

  const shutdown = async () => {
    await db.close();
    process.exit(0);
  };

  // Never cut a send in half: if a tick is running, exit when it finishes.
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      stopping = true;
      clearInterval(timer);
      if (!busy) void shutdown();
    });
  }

  console.log(`Meerko worker running (sender every ${TICK_MS / 1000}s, replies every ${(TICK_MS * REPLY_EVERY_TICKS) / 60_000} min)`);
  const timer = setInterval(() => void (busy || tick()), TICK_MS);
  void tick();
}
