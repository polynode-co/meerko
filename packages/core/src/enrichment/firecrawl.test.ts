import { describe, expect, it } from "vitest";
import { FirecrawlClient, FirecrawlError, firecrawlProvider, FIRECRAWL_WORK_EMAIL, pickWorkEmail } from "./firecrawl.ts";
import { MissingInputError } from "./types.ts";

/** Fake fetch that answers every request with `body` and records what was sent. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; body: any; auth: string | null }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

const found = (contact_info: unknown, creditsCost = 30) => ({ success: true, data: { alexandria: [{ data: { results: [{ input: {}, contact_info }] } }], creditsCost } });
const ana = { first_name: "Ana", last_name: "Ruiz", domain: "https://www.acme.es/about", company: "Acme" };

describe("firecrawlProvider", () => {
  it("asks Alexandria's work-email tool and maps the status onto Meerko's certainty words", async () => {
    const { fn, calls } = fakeFetch(found({ most_probable_work_email: { email: "ana@acme.es", status: "DELIVERABLE" } }));
    const res = await firecrawlProvider(new FirecrawlClient({ apiKey: "fc-key", fetch: fn })).enrich("email", ana);

    expect(res).toMatchObject({ value: "ana@acme.es", confidence: "very_sure", providerCost: 30 });
    expect(calls[0]!.url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(calls[0]!.auth).toBe("Bearer fc-key");
    expect(calls[0]!.body).toEqual({
      alexandria: [{ ...FIRECRAWL_WORK_EMAIL, options: { first_name: "Ana", last_name: "Ruiz", domain: "acme.es", company_name: "Acme" } }],
      integration: "_meerko",
    });
  });

  it("returns a miss when nothing usable comes back, skipping invalid emails", async () => {
    const empty = fakeFetch({ success: true, data: { alexandria: [{ data: { results: [] } }], creditsCost: 0 } });
    expect(await firecrawlProvider(new FirecrawlClient({ apiKey: "k", fetch: empty.fn })).enrich("email", ana)).toMatchObject({ value: null, providerCost: 0 });
    const { fn } = fakeFetch(found({ most_probable_work_email: { email: "ana@acme.es", status: "INVALID" }, work_emails: [] }, 0));
    expect(await firecrawlProvider(new FirecrawlClient({ apiKey: "k", fetch: fn })).enrich("email", ana)).toMatchObject({ value: null, providerCost: 0 });
  });

  it("needs a LinkedIn URL or a full name and employer, and only finds emails", async () => {
    const provider = firecrawlProvider(new FirecrawlClient({ apiKey: "k", fetch: fakeFetch(found({})).fn }));
    await expect(provider.enrich("email", { first_name: "Ana", domain: "acme.es" })).rejects.toBeInstanceOf(MissingInputError);
    await expect(provider.enrich("email", { linkedin_url: "https://www.linkedin.com/in/ana" })).resolves.toBeDefined();
    await expect(provider.enrich("email_verification", { email: "a@b.c" })).rejects.toBeInstanceOf(MissingInputError);
    expect(provider).toMatchObject({ supports: ["email"], ownKey: true });
  });

  it("surfaces a tool error and the data-terms step", async () => {
    const tool = fakeFetch({ success: true, data: { alexandria: [{ error: { code: "TOOL_FAILED", message: "upstream down" } }] } });
    await expect(new FirecrawlClient({ apiKey: "k", fetch: tool.fn }).alexandria("fullenrich", "x", {})).rejects.toThrow("upstream down");

    const terms = fakeFetch({ success: false, code: "THIRD_PARTY_DATA_TERMS_REQUIRED", requiresAction: { url: "https://firecrawl.dev/terms" } }, 403);
    const err = await new FirecrawlClient({ apiKey: "k", fetch: terms.fn }).alexandria("fullenrich", "x", {}).catch((e) => e);
    expect(err).toBeInstanceOf(FirecrawlError);
    expect(err.message).toContain("https://firecrawl.dev/terms");
  });

  it("checks a key with the free catalog search", async () => {
    const { fn, calls } = fakeFetch({ success: true, data: { tools: [] } });
    await new FirecrawlClient({ apiKey: "k", fetch: fn }).checkKey();
    expect(calls[0]!.url).toBe("https://api.firecrawl.dev/v2/search");
    await expect(new FirecrawlClient({ apiKey: "bad", fetch: fakeFetch({ success: false, error: "Unauthorized" }, 401).fn }).checkKey()).rejects.toThrow("Unauthorized");
  });
});

describe("pickWorkEmail", () => {
  it("falls back to the work_emails list and plain strings", () => {
    expect(pickWorkEmail({ contact_info: { work_emails: [{ email: "x@y.z", status: "invalid" }, { email: "a@b.c", status: "HIGH_PROBABILITY" }] } })).toEqual({
      email: "a@b.c",
      status: "HIGH_PROBABILITY",
    });
    expect(pickWorkEmail({ contact_info: { most_probable_work_email: "a@b.c" } })).toEqual({ email: "a@b.c" });
    expect(pickWorkEmail(null)).toBeNull();
  });
});
