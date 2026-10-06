import { serve } from "@hono/node-server";
import { GoogleOAuth, IcypeasClient, SecretBox } from "@meerko/core";
import { createDb } from "@meerko/db";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const icypeasKey = process.env.ICYPEAS_API_KEY;
const publicUrl = process.env.MEERKO_PUBLIC_URL ?? `http://localhost:${port}`;
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
const app = createApp(createDb(), {
  icypeas: icypeasKey ? new IcypeasClient({ apiKey: icypeasKey }) : undefined,
  credits: { enabled: process.env.MEERKO_CREDITS === "on" },
  secretBox: SecretBox.fromEnv(),
  googleOAuth:
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? new GoogleOAuth({
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          redirectUri: new URL("/oauth/google/callback", publicUrl).toString(),
        })
      : undefined,
  tick: process.env.MEERKO_TICK_SECRET ? { secret: process.env.MEERKO_TICK_SECRET, publicUrl } : undefined,
  appUrl: process.env.MEERKO_APP_URL,
});

serve({ fetch: app.fetch, port }, () => console.log(`Meerko API listening on http://localhost:${port}`));
