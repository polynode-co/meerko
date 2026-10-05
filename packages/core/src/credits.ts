import { creditLedger, eq, sql, workspaces, type Db } from "@meerko/db";
import type { EnrichField } from "./enrichment/types.ts";

/** Meerko credits ($1 = 100) charged per successful result. Misses are free. */
export const CREDIT_PRICES: Record<EnrichField, number> = { email: 8, email_verification: 1 };
export const FREE_TIER_CREDITS = 1000;

/** Self-hosters bring their own provider keys, so metering is off unless MEERKO_CREDITS=on. */
export interface CreditPolicy {
  enabled: boolean;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function getBalance(db: Db | Tx, workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ balance: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.workspaceId, workspaceId));
  return Number(row?.balance ?? 0);
}

export async function grantCredits(db: Db, workspaceId: string, amount: number, reason: string) {
  await db.insert(creditLedger).values({ workspaceId, delta: amount, reason });
}

/**
 * Debits credits for work that already happened, inside the caller's transaction.
 * Locks the workspace row so concurrent charges serialize; it never refuses, because the
 * provider has already been paid. Callers check the balance before starting the work.
 */
export async function chargeCredits(tx: Tx, workspaceId: string, amount: number, reason: string, refId?: string) {
  if (amount <= 0) return;
  await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).for("update");
  await tx.insert(creditLedger).values({ workspaceId, delta: -amount, reason, refId });
}
