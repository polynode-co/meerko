import { serve } from "@hono/node-server";
import { IcypeasClient, SecretBox } from "@meerko/core";
import { createDb } from "@meerko/db";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const icypeasKey = process.env.ICYPEAS_API_KEY;
const app = createApp(createDb(), {
  icypeas: icypeasKey ? new IcypeasClient({ apiKey: icypeasKey }) : undefined,
  credits: { enabled: process.env.MEERKO_CREDITS === "on" },
  secretBox: SecretBox.fromEnv(),
});

serve({ fetch: app.fetch, port }, () => console.log(`Meerko API listening on http://localhost:${port}`));
