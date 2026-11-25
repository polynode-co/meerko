import { rowDomain } from "./icypeas.ts";
import { MissingInputError, type EnrichField, type EnrichmentProvider, type EnrichResult } from "./types.ts";

// REST contract: https://docs.generect.com/api-reference/introduction. Auth is `Token <key>`; every path needs its trailing slash.
const DEFAULT_BASE_URL = "https://api.generect.com";

/**
 * What Generect charges us in USD at the standard API tier (https://docs.generect.com/billing/pricing). Misses are
 * free. The real figure for each call comes back as `meta.amount_charged` and is what we record.
 */
export const GENERECT_COST_USD = { emailFound: 0.02, phoneFound: 0.4 } as const;

export class GenerectError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface GenerectClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface GenerectEmail {
  email: string | null;
  /** `valid`, `invalid` or `unknown`. */
  result?: string;
  catchAll?: boolean;
  /** USD. */
  charged: number;
}

export interface GenerectPhone {
  number: string | null;
  /** `mobile`, `fixed_line`, `voip`… when found. */
  type?: string;
  country?: string;
  charged: number;
}

/** Who to look up: a LinkedIn URL alone, or a full name plus where they work. */
export interface GenerectPerson {
  linkedinUrl?: string;
  firstName?: string;
  lastName?: string;
  /** Email finding needs a domain. */
  domain?: string;
  /** Phone finding takes a company name or a domain. */
  company?: string;
}

export class GenerectClient {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: GenerectClientOptions) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetch = opts.fetch ?? globalThis.fetch;
    // Real-time lookups can take up to a minute.
    this.timeoutMs = opts.timeoutMs ?? 90_000;
  }

  /** Free: the account profile, which is how a key is checked before it's stored. */
  async checkKey() {
    await this.request("GET", "/api/v1/accounts/me/");
  }

  async findEmail(p: GenerectPerson): Promise<GenerectEmail> {
    const body = p.linkedinUrl
      ? { linkedin_url: p.linkedinUrl }
      : { first_name: p.firstName, last_name: p.lastName, domain: p.domain };
    const json = await this.request<{ data?: { valid_email?: string | null; result?: string; catch_all?: boolean | string }; meta?: { amount_charged?: number } }>(
      "POST",
      "/api/v1/email/find/",
      body,
    );
    return {
      email: json.data?.valid_email ?? null,
      result: json.data?.result,
      catchAll: asBool(json.data?.catch_all),
      charged: Number(json.meta?.amount_charged ?? 0),
    };
  }

  async findPhone(p: GenerectPerson): Promise<GenerectPhone> {
    const body = p.linkedinUrl
      ? { linkedin_url: p.linkedinUrl }
      : { first_name: p.firstName, last_name: p.lastName, company: p.company ?? p.domain };
    const json = await this.request<{
      data?: { phone?: { number?: string | null; status?: string; type?: string; country?: string } };
      meta?: { amount_charged?: number };
    }>("POST", "/api/v1/phone/find/", body);
    const phone = json.data?.phone;
    const found = phone?.status === "FOUND" && typeof phone.number === "string" && phone.number !== "";
    return {
      number: found ? phone!.number! : null,
      // The docs say `mobile`; the API sends `MOBILE`.
      type: found ? phone!.type?.toLowerCase() : undefined,
      country: found ? phone!.country : undefined,
      charged: Number(json.meta?.amount_charged ?? 0),
    };
  }

  private async request<T = unknown>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Token ${this.opts.apiKey}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new GenerectError(errorMessage(json.detail) ?? res.statusText ?? "Generect request failed", codeFor(res.status), res.status);
    return json as T;
  }
}

/** The API sends some booleans as strings (`"catch_all": "false"`). */
const asBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : typeof v === "string" ? v.toLowerCase() === "true" : undefined);

const codeFor = (status: number) =>
  status === 401 ? "unauthorized" : status === 402 ? "insufficient_funds" : status === 429 ? "rate_limited" : `http_${status}`;

/** `detail` is a string, or a `{ field: [messages] }` map on a 400. */
function errorMessage(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    return Object.values(detail as Record<string, unknown>)
      .flat()
      .map(String)
      .join("; ");
  }
  return undefined;
}

const pick = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/** The row's person in Generect's terms, or a MissingInputError naming what the lookup needs. */
function personFor(field: "email" | "phone", row: Record<string, unknown>): GenerectPerson {
  const linkedinUrl = pick(row, "linkedin_url", "linkedin");
  if (linkedinUrl) return { linkedinUrl };
  const firstName = pick(row, "first_name", "firstname");
  const lastName = pick(row, "last_name", "lastname");
  const domain = rowDomain(row).domain ?? undefined;
  const company = pick(row, "company") ?? undefined;
  if (field === "email" && !(firstName && lastName && domain)) {
    throw new MissingInputError("email search needs a LinkedIn URL, or a first and last name plus a domain");
  }
  if (field === "phone" && !(firstName && lastName && (company || domain))) {
    throw new MissingInputError("phone search needs a LinkedIn URL, or a first and last name plus a company or domain");
  }
  return { firstName: firstName!, lastName: lastName!, domain, company };
}

/**
 * Generect finds work emails (after Icypeas, for the ones it missed) and phone numbers. On Meerko's key it's metered in
 * credits like Icypeas; on the workspace's own key (`ownKey`) what it finds costs no Meerko credits.
 * `providerCost` is in USD, as Generect reports it.
 */
export function generectProvider(client: GenerectClient, opts: { ownKey?: boolean } = {}): EnrichmentProvider {
  return {
    name: "generect",
    supports: ["email", "phone"] as const,
    ownKey: opts.ownKey ?? false,
    async enrich(field: EnrichField, row): Promise<EnrichResult> {
      if (field === "email") {
        const res = await client.findEmail(personFor("email", row));
        if (!res.email || res.result === "invalid") return { value: null, providerCost: res.charged };
        // Generect only returns addresses it validated; a catch-all domain can't confirm the mailbox, so it's probable.
        const confidence = res.catchAll || res.result === "unknown" ? "probable" : "very_sure";
        return { value: res.email, confidence, providerCost: res.charged };
      }
      if (field === "phone") {
        const res = await client.findPhone(personFor("phone", row));
        if (!res.number) return { value: null, providerCost: res.charged };
        return { value: res.number, confidence: res.type ?? "unknown", providerCost: res.charged };
      }
      throw new MissingInputError(`Generect doesn't do ${field}`);
    },
  };
}
