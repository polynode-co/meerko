import { serve } from "@hono/node-server";
import { GoogleOAuth, IcypeasClient, SecretBox, stripeFromEnv, type SignupMode } from "@meerko/core";
import { createDb } from "@meerko/db";
import { createAnalytics } from "./analytics.ts";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const icypeasKey = process.env.ICYPEAS_API_KEY;
const publicUrl = process.env.MEERKO_PUBLIC_URL ?? `http://localhost:${port}`;
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
const analytics = createAnalytics();
// On when STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and both price ids are set (Meerko Cloud).
const billing = stripeFromEnv();
const app = createApp(createDb(), {
  icypeas: icypeasKey ? new IcypeasClient({ apiKey: icypeasKey }) : undefined,
  // Selling credits only makes sense where they're spent, so billing turns metering on.
  credits: { enabled: process.env.MEERKO_CREDITS === "on" || !!billing },
  secretBox: SecretBox.fromEnv(),
  googleOAuth:
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? new GoogleOAuth({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          redirectUri: new URL("/oauth/google/callback", publicUrl).toString(),
        })
      : undefined,
  // Off by default: Google's consent screen for Gmail needs verification + CASA; app passwords don't.
  gmailOAuthConnect: process.env.MEERKO_GMAIL_OAUTH === "1",
  tick: process.env.MEERKO_TICK_SECRET ? { secret: process.env.MEERKO_TICK_SECRET, publicUrl } : undefined,
  appUrl: process.env.MEERKO_APP_URL,
  allowPrivateHooks: process.env.MEERKO_ALLOW_PRIVATE_HOOKS === "1",
  // Same OAuth client as Gmail, its own redirect URI and identity-only scopes.
  googleSignIn:
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? new GoogleOAuth({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          redirectUri: new URL("/auth/google/callback", publicUrl).toString(),
        })
      : undefined,
  signup: process.env.MEERKO_SIGNUP === "open" ? "open" : ("invite" satisfies SignupMode),
  publicUrl,
  analytics,
  billing,
});

serve({ fetch: app.fetch, port }, () => console.log(`Meerko API listening on http://localhost:${port}`));

// Cloud Run sends SIGTERM before stopping an instance; send what's still queued.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await analytics.posthog?.shutdown().catch(() => {});
    process.exit(0);
  });
}
