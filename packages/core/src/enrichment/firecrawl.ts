import { toDomain } from "./icypeas.ts";
import { MissingInputError, type EnrichField, type EnrichmentProvider, type EnrichResult } from "./types.ts";

// Alexandria runs third-party data tools through the scrape endpoint: https://docs.firecrawl.dev/features/alexandria
const DEFAULT_BASE_URL = "https://api.firecrawl.dev/v2";

/**
 * The Alexandria tool Meerko asks for a work email: FullEnrich, which itself tries 20+ sources in turn. 30 Firecrawl
 * credits per email found; a miss is free.
 * Check it against `firecrawl find-tools --categories people --expand options` when Firecrawl changes its catalog.
 */
export const FIRECRAWL_WORK_EMAIL = { provider: "fullenrich", capability: "contacts/work-email" } as const;

/** FullEnrich statuses mapped onto the certainty words Icypeas uses, so `email_certainty` means one thing. */
const CERTAINTY: Record<string, string> = {
  deliverable: "very_sure",
  valid: "very_sure",
  high_probability: "probable",
  probable: "probable",
  catch_all: "probable",
  catchall: "probable",
};
const UNUSABLE = new Set(["invalid", "undeliverable", "not_found"]);

export class FirecrawlError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface FirecrawlClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface AlexandriaResult {
  data: unknown;
  /** Firecrawl credits the call cost. */
  creditsCost: number;
}

export class FirecrawlClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: FirecrawlClientOptions) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetch = opts.fetch ?? globalThis.fetch;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
  }

  /** Free: searching Alexandria's catalog costs no credits, so it's how a key is checked before it's stored. */
  async checkKey() {
    await this.post("/search", { query: "work email", sources: [{ type: "alexandria" }], limit: 1 });
  }

  async alexandria(provider: string, capability: string, options: Record<string, unknown>): Promise<AlexandriaResult> {
    const json = await this.post<{ data?: { alexandria?: { data?: unknown; error?: unknown }[]; creditsCost?: number } }>("/scrape", {
      alexandria: [{ provider, capability, options }],
    });
    const item = json.data?.alexandria?.[0];
    // One tool call can fail inside a successful request.
    if (!item || item.error) throw toolError(item?.error);
    return { data: item.data ?? null, creditsCost: Number(json.data?.creditsCost ?? 0) };
  }

  private async post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, integration: "_meerko" }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json.success === false) {
      if (json.code === "THIRD_PARTY_DATA_TERMS_REQUIRED") throw termsError(json);
      throw new FirecrawlError(String(json.error ?? res.statusText ?? "Firecrawl request failed"), String(json.code ?? `http_${res.status}`), res.status);
    }
    return json as T;
  }
}

const termsError = (json: Record<string, unknown>) => {
  const url = (json.requiresAction as { url?: string } | undefined)?.url ?? "https://www.firecrawl.dev/app/settings?tab=data-sources";
  return new FirecrawlError(`Accept FullEnrich's data terms in Firecrawl first: ${url}`, "third_party_data_terms_required");
};

const toolError = (error: unknown) => {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (e.code === "THIRD_PARTY_DATA_TERMS_REQUIRED") return termsError(e);
    return new FirecrawlError(String(e.message ?? e.error ?? "Firecrawl tool call failed"), String(e.code ?? "tool_error"));
  }
  return new FirecrawlError(typeof error === "string" ? error : "Firecrawl returned no result", "tool_error");
};

interface Candidate {
  email: string;
  status?: string;
}

const asCandidate = (v: unknown): Candidate | null => {
  if (typeof v === "string") return v.includes("@") ? { email: v } : null;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const email = o.email ?? o.address ?? o.value;
    if (typeof email === "string" && email.includes("@")) return { email, status: typeof o.status === "string" ? o.status : undefined };
  }
  return null;
};

/**
 * The best work email in a FullEnrich result (`results[0].contact_info`): `most_probable_work_email`, then the first usable entry of
 * `work_emails`. Emails marked invalid are skipped.
 */
export function pickWorkEmail(data: unknown): Candidate | null {
  if (!data || typeof data !== "object") return null;
  // The tool answers `{ results: [record] }` on a find and `{ results: [] }` on a miss.
  const results = (data as Record<string, unknown>).results;
  const root = (Array.isArray(results) ? results[0] : data) as Record<string, unknown> | undefined;
  if (!root || typeof root !== "object") return null;
  const info = (root.contact_info ?? root) as Record<string, unknown>;
  const candidates = [info.most_probable_work_email, ...(Array.isArray(info.work_emails) ? info.work_emails : []), info.email, info.work_email]
    .map(asCandidate)
    .filter((c): c is Candidate => c !== null);
  return candidates.find((c) => !UNUSABLE.has(String(c.status ?? "").toLowerCase())) ?? null;
}

const pick = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/**
 * Email finding through Firecrawl Alexandria, on the workspace's own Firecrawl key. It runs after Icypeas in the
 * waterfall, and what it finds costs no Meerko credits.
 */
export function firecrawlProvider(client: FirecrawlClient): EnrichmentProvider {
  return {
    name: "firecrawl",
    supports: ["email"] as const,
    ownKey: true,
    async enrich(field: EnrichField, row): Promise<EnrichResult> {
      if (field !== "email") throw new MissingInputError("Firecrawl only finds emails");
      const firstName = pick(row, "first_name", "firstname");
      const lastName = pick(row, "last_name", "lastname");
      const domain = toDomain(pick(row, "domain", "website", "company_domain"));
      const company = pick(row, "company");
      const linkedin = pick(row, "linkedin_url");
      // A LinkedIn URL is enough on its own; otherwise the tool needs a full name and the employer.
      if (!linkedin && (!(firstName && lastName) || !(domain || company))) {
        throw new MissingInputError("email search needs a LinkedIn URL, or a first and last name plus a domain or company");
      }
      const options: Record<string, unknown> = {};
      if (firstName) options.first_name = firstName;
      if (lastName) options.last_name = lastName;
      if (domain) options.domain = domain;
      if (company) options.company_name = company;
      if (linkedin) options.linkedin_url = linkedin;

      const res = await client.alexandria(FIRECRAWL_WORK_EMAIL.provider, FIRECRAWL_WORK_EMAIL.capability, options);
      const best = pickWorkEmail(res.data);
      if (!best) return { value: null, providerCost: res.creditsCost, raw: res.data };
      const status = String(best.status ?? "").toLowerCase();
      return { value: best.email, confidence: CERTAINTY[status] ?? "probable", providerCost: res.creditsCost, raw: res.data };
    },
  };
}
