import type { Db } from "@meerko/db";
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
export async function searchLeads(db: Db, workspaceId: string, icypeas: IcypeasClient, input: SearchLeadsInput) {
  // Check an existing table before spending credits; create a new one only once the search succeeded.
  const existing = input.tableId ? await getTable(db, workspaceId, input.tableId) : null;

  const rows =
    input.kind === "people"
      ? await icypeas.findPeople(input.query, input.limit).then((r) => ({ total: r.total, rows: r.leads.map(personToRow) }))
      : await icypeas.findCompanies(input.query, input.limit).then((r) => ({ total: r.total, rows: r.leads.map(companyToRow) }));

  const table = existing ?? (await createTable(db, workspaceId, { name: input.tableName ?? `${input.kind} search` }));
  const { inserted, addedColumns } = await insertRows(db, workspaceId, table.id, rows.rows);
  return { tableId: table.id, tableName: table.name, total: rows.total, inserted, addedColumns };
}
