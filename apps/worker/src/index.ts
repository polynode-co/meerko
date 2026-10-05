// Background jobs. For now: the email sender, ticking every 30s. Each tick sends at most one email
// per mailbox, so daily limits, spacing and send windows are enforced in `runSendTick`.
import { GoogleOAuth, runSendTick, SecretBox } from "@meerko/core";
import { createDb } from "@meerko/db";

const TICK_MS = 30_000;
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

  const tick = async () => {
    busy = true;
    try {
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

  console.log(`Meerko worker running (sender every ${TICK_MS / 1000}s)`);
  const timer = setInterval(() => void (busy || tick()), TICK_MS);
  void tick();
}
