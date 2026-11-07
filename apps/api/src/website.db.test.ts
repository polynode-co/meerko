import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey } from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("reading a website for the first-customers onboarding (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const page = `<title>Acme — Payroll for agencies</title><meta name="description" content="Payroll for creative agencies."><h1>Payroll agencies love</h1>`;
  const app = createApp(db, {
    websiteFetch: {
      resolve: async (host) => (host === "intranet.acme" ? ["10.0.0.1"] : ["93.184.216.34"]),
      fetch: (async () => new Response(page, { headers: { "content-type": "text/html" } })) as unknown as typeof fetch,
    },
  });
  let ws: string;
  let key: string;
  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `website-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "test")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });
  const read = (url: string) =>
    app.request("/v1/websites/read", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ url }) });

  it("returns the page's title, description and headings", async () => {
    const res = await read("acme.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: "https://acme.com/", title: "Acme — Payroll for agencies", description: "Payroll for creative agencies.", headings: ["Payroll agencies love"] });
  });

  it("refuses private addresses and nonsense with a readable message", async () => {
    const priv = await read("intranet.acme");
    expect(priv.status).toBe(422);
    expect(((await priv.json()) as { error: string }).error).toMatch(/public websites/);
    expect((await read("not a site")).status).toBe(422);
  });

  it("serves repeat reads from cache without counting them", async () => {
    for (let i = 0; i < 40; i++) expect((await read("acme.com")).status).toBe(200);
  });

  it("needs a credential", async () => {
    const res = await app.request("/v1/websites/read", { method: "POST", body: JSON.stringify({ url: "acme.com" }) });
    expect(res.status).toBe(401);
  });
});
