import { creditLedger, eq, sql, workspaces, type Db } from "@meerko/db";
import type { EnrichField } from "./enrichment/types.ts";
import { billingWorkspaceOf } from "./workspaces.ts";

/**
 * Meerko credits ($1 = 100) charged per successful result, whichever provider found it. Misses are free.
 * Margins at the providers' standard prices: an email costs us $0.009 on Icypeas and $0.02 on Generect (89% and 75% of
 * the 8 credits); a phone costs $0.40 on Generect, so 80 credits keeps about half after Stripe's fee.
 */
export const CREDIT_PRICES: Record<EnrichField, number> = { email: 8, email_verification: 1, phone: 80 };
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
}
