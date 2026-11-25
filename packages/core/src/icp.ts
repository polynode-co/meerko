// A brand's ideal customer profile (ICP) and how well each lead fits it. The person's agent writes the ICP (usually
// from read_website); Meerko scores rows against it with plain rules, so the score is instant, free and the same on
// a self-hosted install. The agent can then nudge a row's score with a reason (setIcpReview), which is the judgement
// rules can't make ("a denim factory, not a fashion brand").
import { and, eq, tableRows, workspaces, type Db } from "@meerko/db";
import { countryNames } from "./countries.ts";
import { getTable } from "./tables.ts";

/** Validated in apps/api/src/v1/schemas.ts (icpInput). */
export interface Icp {
  /** One line: who they sell to. */
  summary?: string;
  /** LinkedIn industry names. */
  industries?: string[];
  /** Alpha-2 country codes. */
  countries?: string[];
  headcount?: { min?: number; max?: number };
  /** Buyer job titles, in every language they sell in. */
  titles?: string[];
  /** Words a good fit's description or title mentions. */
  keywords?: string[];
  /** Words that rule a lead out. */
  exclude?: string[];
}

/** One check in a score: what it compared, and whether the lead passed. */
export interface IcpCheck {
  criterion: "industry" | "headcount" | "country" | "title" | "keywords" | "exclude";
  matched: boolean;
  detail: string;
}

export interface IcpFit {
  /** 0 to 100, or null when the workspace has no ICP or the row has nothing to compare. */
  score: number | null;
  /** The rules-only score, before the agent's adjustment. */
  base: number | null;
  checks: IcpCheck[];
  adjust: number | null;
  note: string | null;
  /** One line on why: the agent's note when it adjusted the score, else what matched and what didn't. */
  reason: string | null;
}

const WEIGHTS = { industry: 30, title: 25, headcount: 20, country: 15, keywords: 10 } as const;

const text = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const has = (haystack: string, needle: string) => norm(haystack).includes(norm(needle));

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(text(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && text(v) !== "" ? n : null;
};

/**
 * Scores one row's data against an ICP. Only criteria the ICP sets and the row has data for count, so a company
 * row isn't marked down for having no job title. An exclusion match caps the score at 10.
 */
export function scoreRow(icp: Icp | null, data: Record<string, unknown>, review?: { adjust: number | null; note: string | null }): IcpFit {
  const adjust = review?.adjust ?? null;
  const note = review?.note ?? null;
  if (!icp) return { score: null, base: null, checks: [], adjust, note, reason: null };

  const industry = text(data.industry);
  const title = text(data.title);
  const location = text(data.location);
  const size = num(data.company_size ?? data.employees);
  // Keywords are judged on what describes the lead (a profile or company description); exclusions on everything.
  const profile = [data.description, data.keywords, data.headline, data.summary].map(text).join(" ");
  const about = [data.company, data.title, data.industry, profile].map(text).join(" ");

  const checks: IcpCheck[] = [];
  let earned = 0;
  let possible = 0;
  const add = (criterion: keyof typeof WEIGHTS, matched: boolean, detail: string) => {
    checks.push({ criterion, matched, detail });
    possible += WEIGHTS[criterion];
    if (matched) earned += WEIGHTS[criterion];
  };

  if (icp.industries?.length && industry) {
    const hit = icp.industries.find((i) => has(industry, i) || has(i, industry));
    add("industry", !!hit, hit ? industry : `${industry}, not one of your industries`);
  }
  if (icp.titles?.length && title) {
    const hit = icp.titles.find((t) => has(title, t));
    add("title", !!hit, hit ? title : `"${title}" isn't a buyer title`);
  }
  if (icp.headcount && (icp.headcount.min !== undefined || icp.headcount.max !== undefined) && size !== null) {
    const ok = (icp.headcount.min === undefined || size >= icp.headcount.min) && (icp.headcount.max === undefined || size <= icp.headcount.max);
    const range = icp.headcount.max === undefined ? `${icp.headcount.min}+` : `${icp.headcount.min ?? 0}–${icp.headcount.max}`;
    add("headcount", ok, ok ? `${size} ${size === 1 ? "person" : "people"}` : `${size} people, you want ${range}`);
  }
  if (icp.countries?.length && location) {
    const hit = icp.countries.find((c) => countryNames(c).some((n) => has(location, n)) || location.split(",").some((part) => part.trim() === c.toUpperCase()));
    add("country", !!hit, hit ? `${hit.toUpperCase()} · ${location}` : `${location}, not one of your countries`);
  }
  if (icp.keywords?.length && profile.trim()) {
    const hits = icp.keywords.filter((k) => has(profile, k));
    add("keywords", hits.length > 0, hits.length ? `mentions ${hits.join(", ")}` : "mentions none of your keywords");
  }

  if (possible === 0) return { score: null, base: null, checks, adjust, note, reason: "Nothing to compare: the lead has no industry, title, size or location" };
  let base = Math.round((earned / possible) * 100);
  const excluded = (icp.exclude ?? []).find((x) => has(about, x));
  if (excluded) {
    checks.push({ criterion: "exclude", matched: false, detail: `mentions "${excluded}"` });
    base = Math.min(base, 10);
  }
  const score = Math.max(0, Math.min(100, base + (adjust ?? 0)));
  return { score, base, checks, adjust, note, reason: note ?? reasonFor(checks, { title, industry, size }) };
}

/**
 * The lead itself in one line, so reasons differ from row to row: "Founder · Food and Beverage Services · 4 people
 * · US", then what's off ("· “Influencer Marketing” isn't a buyer title"), or why it's ruled out.
 */
export function reasonFor(checks: IcpCheck[], lead: { title: string; industry: string; size: number | null }) {
  const ruledOut = checks.find((c) => c.criterion === "exclude");
  if (ruledOut) return `Ruled out: ${ruledOut.detail}`;
  const ok = (k: IcpCheck["criterion"]) => checks.find((c) => c.criterion === k)?.matched;
  const country = checks.find((c) => c.criterion === "country" && c.matched)?.detail.split(" · ")[0];
  const keywords = checks.find((c) => c.criterion === "keywords" && c.matched)?.detail;
  const facts = [
    ok("title") ? lead.title : null,
    ok("industry") ? lead.industry : null,
    ok("headcount") && lead.size !== null ? `${lead.size} ${lead.size === 1 ? "person" : "people"}` : null,
    country,
    keywords,
  ].filter(Boolean);
  const misses = checks.filter((c) => !c.matched).map((c) => c.detail);
  return [...facts, ...misses].join(" · ");
}

/** The workspace's ICP, or null if none was set. */
export async function getIcp(db: Db, workspaceId: string): Promise<Icp | null> {
  const [ws] = await db.select({ icp: workspaces.icp }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return (ws?.icp as Icp | null) ?? null;
}

/** Replaces the workspace's ICP. Country codes are stored upper-case; empty lists are dropped. */
export async function setIcp(db: Db, workspaceId: string, icp: Icp): Promise<Icp> {
  const clean: Icp = { ...icp, countries: icp.countries?.map((c) => c.toUpperCase()) };
  for (const k of Object.keys(clean) as (keyof Icp)[]) {
    const v = clean[k];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete clean[k];
  }
  await db.update(workspaces).set({ icp: clean }).where(eq(workspaces.id, workspaceId));
  return clean;
}

export async function clearIcp(db: Db, workspaceId: string) {
  await db.update(workspaces).set({ icp: null }).where(eq(workspaces.id, workspaceId));
}

/**
 * The agent's judgement on rows the rules can't read: `adjust` moves the score by up to ±30, with a one-line
 * reason. `adjust: null` clears it.
 */
export async function setIcpReview(db: Db, workspaceId: string, tableId: string, reviews: { rowId: string; adjust: number | null; note?: string | null }[]) {
  await getTable(db, workspaceId, tableId);
  let updated = 0;
  for (const r of reviews) {
    const adjust = r.adjust === null ? null : Math.max(-30, Math.min(30, Math.round(r.adjust)));
    const res = await db
      .update(tableRows)
      .set({ icpAdjust: adjust, icpNote: adjust === null ? null : (r.note?.trim().slice(0, 300) ?? null) })
      .where(and(eq(tableRows.tableId, tableId), eq(tableRows.id, r.rowId)))
      .returning({ id: tableRows.id });
    updated += res.length;
  }
  return { updated };
}

/** Row ids in a table whose fit is at least `min`, among `candidates` (id, data and review). */
export function rowsAtLeast(icp: Icp | null, candidates: { id: string; data: Record<string, unknown>; icpAdjust: number | null; icpNote: string | null }[], min: number) {
  return candidates.filter((r) => (scoreRow(icp, r.data, { adjust: r.icpAdjust, note: r.icpNote }).score ?? -1) >= min).map((r) => r.id);
}

