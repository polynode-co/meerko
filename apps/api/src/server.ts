import { serve } from "@hono/node-server";
import { createDb } from "@meerko/db";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const app = createApp(createDb());

serve({ fetch: app.fetch, port }, () => console.log(`Meerko API listening on http://localhost:${port}`));
