// The dashboard's "Find leads" form, turned into the Icypeas filters that /v1/search takes (the same query an agent
// passes to find_leads). Only the common filters are fields here; agents can use the rest.
import type { LeadKind, LeadQuery } from "@meerko/sdk";

/** Comma- or newline-separated → trimmed, non-empty values. */
export const list = (v: unknown) =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

const num = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

/** Field names per kind: people filter on their current company with a `currentCompany.` prefix. */
const FIELDS: Record<LeadKind, { titles?: string; industry: string; location: string; headcount: string; keyword: string; name?: string }> = {
  people: { titles: "currentJobTitle", industry: "currentCompany.industry", location: "location", headcount: "currentCompany.headcount", keyword: "keyword" },
  companies: { industry: "industry", location: "location", headcount: "headcount", keyword: "keyword", name: "name" },
};

export interface LeadForm {
  titles?: unknown;
  excludeTitles?: unknown;
  location?: unknown;
  industry?: unknown;
  keywords?: unknown;
  names?: unknown;
  minHeadcount?: unknown;
  maxHeadcount?: unknown;
}

/** The filters for a search, or an error to show when there isn't one to run. */
export function buildLeadQuery(kind: LeadKind, form: LeadForm): { query: LeadQuery } | { error: string } {
  const f = FIELDS[kind];
  const query: LeadQuery = {};
  const include = (field: string | undefined, values: string[], exclude: string[] = []) => {
    if (!field || (values.length === 0 && exclude.length === 0)) return;
    query[field] = { ...(values.length ? { include: values } : {}), ...(exclude.length ? { exclude } : {}) };
  };
  if (kind === "people") include(f.titles, list(form.titles), list(form.excludeTitles));
  if (kind === "companies") include(f.name, list(form.names));
  // Country codes are what Icypeas matches on; "es" and "ES" mean the same.
  include(f.location, list(form.location).map((l) => (/^[a-z]{2}$/i.test(l) ? l.toUpperCase() : l)));
  include(f.industry, list(form.industry));
  include(f.keyword, list(form.keywords));

  const min = num(form.minHeadcount);
  const max = num(form.maxHeadcount);
  if (min !== undefined && max !== undefined && min > max) return { error: "The minimum headcount is above the maximum" };
  if (min !== undefined || max !== undefined) query[f.headcount] = { ...(min !== undefined ? { ">=": min } : {}), ...(max !== undefined ? { "<=": max } : {}) };

  if (Object.keys(query).length === 0) return { error: "Add at least one filter" };
  return { query };
}

/**
 * A name for the new table when the person left it empty, from what they searched for: "CTO, VP Engineering · ES".
 * Falls back to the kind and today's date, so "Find and add" never stops on a missing name.
 */
export function defaultTableName(kind: LeadKind, form: LeadForm, today = new Date()) {
  const short = (v: unknown, n = 2) => {
    const items = list(v);
    return items.length ? items.slice(0, n).join(", ") + (items.length > n ? "…" : "") : "";
  };
  const what = kind === "people" ? short(form.titles) || short(form.keywords) || short(form.industry, 1) : short(form.names) || short(form.industry, 1) || short(form.keywords);
  // "es" reads as ES, but "Spain" stays Spain.
  const where = short(list(form.location).map((l) => (/^[a-z]{2}$/i.test(l) ? l.toUpperCase() : l)), 3);
  const name = [what, where].filter(Boolean).join(" · ");
  if (name) return name.slice(0, 80);
  return `${kind === "people" ? "People" : "Companies"} · ${today.toISOString().slice(0, 10)}`;
}
