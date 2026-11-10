import { and, asc, creditLedger, eq, gt, isNotNull, lte, sql, workspaces, type Db } from "@meerko/db";
import type { EnrichField } from "./enrichment/types.ts";
import { billingWorkspaceOf } from "./workspaces.ts";

/**
 * Meerko credits ($1 = 100) charged per successful result, whichever provider found it. Misses are free.
 * Margins at the providers' standard prices: an email costs us $0.009 on Icypeas and $0.02 on Generect (82% and 60% of
 * the 5 credits); a phone costs $0.40 on Generect, so 80 credits keeps about half after Stripe's fee.
 */
export const CREDIT_PRICES: Record<EnrichField, number> = { email: 5, email_verification: 1, phone: 80 };
/** Per person/company returned by a lead search (Icypeas charges us per result too). Counts are free. */
export const SEARCH_RESULT_CREDITS = 1;
export const FREE_TIER_CREDITS = 200;

export class InsufficientCreditsError extends Error {
  constructor(readonly balance: number, readonly needed: number) {
    super(`Not enough credits: ${balance} available, at least ${needed} needed`);
  }
}

/** Self-hosters bring their own provider keys, so metering is off unless MEERKO_CREDITS=on. */
export interface CreditPolicy {
  enabled: boolean;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Balances live on the workspace that pays (`billingWorkspaceOf`), so a person's workspaces share one. */
export async function getBalance(db: Db | Tx, workspaceId: string): Promise<number> {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const [row] = await db
    .select({ balance: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.workspaceId, workspaceId));
  return Number(row?.balance ?? 0);
}

export async function grantCredits(db: Db, workspaceId: string, amount: number, reason: string) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  await db.insert(creditLedger).values({ workspaceId, delta: amount, reason });
}

/**
 * Debits credits for work that already happened, inside the caller's transaction.
 * Locks the workspace row so concurrent charges serialize; it never refuses, because the
 * provider has already been paid. Callers check the balance before starting the work.
 */
export async function chargeCredits(tx: Tx, workspaceId: string, amount: number, reason: string, refId?: string) {
  if (amount <= 0) return;
  workspaceId = await billingWorkspaceOf(tx, workspaceId);
  await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).for("update");
  await tx.insert(creditLedger).values({ workspaceId, delta: -amount, reason, refId });
  await spendExpiring(tx, workspaceId, amount);
}

/** Pro's monthly credits roll over one month: each grant lapses two months after it's made (or when Pro ends). */
export const MONTHLY_CREDIT_MONTHS = 2;

export function monthlyCreditsExpiry(grantedAt: Date) {
  const d = new Date(grantedAt);
  d.setUTCMonth(d.getUTCMonth() + MONTHLY_CREDIT_MONTHS);
  return d;
}

/**
 * Spending takes the soonest-expiring credits first, so what lapses is only what was never needed. Credits that never
 * expire need no tracking: the balance is still the sum of the ledger.
 */
async function spendExpiring(tx: Tx, workspaceId: string, amount: number) {
  const grants = await tx
    .select({ id: creditLedger.id, remaining: creditLedger.remaining })
    .from(creditLedger)
    .where(and(eq(creditLedger.workspaceId, workspaceId), isNotNull(creditLedger.expiresAt), gt(creditLedger.remaining, 0), gt(creditLedger.expiresAt, sql`now()`)))
    .orderBy(asc(creditLedger.expiresAt), asc(creditLedger.createdAt));
  for (const g of grants) {
    if (amount <= 0) break;
    const take = Math.min(amount, g.remaining!);
    await tx.update(creditLedger).set({ remaining: g.remaining! - take }).where(eq(creditLedger.id, g.id));
    amount -= take;
  }
}

/**
 * Takes away what's left of lapsed grants: one `expired` debit per grant, so the balance stays the sum of the ledger and
 * the history says why. Runs on every tick; a grant is expired once.
 */
export async function expireCredits(db: Db, now = new Date()) {
  const due = await db
    .select({ id: creditLedger.id, workspaceId: creditLedger.workspaceId })
    .from(creditLedger)
    .where(and(isNotNull(creditLedger.expiresAt), gt(creditLedger.remaining, 0), lte(creditLedger.expiresAt, now)));
  let expired = 0;
  for (const g of due) {
    await db.transaction(async (tx) => {
      await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, g.workspaceId)).for("update");
      const [grant] = await tx.select({ remaining: creditLedger.remaining }).from(creditLedger).where(eq(creditLedger.id, g.id)).for("update");
      const left = grant?.remaining ?? 0;
      if (left <= 0) return;
      await tx.insert(creditLedger).values({ workspaceId: g.workspaceId, delta: -left, reason: "expired", refId: g.id });
      await tx.update(creditLedger).set({ remaining: 0 }).where(eq(creditLedger.id, g.id));
      expired += left;
    });
  }
  return { grants: due.length, credits: expired };
}

/** When Pro ends, its monthly credits lapse with it (bought credits stay). */
export async function lapseMonthlyCredits(db: Db, workspaceId: string, now = new Date()) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  await db
    .update(creditLedger)
    .set({ expiresAt: now })
    .where(and(eq(creditLedger.workspaceId, workspaceId), isNotNull(creditLedger.expiresAt), gt(creditLedger.remaining, 0), gt(creditLedger.expiresAt, now)));
  return expireCredits(db, now);
}
