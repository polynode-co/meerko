import type { Db } from "@meerko/db";
import { chargeCredits, getBalance, InsufficientCreditsError, SEARCH_RESULT_CREDITS, type CreditPolicy } from "./credits.ts";
import { companyToRow, personToRow, type IcypeasClient, type IcypeasQuery } from "./enrichment/icypeas.ts";
import { createTable, getTable, insertRows } from "./tables.ts";

export type LeadKind = "people" | "companies";

export interface SearchLeadsInput {
  kind: LeadKind;
  query: IcypeasQuery;
  limit: number;
  /** Append to this table; otherwise a new table named `tableName` is created. */
  tableId?: string;
  tableName?: string;
}

export function countLeads(icypeas: IcypeasClient, kind: LeadKind, query: IcypeasQuery) {
  return kind === "people" ? icypeas.countPeople(query) : icypeas.countCompanies(query);
}

/** Runs an Icypeas people/company search and writes the results into a table as rows. */
export async function searchLeads(
  db: Db,
  workspaceId: string,
  icypeas: IcypeasClient,
  input: SearchLeadsInput,
  policy: CreditPolicy,
) {
  // Check an existing table before spending credits; create a new one only once the search succeeded.
  const existing = input.tableId ? await getTable(db, workspaceId, input.tableId) : null;

  // Fetch no more results than the workspace can pay for.
  let limit = input.limit;
  if (policy.enabled) {
    const balance = await getBalance(db, workspaceId);
    if (balance < SEARCH_RESULT_CREDITS) throw new InsufficientCreditsError(balance, SEARCH_RESULT_CREDITS);
    limit = Math.min(limit, Math.floor(balance / SEARCH_RESULT_CREDITS));
  }

  const rows =
    input.kind === "people"
      ? await icypeas.findPeople(input.query, limit).then((r) => ({ total: r.total, rows: r.leads.map(personToRow) }))
      : await icypeas.findCompanies(input.query, limit).then((r) => ({ total: r.total, rows: r.leads.map(companyToRow) }));

  const table = existing ?? (await createTable(db, workspaceId, { name: input.tableName ?? `${input.kind} search` }));
  const { inserted, addedColumns } = await insertRows(db, workspaceId, table.id, rows.rows);
  const creditsSpent = policy.enabled ? inserted * SEARCH_RESULT_CREDITS : 0;
  if (creditsSpent > 0) await db.transaction((tx) => chargeCredits(tx, workspaceId, creditsSpent, `search:${input.kind}`, table.id));
  return {
    tableId: table.id,
    tableName: table.name,
    total: rows.total,
    inserted,
    addedColumns,
    creditsSpent,
    // Set when the balance, not `limit`, capped the results.
    ...(limit < input.limit && inserted === limit ? { cappedByCredits: true } : {}),
  };
}
