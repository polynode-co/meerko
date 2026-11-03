import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createTable, FirecrawlClient, getBalance, grantCredits, insertRows, queryRows, SecretBox } from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("Firecrawl as an own-key enrichment step (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const sent: { path: string; auth: string | null }[] = [];
  // Fake Firecrawl: `bad-key` is refused; the work-email tool finds ana@acme.es.
  const firecrawlFetch = (async (url: string, init: RequestInit) => {
    const auth = new Headers(init.headers).get("authorization");
    sent.push({ path: new URL(url).pathname, auth });
    if (auth === "Bearer bad-key-0000") return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (url.endsWith("/search")) return Response.json({ success: true, data: { tools: [] } });
    return Response.json({ success: true, data: { alexandria: [{ data: { contact_info: { most_probable_work_email: { email: "ana@acme.es", status: "DELIVERABLE" } } } }], creditsCost: 20 } });
  }) as typeof fetch;
  // No server Icypeas key: Firecrawl alone has to be enough. Credits on, as on Meerko Cloud.
  const app = createApp(db, {
    secretBox: new SecretBox(randomBytes(32).toString("base64")),
    credits: { enabled: true },
    firecrawlForKey: (apiKey) => new FirecrawlClient({ apiKey, fetch: firecrawlFetch }),
  });
  let ws: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `firecrawl-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "test")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const call = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });

  it("checks the key before storing it", async () => {
    const bad = await call("/v1/provider-keys/firecrawl", { method: "PUT", body: JSON.stringify({ key: "bad-key-0000" }) });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toContain("Firecrawl rejected this key");

    const ok = await call("/v1/provider-keys/firecrawl", { method: "PUT", body: JSON.stringify({ key: "fc-good-1234" }) });
    expect(await ok.json()).toEqual({ provider: "firecrawl", last4: "1234" });
    expect(sent.at(-1)).toEqual({ path: "/v2/search", auth: "Bearer fc-good-1234" });
  });

  it("finds emails on the workspace's key without charging credits", async () => {
    await grantCredits(db, ws, 50, "test");
    const tableId = (await createTable(db, ws, { name: "leads" })).id;
    await insertRows(db, ws, tableId, [{ first_name: "Ana", last_name: "Ruiz", domain: "acme.es" }]);

    const res = await call(`/v1/tables/${tableId}/enrich`, { method: "POST", body: JSON.stringify({ fields: ["email"], limit: 10 }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ found: { email: 1 }, creditsSpent: 0 });
    expect(sent.at(-1)).toEqual({ path: "/v2/scrape", auth: "Bearer fc-good-1234" });
    expect((await queryRows(db, ws, tableId))[0]!.data).toMatchObject({ email: "ana@acme.es", email_certainty: "very_sure" });
    expect(await getBalance(db, ws)).toBe(50);
  });
});
