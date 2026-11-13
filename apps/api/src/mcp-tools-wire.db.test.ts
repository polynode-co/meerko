import { randomBytes } from "node:crypto";
import { PostHog } from "posthog-node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey } from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { TOOL_ANNOTATIONS } from "@meerko/mcp/annotations";
import type { Analytics } from "./analytics.ts";
import { createApp } from "./app.ts";

type WireTool = { name: string; title?: string; annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean } };

// What the app directories read: `tools/list` from the hosted /mcp, as it goes over the wire. Checked with and without
// the PostHog MCP analytics wrapper (on in prd), since it rewrites every tool's input schema (#154).
describe.skipIf(!process.env.DATABASE_URL)("hosted MCP tools/list carries each tool's title and hints (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  let ws: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `wire-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "wire")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const posthog = new PostHog("phc_test", { disabled: true });
  const withPosthog: Analytics = { posthog, common: { app_env: "test" }, capture: async () => {}, captureException: async () => {} };

  for (const [label, opts] of [
    ["without analytics", {}],
    ["with PostHog MCP analytics", { analytics: withPosthog }],
  ] as const) {
    it(`sets annotations.title and the hints on every tool, ${label}`, async () => {
      const app = createApp(db, opts);
      const res = await app.request("/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
      expect(res.status).toBe(200);
      const tools = (await res.json()).result.tools as WireTool[];
      expect(tools.length).toBe(Object.keys(TOOL_ANNOTATIONS).length);
      for (const t of tools) {
        const want = TOOL_ANNOTATIONS[t.name];
        expect(want, t.name).toBeDefined();
        expect(t.annotations, t.name).toEqual(want);
        expect(t.title, t.name).toBe(want!.title);
      }
    });
  }
});
