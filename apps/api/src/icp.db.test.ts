import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createTable, FirecrawlClient, insertRows, queryRows, SecretBox } from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("ICP fit scores (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  // Fake Firecrawl: every lookup finds an email, so we can see which rows were enriched.
  const firecrawlFetch = (async (url: string) =>
    url.endsWith("/search")
      ? Response.json({ success: true, data: { tools: [] } })
      : Response.json({ success: true, data: { alexandria: [{ data: { results: [{ contact_info: { most_probable_work_email: { email: "x@acme.es", status: "DELIVERABLE" } } }] } }], creditsCost: 1 } })) as typeof fetch;
  const app = createApp(db, { secretBox: new SecretBox(randomBytes(32).toString("base64")), firecrawlForKey: (apiKey) => new FirecrawlClient({ apiKey, fetch: firecrawlFetch }) });
  let ws: string;
  let key: string;
  let tableId: string;
  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `icp-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "test")).key;
    tableId = (await createTable(db, ws, { name: "leads" })).id;
    await insertRows(db, ws, tableId, [
      { first_name: "Edna", last_name: "V", domain: "vive.com", title: "Founder", industry: "Wellness and Fitness Services", company_size: 2, location: "Chicago, United States" },
      { first_name: "Virginia", last_name: "P", domain: "atelier-norte.example", title: "Influencer Marketing", industry: "Retail Apparel and Fashion", company_size: 8, location: "Madrid, Espagne" },
      { first_name: "Manuel", last_name: "B", domain: "indigowash.example", title: "Owner", company: "Indigo Wash Laundry", industry: "Retail Apparel and Fashion", company_size: 2, location: "Los Angeles, United States" },
    ]);
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });
  const call = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });
  const scores = async () =>
    Object.fromEntries(((await (await call(`/v1/tables/${tableId}/rows`)).json()) as { rows: { data: { first_name: string }; icp: { score: number | null } }[] }).rows.map((r) => [r.data.first_name, r.icp.score]));

  it("has no scores until there's an ICP", async () => {
    expect(await (await call("/v1/icp")).json()).toEqual({ icp: null });
    expect(await scores()).toEqual({ Edna: null, Virginia: null, Manuel: null });
  });

  it("scores every row once the ICP is set", async () => {
    const res = await call("/v1/icp", {
      method: "PUT",
      body: JSON.stringify({ industries: ["Wellness and Fitness Services", "Retail Apparel and Fashion"], countries: ["us", "ES"], headcount: { min: 1, max: 10 }, titles: ["Founder", "Owner"], exclude: ["laundry"], keywords: [] }),
    });
    expect(res.status).toBe(200);
    const { icp } = (await res.json()) as { icp: Record<string, unknown> };
    expect(icp.countries).toEqual(["US", "ES"]);
    expect(icp).not.toHaveProperty("keywords");
    expect(await scores()).toEqual({ Edna: 100, Virginia: 72, Manuel: 10 });
  });

  it("takes the agent's judgement, within ±30", async () => {
    const rows = await queryRows(db, ws, tableId);
    const virginia = rows.find((r) => r.data.first_name === "Virginia")!;
    expect((await call(`/v1/tables/${tableId}/icp-review`, { method: "POST", body: JSON.stringify({ rows: [{ row_id: virginia.id, adjust: 50 }] }) })).status).toBe(400);
    const ok = await call(`/v1/tables/${tableId}/icp-review`, { method: "POST", body: JSON.stringify({ rows: [{ row_id: virginia.id, adjust: -20, note: "runs influencers, not the brand" }] }) });
    expect(await ok.json()).toEqual({ updated: 1 });
    const read = ((await (await call(`/v1/tables/${tableId}/rows`)).json()) as { rows: { id: string; icp: Record<string, unknown> }[] }).rows.find((r) => r.id === virginia.id)!;
    expect(read.icp).toMatchObject({ score: 52, base: 72, adjust: -20, note: "runs influencers, not the brand" });
  });

  it("enriches only good fits when asked", async () => {
    await call("/v1/provider-keys/firecrawl", { method: "PUT", body: JSON.stringify({ key: "fc-good-1234" }) });
    const res = await call(`/v1/tables/${tableId}/enrich`, { method: "POST", body: JSON.stringify({ fields: ["email"], min_icp_score: 70 }) });
    expect(await res.json()).toMatchObject({ processed: 1, found: { email: 1 }, remaining: 0 });
    const withEmail = (await queryRows(db, ws, tableId)).filter((r) => r.data.email).map((r) => r.data.first_name);
    expect(withEmail).toEqual(["Edna"]);
  });

  it("clears it", async () => {
    expect(await (await call("/v1/icp", { method: "DELETE" })).json()).toEqual({ cleared: true });
    expect((await scores()).Edna).toBeNull();
  });
});
