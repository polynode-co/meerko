// The product events behind the lifecycle emails (src/lifecycle) that the API sends on its own: `credits_low` when
// metered work crosses CREDITS_LOW_AT, and `mailbox_disconnected` from the tick when a working mailbox loses its sign-in.
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createTable, CREDITS_LOW_AT, GenerectClient, grantCredits, insertRows, markMailboxError, SecretBox, type BillingConfig, type IcypeasClient } from "@meerko/core";
import { createDb, eq, mailboxes, memberships, users, workspaces, type Db } from "@meerko/db";
import type { Analytics } from "./analytics.ts";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("lifecycle email events (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const captured: Parameters<Analytics["capture"]>[0][] = [];
  const analytics = {
    posthog: {},
    common: { app_env: "test" },
    capture: async (e: Parameters<Analytics["capture"]>[0]) => void captured.push(e),
    captureException: async () => {},
  } as unknown as Analytics;
  // Icypeas finds nobody, so every email falls through to a Generect that finds one: 5 credits per enrich.
  const icypeasMiss = { emailSearch: async () => ({ status: "NOT_FOUND", emails: [] }) } as unknown as IcypeasClient;
  const generectFetch = (async () => Response.json({ data: { valid_email: "ana@acme.es", result: "valid", catch_all: false } })) as unknown as typeof fetch;
  const app = createApp(db, {
    analytics,
    billing: {} as BillingConfig,
    credits: { enabled: true },
    secretBox: new SecretBox(randomBytes(32).toString("base64")),
    icypeas: icypeasMiss,
    icypeasForKey: () => icypeasMiss,
    generect: new GenerectClient({ apiKey: "k", fetch: generectFetch }),
    tick: { secret: "tick-secret", publicUrl: "https://api.example" },
  });
  let ws: string;
  let owner: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `lifecycle-${run}` }).returning())[0]!.id;
    owner = (await db.insert(users).values({ email: `owner-${run}@acme.example` }).returning())[0]!.id;
    await db.insert(memberships).values({ userId: owner, workspaceId: ws, role: "owner" });
    key = (await createApiKey(db, ws, "test")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
    await db.delete(users).where(eq(users.id, owner));
  });

  const call = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });
  const enrichOne = async () => {
    const tableId = (await createTable(db, ws, { name: `leads-${randomBytes(3).toString("hex")}` })).id;
    await insertRows(db, ws, tableId, [{ first_name: "Ana", last_name: "Ruiz", domain: "acme.es", company: "Acme" }]);
    expect((await call(`/v1/tables/${tableId}/enrich`, { method: "POST", body: JSON.stringify({ fields: ["email"], limit: 1 }) })).status).toBe(200);
  };
  const lows = () => captured.filter((e) => e.event === "credits_low" && e.workspaceId === ws);

  it("sends credits_low to the owner once, on the charge that crosses the threshold", async () => {
    await grantCredits(db, ws, CREDITS_LOW_AT + 5, "test");
    await enrichOne(); // 45 -> 40: not under yet
    expect(lows()).toEqual([]);
    await enrichOne(); // 40 -> 35: crosses
    expect(lows()).toEqual([expect.objectContaining({ distinctId: owner, properties: { balance: CREDITS_LOW_AT - 5, threshold: CREDITS_LOW_AT } })]);
    await enrichOne(); // 35 -> 30: already under
    expect(lows()).toHaveLength(1);
  });

  it("sends mailbox_disconnected to the owner from the tick, once per disconnect", async () => {
    const mailboxId = (await db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail_imap", email: `box-${run}@acme.example`, encryptedPassword: "x" }).returning())[0]!.id;
    const tick = () => app.request("/internal/tick?replies=0", { method: "POST", headers: { authorization: "Bearer tick-secret" } });
    const mine = () => captured.filter((e) => e.event === "mailbox_disconnected" && e.workspaceId === ws);

    expect((await tick()).status).toBe(200);
    expect(mine()).toEqual([]);
    await markMailboxError(db, mailboxId, "invalid credentials");
    await tick();
    await tick();
    expect(mine()).toEqual([expect.objectContaining({ distinctId: owner, properties: { provider: "gmail_imap", mailbox: `box-${run}@acme.example` } })]);
  });
});
