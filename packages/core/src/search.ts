import type { Db } from "@meerko/db";
import { chargeCredits, getBalance, InsufficientCreditsError, SEARCH_RESULT_CREDITS, type CreditPolicy } from "./credits.ts";
import { companyToRow, personToRow, type IcypeasClient, type IcypeasQuery } from "./enrichment/icypeas.ts";
import { checkLocation, countryCode, countryNames, type LocationCheck } from "./countries.ts";
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

const isLocation = (key: string) => /(^|\.)location$/i.test(key);

/** The string values of a query's location filters, include and exclude, in order and once each. */
function locationValues(query: IcypeasQuery) {
  const values = new Set<string>();
  for (const [key, filter] of Object.entries(query)) {
    if (!isLocation(key) || !filter || typeof filter !== "object") continue;
    for (const side of ["include", "exclude"] as const) {
      const v = (filter as Record<string, unknown>)[side];
      if (Array.isArray(v)) for (const s of v) if (typeof s === "string" && s.trim()) values.add(s.trim());
    }
  }
  return [...values];
}

/**
 * Icypeas matches location as text, so a bare "ES" finds "Dar es Salaam" and misses most of Spain, and "Spain" misses
 * the profiles that say "España". Swap each country in a location filter, as a code or a name in any language, for all
 * of the country's names (English, Spanish, French, German, ...). Anything else (a city, a region) stays as it is.
 */
export function expandCountryCodes(query: IcypeasQuery): IcypeasQuery {
  const out: IcypeasQuery = { ...query };
  for (const [key, filter] of Object.entries(query)) {
    if (!isLocation(key) || !filter || typeof filter !== "object") continue;
    const f = { ...(filter as Record<string, unknown>) };
    for (const side of ["include", "exclude"] as const) {
      const values = f[side];
      if (!Array.isArray(values)) continue;
      f[side] = [
        ...new Set(
          values.flatMap((v) => {
            const code = typeof v === "string" ? countryCode(v) : null;
            // The value itself is one of the names, or a code or alias that as text matches the wrong places.
            return code ? countryNames(code) : [v];
          }),
        ),
      ];
    }
    out[key] = f as IcypeasQuery[string];
  }
  return out;
}

/** How each location value in a search was read, so a surface can show "Spain → ES" or flag "Spian". */
export function locationChecks(query: IcypeasQuery): LocationCheck[] {
  return locationValues(query).map(checkLocation);
}

export async function countLeads(icypeas: IcypeasClient, kind: LeadKind, query: IcypeasQuery) {
  const expanded = expandCountryCodes(query);
  const total = kind === "people" ? await icypeas.countPeople(expanded) : await icypeas.countCompanies(expanded);
  return { total, locations: locationChecks(query) };
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

  const query = expandCountryCodes(input.query);
  const rows =
    input.kind === "people"
      ? await icypeas.findPeople(query, limit).then((r) => ({ total: r.total, rows: r.leads.map(personToRow) }))
      : await icypeas.findCompanies(query, limit).then((r) => ({ total: r.total, rows: r.leads.map(companyToRow) }));

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
    locations: locationChecks(input.query),
    // Set when the balance, not `limit`, capped the results.
    ...(limit < input.limit && inserted === limit ? { cappedByCredits: true } : {}),
  };
}
