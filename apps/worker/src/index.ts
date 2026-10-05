// Background jobs: the email sender every 30s (at most one email per mailbox per tick, so limits,
// spacing and send windows are enforced in `runSendTick`), and the reply scan every 2 minutes.
import { GoogleOAuth, runReplyTick, runSendTick, SecretBox } from "@meerko/core";
import { createDb } from "@meerko/db";

const TICK_MS = 30_000;
const REPLY_EVERY_TICKS = 4;
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MEERKO_PUBLIC_URL } = process.env;
const publicUrl = MEERKO_PUBLIC_URL ?? "http://localhost:8787";
const box = SecretBox.fromEnv();

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !box) {
  console.log("Sender idle: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and MEERKO_ENCRYPTION_KEY to send email.");
  // Stay up so `pnpm dev` doesn't fail; there's nothing to do without Gmail.
  setInterval(() => {}, 1 << 30);
} else {
  const db = createDb();
  const oauth = new GoogleOAuth({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: new URL("/oauth/google/callback", publicUrl).toString(),
  });
  let busy = false;
  let stopping = false;
  let ticks = 0;

  const tick = async () => {
    busy = true;
    try {
      // Replies first, so a reply that just arrived stops a follow-up due in this same tick.
      if (ticks++ % REPLY_EVERY_TICKS === 0) {
        try {
          const r = await runReplyTick(db, { box, oauth });
          if (r.replies || r.bounces || r.unsubscribes || r.outOfOffice) {
            console.log(`replies: ${r.replies} replies, ${r.bounces} bounces, ${r.unsubscribes} unsubscribes, ${r.outOfOffice} out of office`);
          }
        } catch (err) {
          console.error("reply scan failed:", err);
        }
      }
      const res = await runSendTick(db, { box, oauth, publicUrl });
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
