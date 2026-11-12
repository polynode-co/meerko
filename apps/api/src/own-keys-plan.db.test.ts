import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createTable, FirecrawlClient, getBalance, grantCredits, insertRows, SecretBox, setPlan, setProviderKey, STRIPE_API_VERSION, type BillingConfig } from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

// On Meerko Cloud (billing on), a workspace's own provider keys are a Pro feature. Self-hosted (no billing) they always work.
describe.skipIf(!process.env.DATABASE_URL)("own provider keys are Pro-only on Cloud (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const box = new SecretBox(randomBytes(32).toString("base64"));
  // Fake Firecrawl: the catalog check passes and the work-email tool finds ana@acme.es.
  const firecrawlFetch = (async (url: string) => {
    if (url.endsWith("/search")) return Response.json({ success: true, data: { tools: [] } });
    return Response.json({ success: true, data: { alexandria: [{ data: { results: [{ contact_info: { most_probable_work_email: { email: "ana@acme.es", status: "DELIVERABLE" } } }] } }], creditsCost: 30 } });
  }) as typeof fetch;
  // Stripe is never called here; the config only turns billing (and its plan limits) on.
  const stripe = new Stripe("sk_test_fake", { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 0 });
  const billing: BillingConfig = { stripe, webhookSecret: "whsec_test", prices: { pro: "price_pro", credits: "price_credits" }, appUrl: "https://app.example" };
  const firecrawlForKey = (apiKey: string) => new FirecrawlClient({ apiKey, fetch: firecrawlFetch });
  // No server Icypeas key, so the only way to find an email is the workspace's own Firecrawl key.
  const cloud = createApp(db, { billing, secretBox: box, credits: { enabled: true }, firecrawlForKey });
  const selfHosted = createApp(db, { secretBox: box, firecrawlForKey });
  let ws: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `own-keys-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "test")).key;
    await grantCredits(db, ws, 50, "test");
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const call = (app: typeof cloud, path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });
  const enrich = async (app: typeof cloud) => {
    const tableId = (await createTable(db, ws, { name: `leads-${randomBytes(3).toString("hex")}` })).id;
    await insertRows(db, ws, tableId, [{ first_name: "Ana", last_name: "Ruiz", domain: "acme.es" }]);
    return call(app, `/v1/tables/${tableId}/enrich`, { method: "POST", body: JSON.stringify({ fields: ["email"], limit: 10 }) });
  };

  it("refuses to store a key on Free, pointing at Pro and self-hosting", async () => {
    const res = await call(cloud, "/v1/provider-keys/firecrawl", { method: "PUT", body: JSON.stringify({ key: "fc-good-1234" }) });
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/Pro plan.*Self-hosted/);
  });

  it("ignores a key stored before, while the workspace is on Free", async () => {
    await setProviderKey(db, box, ws, "firecrawl", "fc-old-5678");
    const res = await enrich(cloud);
    expect(res.status).toBe(503); // No server key and the own key is paused: nothing can look the email up.
    expect(await getBalance(db, ws)).toBe(50);
  });

  it("runs on the key on Pro, with no credits charged", async () => {
    await setPlan(db, ws, "pro");
    const put = await call(cloud, "/v1/provider-keys/firecrawl", { method: "PUT", body: JSON.stringify({ key: "fc-good-1234" }) });
    expect(put.status).toBe(200);
    const res = await enrich(cloud);
    expect(await res.json()).toMatchObject({ found: { email: 1 }, creditsSpent: 0 });
    await setPlan(db, ws, "free");
  });

  it("always uses own keys when self-hosted", async () => {
    const res = await enrich(selfHosted);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ found: { email: 1 } });
  });
});
