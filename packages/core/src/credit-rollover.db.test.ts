import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, creditLedger, eq, workspaces, type Db } from "@meerko/db";
import { chargeCredits, expireCredits, getBalance, grantCredits, lapseMonthlyCredits, monthlyCreditsExpiry } from "./credits.ts";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("Pro credits roll over one month (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  let ws: string;
  const monthly = async (amount: number, grantedAt: Date) => {
    const [g] = await db
      .insert(creditLedger)
      .values({ workspaceId: ws, delta: amount, reason: "pro_monthly", expiresAt: monthlyCreditsExpiry(grantedAt), remaining: amount, createdAt: grantedAt })
      .returning();
    return g!;
  };
  const charge = (amount: number) => db.transaction((tx) => chargeCredits(tx, ws, amount, "test"));
  const remaining = async (id: string) => (await db.select({ r: creditLedger.remaining }).from(creditLedger).where(eq(creditLedger.id, id)))[0]!.r;

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: `rollover-${run}` }).returning())[0]!.id;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, `rollover-${run}`));
  });

  it("lapses what's left of a month's credits two months on, and never touches bought credits", async () => {
    await grantCredits(db, ws, 1000, "purchase");
    const now = new Date();
    const old = await monthly(100, new Date(now.getTime() - 70 * 86_400_000)); // already past its rollover month
    const fresh = await monthly(100, now);
    expect(monthlyCreditsExpiry(new Date("2026-01-15T00:00:00Z"))).toEqual(new Date("2026-03-15T00:00:00Z"));

    // Spending takes the soonest-expiring live grant first; the bought credits are untouched until it's gone.
    await charge(30);
    expect(await remaining(fresh.id)).toBe(70);
    expect(await remaining(old.id)).toBe(100); // lapsed grants aren't spent from

    expect(await expireCredits(db, now)).toMatchObject({ grants: 1, credits: 100 });
    expect(await getBalance(db, ws)).toBe(1000 + 100 + 100 - 30 - 100);
    expect(await expireCredits(db, now)).toMatchObject({ grants: 0, credits: 0 }); // once

    // Spending more than the monthly grant has falls through to the bought credits.
    await charge(100);
    expect(await remaining(fresh.id)).toBe(0);
    expect(await expireCredits(db, new Date(now.getTime() + 90 * 86_400_000))).toMatchObject({ credits: 0 });
    expect(await getBalance(db, ws)).toBe(970);
  });

  it("lapses all monthly credits when Pro ends, keeping bought ones", async () => {
    await grantCredits(db, ws, 1000, "purchase");
    await monthly(4900, new Date());
    await charge(900);
    expect(await getBalance(db, ws)).toBe(5000);
    expect(await lapseMonthlyCredits(db, ws)).toMatchObject({ credits: 4000 });
    expect(await getBalance(db, ws)).toBe(1000);
    const expired = await db.select().from(creditLedger).where(eq(creditLedger.workspaceId, ws));
    expect(expired.filter((e) => e.reason === "expired")).toMatchObject([{ delta: -4000 }]);
  });

  it("keeps monthly grants made before rollover existed (no expiry) forever", async () => {
    await db.insert(creditLedger).values({ workspaceId: ws, delta: 4900, reason: "pro_monthly" });
    await charge(100);
    await lapseMonthlyCredits(db, ws);
    expect(await expireCredits(db, new Date(Date.now() + 400 * 86_400_000))).toMatchObject({ credits: 0 });
    expect(await getBalance(db, ws)).toBe(4800);
  });
});
