import { describe, expect, it } from "vitest";
import { companyToRow, IcypeasClient, IcypeasError, icypeasProvider, personToRow, toDomain } from "./icypeas.ts";
import { MissingInputError, type EnrichmentProvider } from "./types.ts";
import { runWaterfall } from "./waterfall.ts";

/** Fake fetch that answers each path from a queue of JSON bodies and records requests. */
function fakeFetch(routes: Record<string, unknown[]>, status = 200) {
  const calls: { path: string; body: any; auth: string | null }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.replace(/^\/api/, "");
    calls.push({ path, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    const queue = routes[path];
    if (!queue?.length) throw new Error(`unexpected request to ${path}`);
    const body = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

const client = (fetch: typeof globalThis.fetch) =>
  new IcypeasClient({ apiKey: "key_123", fetch, sleep: async () => {}, pollIntervalMs: 0 });

const queued = { success: true, item: { _id: "abc", status: "NONE" } };
const readItem = (status: string, emails: unknown[] = []) => ({ success: true, items: [{ status, results: { emails } }] });

describe("IcypeasClient", () => {
  it("polls an email search until it reaches a terminal status", async () => {
    const { fn, calls } = fakeFetch({
      "/email-search": [queued],
      "/bulk-single-searchs/read": [
        readItem("SCHEDULED"),
        readItem("IN_PROGRESS"),
        readItem("DEBITED", [{ email: "pia@slalom.example", certainty: "ultra_sure", mxProvider: "google" }]),
      ],
    });
    const res = await client(fn).emailSearch({ firstname: "Pia", lastname: "Moll", domainOrCompany: "slalom.example" });
    expect(res.emails[0]?.email).toBe("pia@slalom.example");
    expect(calls.map((c) => c.path)).toEqual(["/email-search", ...Array(3).fill("/bulk-single-searchs/read")]);
    expect(calls[0]!.auth).toBe("key_123");
    expect(calls[1]!.body).toEqual({ id: "abc" });
  });

  it("surfaces validation errors returned with HTTP 200", async () => {
    const { fn } = fakeFetch({
      "/email-search": [{ success: false, validationErrors: [{ type: "required", field: "firstname", message: "validation_required" }] }],
    });
    await expect(client(fn).emailSearch({ firstname: "", lastname: "", domainOrCompany: "x.com" })).rejects.toMatchObject({
      code: "required",
      message: "firstname: validation_required",
    });
  });

  it("throws on HTTP errors and on running out of credits", async () => {
    const unauthorized = fakeFetch({ "/email-search": [{ message: "Unauthorized access.", code: "unauthorized_access_error" }] }, 401);
    await expect(client(unauthorized.fn).emailSearch({ firstname: "a", lastname: "b", domainOrCompany: "c.com" })).rejects.toMatchObject({
      code: "unauthorized_access_error",
      status: 401,
    });

    const broke = fakeFetch({ "/email-verification": [queued], "/bulk-single-searchs/read": [readItem("INSUFFICIENT_FUNDS")] });
    await expect(client(broke.fn).verifyEmail("a@b.com")).rejects.toBeInstanceOf(IcypeasError);
  });

  it("times out a search that never finishes", async () => {
    const { fn } = fakeFetch({ "/email-search": [queued], "/bulk-single-searchs/read": [readItem("IN_PROGRESS")] });
    const c = new IcypeasClient({ apiKey: "k", fetch: fn, sleep: async () => {}, pollTimeoutMs: -1 });
    await expect(c.emailSearch({ firstname: "a", lastname: "b", domainOrCompany: "c.com" })).rejects.toMatchObject({ code: "timeout" });
  });

  it("follows pagination tokens and stops at the limit", async () => {
    const lead = (n: number) => ({ name: `Co ${n}` });
    const { fn, calls } = fakeFetch({
      "/find-companies": [
        { success: true, total: 5, leads: [lead(1), lead(2)], pagination: { token: "t1", size: 2 } },
        { success: true, total: 5, leads: [lead(3), lead(4)], pagination: { token: "t2", size: 2 } },
      ],
    });
    const res = await client(fn).findCompanies({ location: { include: ["ES"] } }, 3);
    expect(res.total).toBe(5);
    expect(res.leads.map((l) => l.name)).toEqual(["Co 1", "Co 2", "Co 3"]);
    expect(calls[0]!.body.pagination).toEqual({ size: 3 });
    expect(calls[1]!.body.pagination).toEqual({ token: "t1", size: 2 });
  });
});

describe("icypeasProvider", () => {
  it("finds an email from row fields and charges only on a hit", async () => {
    const hit = fakeFetch({
      "/email-search": [queued],
      "/bulk-single-searchs/read": [readItem("DEBITED", [{ email: "orion@estudio404.example", certainty: "ultra_sure" }])],
    });
    const row = { first_name: "Orión", last_name: "García Vidal", domain: "https://www.estudio404.example/" };
    expect(await icypeasProvider(client(hit.fn)).enrich("email", row)).toMatchObject({
      value: "orion@estudio404.example",
      confidence: "ultra_sure",
      providerCost: 1,
    });
    expect(hit.calls[0]!.body.domainOrCompany).toBe("estudio404.example");

    const miss = fakeFetch({ "/email-search": [queued], "/bulk-single-searchs/read": [readItem("DEBITED_NOT_FOUND")] });
    expect(await icypeasProvider(client(miss.fn)).enrich("email", row)).toMatchObject({ value: null, providerCost: 0 });
  });

  it("rejects rows without enough input", async () => {
    const { fn } = fakeFetch({});
    await expect(icypeasProvider(client(fn)).enrich("email", { first_name: "Ana" })).rejects.toBeInstanceOf(MissingInputError);
  });

  it("returns the verification certainty", async () => {
    const { fn } = fakeFetch({
      "/email-verification": [queued],
      "/bulk-single-searchs/read": [readItem("DEBITED", [{ email: "a@b.com", certainty: "probable" }])],
    });
    expect(await icypeasProvider(client(fn)).enrich("email_verification", { email: "a@b.com" })).toMatchObject({
      value: "probable",
      providerCost: 0.1,
    });
  });
});

describe("runWaterfall", () => {
  const provider = (name: string, impl: EnrichmentProvider["enrich"]): EnrichmentProvider => ({
    name,
    supports: ["email"],
    enrich: impl,
  });

  it("stops at the first provider with a value, skipping misses and errors", async () => {
    let thirdCalled = false;
    const res = await runWaterfall(
      [
        provider("down", async () => {
          throw new Error("503");
        }),
        provider("miss", async () => ({ value: null, providerCost: 0 })),
        provider("hit", async () => ({ value: "a@b.com", confidence: "ultra_sure", providerCost: 1 })),
        provider("never", async () => {
          thirdCalled = true;
          return { value: "x@y.com", providerCost: 1 };
        }),
      ],
      "email",
      {},
    );
    expect(res).toMatchObject({ value: "a@b.com", provider: "hit", providerCost: 1 });
    expect(res.attempts.map((a) => a.outcome)).toEqual(["error", "not_found", "found"]);
    expect(thirdCalled).toBe(false);
  });

  it("ignores providers that don't support the field and reports a total miss", async () => {
    const verifier: EnrichmentProvider = { name: "v", supports: ["email_verification"], enrich: async () => ({ value: "x", providerCost: 0 }) };
    const res = await runWaterfall(
      [
        verifier,
        provider("skip", async () => {
          throw new MissingInputError("no name");
        }),
      ],
      "email",
      {},
    );
    expect(res).toMatchObject({ value: null, provider: null, providerCost: 0 });
    expect(res.attempts).toEqual([{ provider: "skip", outcome: "skipped", providerCost: 0, error: "no name" }]);
  });
});

describe("row mapping", () => {
  it("normalizes domains", () => {
    expect(toDomain("https://www.Tandem.example/business")).toBe("tandem.example");
    expect(toDomain("slalom.example")).toBe("slalom.example");
    expect(toDomain("")).toBeNull();
    expect(toDomain("localhost")).toBeNull();
  });

  it("maps people and companies to flat table rows", () => {
    expect(
      personToRow({ firstname: "Pia", lastname: "Moll", lastJobTitle: "CEO", lastCompanyWebsite: "https://www.slalom.example/" }),
    ).toMatchObject({ first_name: "Pia", title: "CEO", domain: "slalom.example", company_size: null });

    expect(
      companyToRow({
        name: "Trafficker Digital",
        numberOfEmployees: 11,
        headcountRange: { lte: 1 },
        foundedYear: -1,
        urn: "urn:li:fs_salesCompany:37050282",
      }),
    ).toMatchObject({ employees: 11, founded_year: null, company_urn: "37050282" });
  });
});
