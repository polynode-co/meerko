import { MissingInputError, type EnrichField, type EnrichmentProvider, type EnrichResult } from "./types.ts";

// REST contract: https://api-doc.icypeas.com (v1.15). Every endpoint is POST + JSON, auth is the raw key.
const DEFAULT_BASE_URL = "https://app.icypeas.com/api";

/** Provider credits per operation, per the Icypeas docs and the 2026-10-05 coverage test. */
export const ICYPEAS_COST = { emailFound: 1, verification: 0.1, searchResult: 0.02 } as const;

const PENDING = new Set(["NONE", "SCHEDULED", "IN_PROGRESS"]);
const FOUND = new Set(["FOUND", "DEBITED"]);
const MISSED = new Set(["NOT_FOUND", "DEBITED_NOT_FOUND"]);

export type IncludeExclude = { include?: string[]; exclude?: string[] };
export type Range = { ">"?: number; ">="?: number; "<"?: number; "<="?: number };
export type HeadcountGrowth = { timespan: "6months" | "12months" | "24months"; min: number; max: number };
/** Icypeas query filters; keys like `"currentCompany.headcount"` are literal dotted keys. */
export type IcypeasQuery = Record<string, IncludeExclude | Range | HeadcountGrowth>;

export interface IcypeasEmail {
  email: string;
  certainty: string;
  mxProvider?: string;
}

export interface SingleSearchResult {
  status: string;
  emails: IcypeasEmail[];
}

export class IcypeasError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
    /** True when Icypeas rejected the request itself (bad filter, missing field): a caller error. */
    readonly validation = false,
  ) {
    super(message);
  }
}

export interface IcypeasClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** The read endpoint allows 30 req/min, so poll no faster than every 2s per item. */
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class IcypeasClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: IcypeasClientOptions) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
    this.pollTimeoutMs = opts.pollTimeoutMs ?? 90_000;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async emailSearch(input: { firstname: string; lastname: string; domainOrCompany: string }) {
    const { item } = await this.post<{ item: { _id: string } }>("/email-search", input);
    return this.waitForResult(item._id);
  }

  async verifyEmail(email: string) {
    const { item } = await this.post<{ item: { _id: string } }>("/email-verification", { email });
    return this.waitForResult(item._id);
  }

  countPeople(query: IcypeasQuery) {
    return this.post<{ total: number }>("/find-people/count", { query }).then((r) => r.total);
  }

  countCompanies(query: IcypeasQuery) {
    return this.post<{ total: number }>("/find-companies/count", { query }).then((r) => r.total);
  }

  findPeople(query: IcypeasQuery, limit: number) {
    return this.paginate<IcypeasPerson>("/find-people", query, limit);
  }

  findCompanies(query: IcypeasQuery, limit: number) {
    return this.paginate<IcypeasCompany>("/find-companies", query, limit);
  }

  private async paginate<T>(path: string, query: IcypeasQuery, limit: number) {
    const leads: T[] = [];
    let total = 0;
    let pagination: { token?: string; size: number } | undefined = { size: Math.min(200, limit) };
    while (pagination && leads.length < limit) {
      const page: { total: number; leads: T[]; pagination?: { token: string; size: number } } = await this.post(path, {
        query,
        pagination,
      });
      total = page.total;
      leads.push(...page.leads);
      // Tokens are opaque and bound to the query; Icypeas omits `pagination` on the last page.
      pagination = page.leads.length > 0 ? page.pagination : undefined;
    }
    return { total, leads: leads.slice(0, limit) };
  }

  private async waitForResult(id: string): Promise<SingleSearchResult> {
    const deadline = Date.now() + this.pollTimeoutMs;
    while (true) {
      const { items } = await this.post<{ items: { status: string; results?: { emails?: IcypeasEmail[] } }[] }>(
        "/bulk-single-searchs/read",
        { id },
      );
      const item = items[0];
      if (item && !PENDING.has(item.status)) {
        if (item.status === "INSUFFICIENT_FUNDS") throw new IcypeasError("Icypeas account is out of credits", "insufficient_funds");
        if (!FOUND.has(item.status) && !MISSED.has(item.status)) {
          throw new IcypeasError(`Icypeas search ended with status ${item.status}`, item.status.toLowerCase());
        }
        return { status: item.status, emails: item.results?.emails ?? [] };
      }
      if (Date.now() >= deadline) throw new IcypeasError(`Icypeas search ${id} timed out`, "timeout");
      await this.sleep(this.pollIntervalMs);
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: this.opts.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new IcypeasError(String(json.message ?? res.statusText), String(json.code ?? `http_${res.status}`), res.status);
    }
    // Validation failures come back as HTTP 200 with success: false.
    if (json.success === false) {
      const first = (json.validationErrors as { field?: string; message?: string; type?: string }[] | undefined)?.[0];
      // Searches report an empty account here too (`user: insufficient_credits`), not as a polled INSUFFICIENT_FUNDS.
      // That's the server's provider account, not the caller's search, so it mustn't read as "Invalid search".
      if (first?.message === "insufficient_credits" || first?.type === "insufficient_credits") {
        throw new IcypeasError("Icypeas account is out of credits", "insufficient_funds", res.status);
      }
      throw new IcypeasError(
        first ? `${first.field ?? "request"}: ${first.message ?? first.type}` : "Icypeas request failed",
        first?.type ?? "validation_error",
        res.status,
        true,
      );
    }
    return json as T;
  }
}

export interface IcypeasPerson {
  firstname: string;
  lastname: string;
  headline?: string;
  profileUrl?: string;
  lastJobTitle?: string;
  lastJobStartDate?: string;
  address?: string;
  lastCompanyName?: string;
  lastCompanyUrn?: string;
  lastCompanyUrl?: string;
  lastCompanyWebsite?: string;
  lastCompanySize?: number;
  lastCompanyIndustry?: string;
}

export interface IcypeasCompany {
  _id?: string;
  name: string;
  urn?: string;
  url?: string;
  website?: string;
  industry?: string;
  description?: string;
  address?: string;
  numberOfEmployees?: number;
  headcountRange?: { gte?: number; lte?: number };
  foundedYear?: number;
}

/**
 * Hosts that aren't the company's own: social networks, marketplaces, link-in-bio pages, app stores, webmail and
 * site builders' shared domains. Small brands often list one as their "website"; nobody has a work email there, so
 * new leads keep it as a profile link (`profile_url`), never as the domain, and email finding skips a lead whose
 * only site is one (a lookup there is a certain miss, and Icypeas charges for misses).
 *
 * The dashboard keeps a copy (PLATFORM_HOSTS in @meerko/sdk/constants), to show old rows' platform domains as
 * links; enrichment.test.ts keeps the two equal.
 */
export const PLATFORM_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "linkedin.com", "twitter.com", "x.com", "tiktok.com", "youtube.com", "youtu.be",
  "pinterest.com", "threads.net", "snapchat.com", "t.me", "wa.me", "whatsapp.com", "linktr.ee", "linktree.com", "beacons.ai",
  "bio.link", "lnk.bio", "campsite.bio", "etsy.com", "amazon.com", "ebay.com", "depop.com", "vinted.com", "shopify.com",
  "myshopify.com", "wixsite.com", "squarespace.com", "carrd.co", "wordpress.com", "blogspot.com", "medium.com", "substack.com",
  "github.io", "sites.google.com", "play.google.com", "apps.apple.com", "itunes.apple.com", "gmail.com", "yahoo.com",
  "hotmail.com", "outlook.com", "icloud.com", "calendly.com", "yelp.com", "tripadvisor.com", "booking.com", "airbnb.com",
  "eventbrite.com", "patreon.com", "spotify.com", "soundcloud.com", "behance.net", "dribbble.com", "google.com",
];

export const isPlatformHost = (host: string) => PLATFORM_HOSTS.some((p) => host === p || host.endsWith(`.${p}`));

/** Strips scheme, `www.` and paths so "https://www.acme.com/es" becomes "acme.com". */
const hostOf = (website: string) =>
  website
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]!
    .toLowerCase();

/** The company's own domain from a website value, or null (no website, or a platform like instagram.com). */
export function toDomain(website: string | undefined | null): string | null {
  if (!website) return null;
  const host = hostOf(website);
  return host.includes(".") && !isPlatformHost(host) ? host : null;
}

/** The website as a link when it's a platform page (an Instagram profile, an App Store listing), else null. */
export function toProfileUrl(website: string | undefined | null): string | null {
  if (!website?.trim()) return null;
  const host = hostOf(website);
  if (!host.includes(".") || !isPlatformHost(host)) return null;
  return /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`;
}

const SITE_KEYS = ["domain", "website", "company_domain", "profile_url", "company_profile_url"] as const;

/**
 * Where a row's company can be emailed: its own domain, or null. `platformOnly` when the row's only site is a
 * platform page (instagram.com, linktr.ee…), so an email lookup would be a certain miss.
 */
export function rowDomain(row: Record<string, unknown>): { domain: string | null; platformOnly: boolean } {
  const sites = SITE_KEYS.map((k) => row[k]).filter((v): v is string => typeof v === "string" && !!v.trim());
  const domain = sites.map(toDomain).find((d) => d !== null) ?? null;
  return { domain, platformOnly: !domain && sites.some((s) => toProfileUrl(s) !== null) };
}

export function personToRow(p: IcypeasPerson): Record<string, unknown> {
  const profile = toProfileUrl(p.lastCompanyWebsite);
  return {
    ...(profile ? { company_profile_url: profile } : {}),
    first_name: p.firstname,
    last_name: p.lastname,
    title: p.lastJobTitle ?? null,
    company: p.lastCompanyName ?? null,
    domain: toDomain(p.lastCompanyWebsite),
    company_size: p.lastCompanySize ?? null,
    industry: p.lastCompanyIndustry ?? null,
    location: p.address ?? null,
    linkedin_url: p.profileUrl ?? null,
    company_linkedin_url: p.lastCompanyUrl ?? null,
  };
}

export function companyToRow(c: IcypeasCompany): Record<string, unknown> {
  const profile = toProfileUrl(c.website);
  return {
    company: c.name,
    domain: toDomain(c.website),
    ...(profile ? { profile_url: profile } : {}),
    industry: c.industry ?? null,
    // `headcountRange` sometimes contradicts the actual count, so only use it as a fallback.
    employees: c.numberOfEmployees ?? c.headcountRange?.lte ?? null,
    location: c.address ?? null,
    founded_year: c.foundedYear && c.foundedYear > 0 ? c.foundedYear : null,
    description: c.description ?? null,
    linkedin_url: c.url ?? null,
    company_urn: c.urn?.split(":").pop() ?? null,
  };
}

const pick = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** `ownKey`: the client runs on the workspace's own Icypeas key, so what it finds costs no Meerko credits. */
export function icypeasProvider(client: IcypeasClient, opts: { ownKey?: boolean } = {}): EnrichmentProvider {
  return {
    name: "icypeas",
    supports: ["email", "email_verification"] as const,
    ownKey: opts.ownKey ?? false,
    async enrich(field: EnrichField, row): Promise<EnrichResult> {
      if (field === "email") {
        const firstname = pick(row, "first_name", "firstname");
        const lastname = pick(row, "last_name", "lastname");
        const { domain, platformOnly } = rowDomain(row);
        if (platformOnly) throw new MissingInputError("the company's only site is a social or marketplace page, where nobody has a work email");
        const domainOrCompany = domain ?? pick(row, "company");
        if (!(firstname || lastname) || !domainOrCompany) {
          throw new MissingInputError("email search needs a first or last name plus a domain or company");
        }
        const res = await client.emailSearch({ firstname: firstname ?? "", lastname: lastname ?? "", domainOrCompany });
        const best = res.emails[0];
        if (!best) return { value: null, providerCost: 0, raw: res };
        return { value: best.email, confidence: best.certainty, providerCost: ICYPEAS_COST.emailFound, raw: res };
      }
      const email = pick(row, "email");
      if (!email) throw new MissingInputError("email verification needs an email");
      const res = await client.verifyEmail(email);
      // The verdict is the certainty; `not_found` means existence couldn't be determined.
      const certainty = res.emails[0]?.certainty ?? "not_found";
      return { value: certainty, confidence: certainty, providerCost: ICYPEAS_COST.verification, raw: res };
    },
  };
}
