import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createApiKey,
  createTable,
  GenerectClient,
  getBalance,
  grantCredits,
  insertRows,
  queryRows,
  SecretBox,
  setPlan,
  type BillingConfig,
  type IcypeasClient,
} from "@meerko/core";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("Generect: missed emails and phone numbers (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const sent: { path: string; auth: string | null }[] = [];
  // Fake Generect: `bad-key-0000` is refused; it finds ana@acme.es and +34600111222.
  const generectFetch = (async (url: string, init: RequestInit) => {
    const auth = new Headers(init.headers).get("authorization");
    const path = new URL(url).pathname;
    sent.push({ path, auth });
    if (auth === "Token bad-key-0000") return Response.json({ status: "error", status_code: 401, detail: "Invalid token." }, { status: 401 });
    if (path === "/api/v1/accounts/me/") return Response.json({ data: { balance: 10 } });
    if (path === "/api/v1/phone/find/") {
      return Response.json({ data: { phone: { number: "+34600111222", status: "FOUND", type: "mobile", country: "ES" } }, meta: { amount_charged: 0.4 } });
    }
    return Response.json({ data: { valid_email: "ana@acme.es", result: "valid", catch_all: false }, meta: { amount_charged: 0.02 } });
  }) as typeof fetch;
  const generect = (apiKey: string) => new GenerectClient({ apiKey, fetch: generectFetch });
  // An Icypeas that never finds anyone, so every email falls through to Generect.
  const icypeasMiss = {
    emailSearch: async () => ({ status: "NOT_FOUND", emails: [] }),
    countCompanies: async () => 1,
  } as unknown as IcypeasClient;

  // As on Meerko Cloud: billing and metering on, Meerko's own Icypeas and Generect keys.
  const app = createApp(db, {
    billing: {} as BillingConfig,
    credits: { enabled: true },
    secretBox: new SecretBox(randomBytes(32).toString("base64")),
    icypeas: icypeasMiss,
    icypeasForKey: () => icypeasMiss,
    generect: generect("meerko-server-key"),
    generectForKey: generect,
  });
  let ws: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `generect-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "test")).key;
    await grantCredits(db, ws, 500, "test");
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const call = (path: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });
  const enrich = (tableId: string, fields: string[]) => call(`/v1/tables/${tableId}/enrich`, { method: "POST", body: JSON.stringify({ fields, limit: 10 }) });
  const newTable = async () => {
    const tableId = (await createTable(db, ws, { name: `leads-${randomBytes(3).toString("hex")}` })).id;
    await insertRows(db, ws, tableId, [{ first_name: "Ana", last_name: "Ruiz", domain: "acme.es", company: "Acme" }]);
    return tableId;
  };

  it("finds the emails Icypeas missed on Meerko's key, at the usual 8 credits", async () => {
    const tableId = await newTable();
    const before = await getBalance(db, ws);
    const res = await enrich(tableId, ["email"]);
    expect(await res.json()).toMatchObject({ found: { email: 1 }, creditsSpent: 8 });
    expect(sent.at(-1)).toEqual({ path: "/api/v1/email/find/", auth: "Token meerko-server-key" });
    expect((await queryRows(db, ws, tableId))[0]!.data).toMatchObject({ email: "ana@acme.es", email_certainty: "very_sure" });
    expect(await getBalance(db, ws)).toBe(before - 8);
  });

  it("keeps phones on Pro, then charges 80 credits per number found", async () => {
    const tableId = await newTable();
    const free = await enrich(tableId, ["phone"]);
    expect(free.status).toBe(402);
    expect((await free.json()).error).toContain("Pro");

    await setPlan(db, ws, "pro");
    const before = await getBalance(db, ws);
    const res = await enrich(tableId, ["phone"]);
    expect(await res.json()).toMatchObject({ found: { phone: 1 }, creditsSpent: 80 });
    expect((await queryRows(db, ws, tableId))[0]!.data).toMatchObject({ phone: "+34600111222", phone_type: "mobile" });
    expect(await getBalance(db, ws)).toBe(before - 80);
    await setPlan(db, ws, "free");
  });

  it("an own Icypeas key doesn't make Meerko's Generect free", async () => {
    await call("/v1/provider-keys/icypeas", { method: "PUT", body: JSON.stringify({ key: "icy-own-1234" }) });
    const tableId = await newTable();
    const res = await enrich(tableId, ["email"]);
    expect(await res.json()).toMatchObject({ found: { email: 1 }, creditsSpent: 8 });
    await call("/v1/provider-keys/icypeas", { method: "DELETE" });
  });

  it("checks an own Generect key, then runs phones on it on Free without credits", async () => {
    const bad = await call("/v1/provider-keys/generect", { method: "PUT", body: JSON.stringify({ key: "bad-key-0000" }) });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toContain("Generect rejected this key");

    const ok = await call("/v1/provider-keys/generect", { method: "PUT", body: JSON.stringify({ key: "gen-own-5678" }) });
    expect(await ok.json()).toEqual({ provider: "generect", last4: "5678" });
    expect(sent.at(-1)).toEqual({ path: "/api/v1/accounts/me/", auth: "Token gen-own-5678" });

    const tableId = await newTable();
    const before = await getBalance(db, ws);
    const res = await enrich(tableId, ["phone", "email"]);
    expect(await res.json()).toMatchObject({ found: { phone: 1, email: 1 }, creditsSpent: 0 });
    expect(sent.at(-1)!.auth).toBe("Token gen-own-5678");
    expect(await getBalance(db, ws)).toBe(before);
  });
});
