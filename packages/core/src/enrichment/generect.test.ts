import { describe, expect, it } from "vitest";
import { GenerectClient, GenerectError, generectProvider } from "./generect.ts";
import { MissingInputError } from "./types.ts";

/** Fake fetch that answers every request with `body` and records what was sent. */
function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; method: string; body: any; auth: string | null }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

const ana = { first_name: "Ana", last_name: "Ruiz", domain: "https://www.acme.es/about", company: "Acme" };
const client = (body: unknown, status = 200) => {
  const f = fakeFetch(body, status);
  return { provider: generectProvider(new GenerectClient({ apiKey: "g-key", fetch: f.fn })), calls: f.calls };
};

describe("generectProvider", () => {
  it("finds an email by name and domain, with the Token header and trailing slash", async () => {
    const { provider, calls } = client({ data: { valid_email: "ana@acme.es", result: "valid", catch_all: false }, meta: { amount_charged: 0.02 } });
    expect(await provider.enrich("email", ana)).toEqual({ value: "ana@acme.es", confidence: "very_sure", providerCost: 0.02 });
    expect(calls[0]).toMatchObject({
      url: "https://api.generect.com/api/v1/email/find/",
      method: "POST",
      auth: "Token g-key",
      body: { first_name: "Ana", last_name: "Ruiz", domain: "acme.es" },
    });
  });

  it("marks catch-all emails probable and treats a null email as a free miss", async () => {
    const catchAll = client({ data: { valid_email: "ana@acme.es", result: "valid", catch_all: true }, meta: { amount_charged: 0.02 } });
    expect(await catchAll.provider.enrich("email", ana)).toMatchObject({ confidence: "probable" });
    // The live API sends catch_all as a string.
    const asText = client({ data: { valid_email: "ana@acme.es", result: "valid", catch_all: "false" }, meta: { amount_charged: 0.02 } });
    expect(await asText.provider.enrich("email", ana)).toMatchObject({ confidence: "very_sure" });
    const asTextTrue = client({ data: { valid_email: "ana@acme.es", result: "valid", catch_all: "true" }, meta: { amount_charged: 0.02 } });
    expect(await asTextTrue.provider.enrich("email", ana)).toMatchObject({ confidence: "probable" });
    const miss = client({ data: { valid_email: null }, meta: { amount_charged: 0 } });
    expect(await miss.provider.enrich("email", ana)).toEqual({ value: null, providerCost: 0 });
  });

  it("prefers a LinkedIn URL, and finds phones by name and company", async () => {
    const byUrl = client({ data: { valid_email: null }, meta: { amount_charged: 0 } });
    await byUrl.provider.enrich("email", { ...ana, linkedin_url: "https://www.linkedin.com/in/ana" });
    expect(byUrl.calls[0]!.body).toEqual({ linkedin_url: "https://www.linkedin.com/in/ana" });

    const phone = client({ data: { phone: { number: "+34600111222", status: "FOUND", type: "MOBILE", country: "ES" } }, meta: { amount_charged: 0.4 } });
    expect(await phone.provider.enrich("phone", ana)).toEqual({ value: "+34600111222", confidence: "mobile", providerCost: 0.4 });
    expect(phone.calls[0]).toMatchObject({ url: "https://api.generect.com/api/v1/phone/find/", body: { first_name: "Ana", last_name: "Ruiz", company: "Acme" } });

    const none = client({ data: { phone: { number: null, status: "NOT_FOUND" } }, meta: { amount_charged: 0 } });
    expect(await none.provider.enrich("phone", ana)).toEqual({ value: null, providerCost: 0 });
  });

  it("says what a row is missing, and doesn't verify", async () => {
    const { provider } = client({});
    await expect(provider.enrich("email", { first_name: "Ana", last_name: "Ruiz", company: "Acme" })).rejects.toBeInstanceOf(MissingInputError);
    await expect(provider.enrich("phone", { first_name: "Ana", company: "Acme" })).rejects.toBeInstanceOf(MissingInputError);
    await expect(provider.enrich("email_verification", { email: "a@b.c" })).rejects.toBeInstanceOf(MissingInputError);
    expect(provider).toMatchObject({ name: "generect", supports: ["email", "phone"], ownKey: false });
    expect(generectProvider(new GenerectClient({ apiKey: "k" }), { ownKey: true }).ownKey).toBe(true);
  });

  it("turns error envelopes into a GenerectError with a code", async () => {
    const broke = fakeFetch({ status: "error", status_code: 402, detail: "Insufficient funds in the account." }, 402);
    const err = await new GenerectClient({ apiKey: "k", fetch: broke.fn }).findEmail({ firstName: "A", lastName: "B", domain: "c.io" }).catch((e) => e);
    expect(err).toBeInstanceOf(GenerectError);
    expect(err).toMatchObject({ code: "insufficient_funds", status: 402, message: "Insufficient funds in the account." });

    const invalid = fakeFetch({ detail: { non_field_errors: ["Provide one of: lead_id, linkedin_url."] } }, 400);
    await expect(new GenerectClient({ apiKey: "k", fetch: invalid.fn }).checkKey()).rejects.toThrow("Provide one of: lead_id, linkedin_url.");
    expect(invalid.calls[0]).toMatchObject({ url: "https://api.generect.com/api/v1/accounts/me/", method: "GET", body: undefined });
  });
});
