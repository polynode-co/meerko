import { and, enrichmentRuns, eq, sql, tableRows, type ColumnDef, type Db, type SQL } from "@meerko/db";
import { chargeCredits, CREDIT_PRICES, getBalance, type CreditPolicy } from "./credits.ts";
import type { EnrichField, EnrichmentProvider } from "./enrichment/types.ts";
import { runWaterfall } from "./enrichment/waterfall.ts";
import { addColumn, getTable } from "./tables.ts";

/** Columns each field writes. Certainty is kept next to the email so users can filter on it. */
const OUTPUT_COLUMNS: Record<EnrichField, Omit<ColumnDef, "key">[]> = {
  email: [
    { name: "email", type: "email" },
    { name: "email_certainty", type: "text" },
  ],
  email_verification: [{ name: "email_verification", type: "text" }],
};

/** Search certainties that already mean "verified", so re-verifying would only burn credits. */
const VERIFIED = new Set(["ultra_sure", "very_sure"]);

// A row needs a field when its output is still empty. Misses record `email_certainty: not_found`,
// so rows that already missed aren't retried (and re-billed for provider time) on every call.
const NEEDS: Record<EnrichField, SQL> = {
  email: sql`coalesce(${tableRows.data}->>'email', '') = '' and ${tableRows.data}->>'email_certainty' is null`,
  email_verification: sql`coalesce(${tableRows.data}->>'email', '') <> '' and ${tableRows.data}->>'email_verification' is null`,
};

export interface EnrichRowsInput {
  fields: EnrichField[];
  /** Exact-match filter on row data, like queryRows. */
  filter?: Record<string, unknown>;
  limit: number;
  /** Re-run fields on rows that already have a value. */
  overwrite?: boolean;
}

export interface EnrichRowsResult {
  processed: number;
  found: Record<EnrichField, number>;
  notFound: number;
  errors: number;
  firstError?: string;
  creditsSpent: number;
  /** Rows in the selection that still need a field, i.e. call again to continue. */
  remaining: number;
  stoppedReason?: "insufficient_credits";
  balance?: number;
}

/**
 * Enriches rows one at a time through the provider waterfall, writing results back to the row.
 * Credits are charged only for successful results, in the same transaction as the row update.
 */
export async function enrichRows(
  db: Db,
  workspaceId: string,
  tableId: string,
  providers: EnrichmentProvider[],
  input: EnrichRowsInput,
  policy: CreditPolicy,
): Promise<EnrichRowsResult> {
  await getTable(db, workspaceId, tableId);
  for (const field of input.fields) for (const col of OUTPUT_COLUMNS[field]) await addColumn(db, workspaceId, tableId, col);

  const selection = (needsOnly: boolean) => {
    const conds: SQL[] = [eq(tableRows.tableId, tableId)];
    if (input.filter && Object.keys(input.filter).length > 0) conds.push(sql`${tableRows.data} @> ${JSON.stringify(input.filter)}::jsonb`);
    if (needsOnly) conds.push(sql`(${sql.join(input.fields.map((f) => sql`(${NEEDS[f]})`), sql` or `)})`);
    return and(...conds);
  };

  const rows = await db
    .select({ id: tableRows.id, data: tableRows.data })
    .from(tableRows)
    .where(selection(!input.overwrite))
    .orderBy(tableRows.seq)
    .limit(input.limit);

  const result: EnrichRowsResult = {
    processed: 0,
    found: { email: 0, email_verification: 0 },
    notFound: 0,
    errors: 0,
    creditsSpent: 0,
    remaining: 0,
  };

  rowLoop: for (const row of rows) {
    const data = { ...row.data };
    for (const field of input.fields) {
      if (!input.overwrite && !needs(field, data)) continue;
      if (field === "email_verification" && !data.email) continue;

      // An email found with high certainty is already verified: copy the verdict, free.
      if (field === "email_verification" && !input.overwrite && VERIFIED.has(String(data.email_certainty))) {
        await writeResult(db, row.id, field, { email_verification: data.email_certainty }, "reused", null, 0, 0);
        data.email_verification = data.email_certainty;
        continue;
      }

      const price = CREDIT_PRICES[field];
      if (policy.enabled && (await getBalance(db, workspaceId)) < price) {
        result.stoppedReason = "insufficient_credits";
        break rowLoop;
      }

      const run = await runWaterfall(providers, field, data);
      if (run.value !== null && run.value !== undefined) {
        const patch =
          field === "email"
            ? { email: run.value, email_certainty: run.confidence ?? null }
            : { email_verification: run.value };
        const cost = policy.enabled ? price : 0;
        await db.transaction(async (tx) => {
          await writeResult(tx, row.id, field, patch, "found", run.provider, run.providerCost, cost);
          await chargeCredits(tx, workspaceId, cost, `enrich:${field}`, row.id);
        });
        Object.assign(data, patch);
        result.found[field] += 1;
        result.creditsSpent += cost;
      } else if (run.attempts.some((a) => a.outcome === "not_found")) {
        const patch = field === "email" ? { email_certainty: "not_found" } : { email_verification: "not_found" };
        await writeResult(db, row.id, field, patch, "not_found", null, run.providerCost, 0);
        Object.assign(data, patch);
        result.notFound += 1;
      } else if (run.attempts.some((a) => a.outcome === "error")) {
        // Leave the row untouched so the next call retries it.
        result.errors += 1;
        result.firstError ??= run.attempts.find((a) => a.error)?.error;
      } else if (field === "email") {
        // Every provider lacked input (e.g. no domain). Mark it so the row leaves `remaining`;
        // `overwrite` retries it after the user fills the gap.
        const patch = { email_certainty: "missing_input" };
        await writeResult(db, row.id, field, patch, "skipped", null, 0, 0);
        Object.assign(data, patch);
      }
    }
    result.processed += 1;
  }

  const [left] = await db.select({ n: sql<string>`count(*)` }).from(tableRows).where(selection(true));
  result.remaining = Number(left?.n ?? 0);
  if (policy.enabled) result.balance = await getBalance(db, workspaceId);
  return result;
}

function needs(field: EnrichField, data: Record<string, unknown>) {
  const empty = (v: unknown) => v === null || v === undefined || v === "";
  return field === "email"
    ? empty(data.email) && empty(data.email_certainty)
    : !empty(data.email) && empty(data.email_verification);
}

type Writer = Pick<Db, "update" | "insert">;

async function writeResult(
  db: Writer,
  rowId: string,
  field: EnrichField,
  patch: Record<string, unknown>,
  outcome: string,
  provider: string | null,
  providerCost: number,
  costCredits: number,
) {
  await db
    .update(tableRows)
    .set({ data: sql`${tableRows.data} || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(tableRows.id, rowId));
  await db.insert(enrichmentRuns).values({ rowId, field, provider, outcome, result: patch, providerCost, costCredits });
}
