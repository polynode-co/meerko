import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrichmentRuns, eq, workspaces, type Db } from "@meerko/db";
import { getBalance, grantCredits } from "./credits.ts";
import { enrichRows } from "./enrich.ts";
import type { EnrichmentProvider } from "./enrichment/types.ts";
import { createTable, insertRows, queryRows } from "./tables.ts";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("enrichRows (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  let workspaceId: string;
  let tableId: string;
  let calls: string[];

  /** Finds emails for anyone but "Nobody"; verifies everything as `probable`. */
  const provider: EnrichmentProvider = {
    name: "fake",
    supports: ["email", "email_verification"],
    async enrich(field, row) {
      calls.push(`${field}:${row.first_name}`);
      if (field === "email_verification") return { value: "probable", providerCost: 0.1 };
      if (row.first_name === "Nobody") return { value: null, providerCost: 0 };
      const certainty = row.first_name === "Pia" ? "ultra_sure" : "probable";
      return { value: `${String(row.first_name).toLowerCase()}@${row.domain}`, confidence: certainty, providerCost: 1 };
    },
  };

  beforeEach(async () => {
    calls = [];
    const [ws] = await db.insert(workspaces).values({ name: "enrich-test" }).returning();
    workspaceId = ws!.id;
    tableId = (await createTable(db, workspaceId, { name: "leads" })).id;
    await insertRows(db, workspaceId, tableId, [
      { first_name: "Pia", last_name: "Moll", domain: "slalom.example" },
      { first_name: "Paula", last_name: "Ortiz", domain: "webon.example" },
      { first_name: "Nobody", last_name: "Here", domain: "x.com" },
      { first_name: "Already", email: "known@x.com", email_verification: "ultra_sure" },
    ]);
  });

  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "enrich-test"));
  });

  const rowsByName = async () =>
    Object.fromEntries((await queryRows(db, workspaceId, tableId)).map((r) => [r.data.first_name, r.data]));

  it("writes results, charges only for hits, reuses high-certainty verdicts and skips done rows", async () => {
    await grantCredits(db, workspaceId, 100, "test");
    const res = await enrichRows(db, workspaceId, tableId, [provider], { fields: ["email", "email_verification"], limit: 25 }, { enabled: true });

    // Pia: email (5) + reused verdict (0). Paula: email (5) + verification (1). Nobody: miss (0).
    expect(res).toMatchObject({ processed: 3, found: { email: 2, email_verification: 1 }, notFound: 1, creditsSpent: 11, remaining: 0, balance: 89 });
    expect(await getBalance(db, workspaceId)).toBe(89);
    expect(calls).toEqual(["email:Pia", "email:Paula", "email_verification:Paula", "email:Nobody"]);

    const rows = await rowsByName();
    expect(rows.Pia).toMatchObject({ email: "pia@slalom.example", email_certainty: "ultra_sure", email_verification: "ultra_sure" });
    expect(rows.Paula).toMatchObject({ email_certainty: "probable", email_verification: "probable" });
    expect(rows.Nobody).toMatchObject({ email_certainty: "not_found" });
    expect(rows.Nobody!.email).toBeUndefined();

    // A second call has nothing left to do and costs nothing.
    calls = [];
    const again = await enrichRows(db, workspaceId, tableId, [provider], { fields: ["email", "email_verification"], limit: 25 }, { enabled: true });
    expect(again).toMatchObject({ processed: 0, creditsSpent: 0, balance: 89 });
    expect(calls).toEqual([]);
  });

  it("stops before a paid call it can't afford, and leaves the rest for later", async () => {
    await grantCredits(db, workspaceId, 7, "test");
    const res = await enrichRows(db, workspaceId, tableId, [provider], { fields: ["email"], limit: 25 }, { enabled: true });
    expect(res).toMatchObject({ processed: 1, creditsSpent: 5, balance: 2, stoppedReason: "insufficient_credits", remaining: 2 });
  });

  it("doesn't charge for what a provider on the workspace's own key finds, even with no credits left", async () => {
    // The metered provider misses everyone; the own-key one (Firecrawl) finds them.
    const metered: EnrichmentProvider = { name: "metered", supports: ["email"], enrich: async () => ({ value: null, providerCost: 0 }) };
    const own: EnrichmentProvider = {
      name: "own",
      supports: ["email"],
      ownKey: true,
      enrich: async (_field, row) => ({ value: row.first_name === "Nobody" ? null : `${row.first_name}@own.test`, confidence: "probable", providerCost: 5 }),
    };
    await grantCredits(db, workspaceId, 8, "test");
    const res = await enrichRows(db, workspaceId, tableId, [metered, own], { fields: ["email"], limit: 25 }, { enabled: true });
    expect(res).toMatchObject({ processed: 3, found: { email: 2 }, creditsSpent: 0, balance: 8 });

    // With 0 credits, only the own-key provider runs instead of stopping.
    const [ws] = await db.insert(workspaces).values({ name: "enrich-test" }).returning();
    const t = (await createTable(db, ws!.id, { name: "leads" })).id;
    await insertRows(db, ws!.id, t, [{ first_name: "Ana", last_name: "Ruiz", domain: "acme.es" }]);
    const broke = await enrichRows(db, ws!.id, t, [metered, own], { fields: ["email"], limit: 25 }, { enabled: true });
    expect(broke).toMatchObject({ processed: 1, found: { email: 1 }, creditsSpent: 0 });
    expect(broke.stoppedReason).toBeUndefined();
  });

  it("doesn't meter when credits are off, but still logs provider runs", async () => {
    const res = await enrichRows(db, workspaceId, tableId, [provider], { fields: ["email"], limit: 25 }, { enabled: false });
    expect(res).toMatchObject({ processed: 3, creditsSpent: 0 });
    expect(res.balance).toBeUndefined();
    const runs = await db.select().from(enrichmentRuns);
    expect(runs.filter((r) => r.provider === "fake" && r.outcome === "found").length).toBeGreaterThanOrEqual(2);
  });
});
