/**
 * Calls Generect's real API through Meerko's adapter, to check the contract the unit tests fake.
 * Use a test key (`test_…`): fictional data, nothing charged. A live key works too but spends money.
 *
 *   GENERECT_API_KEY=test_… pnpm --filter @meerko/core exec tsx scripts/generect-smoke.mts
 */
import { GenerectClient, GenerectError, generectProvider, MissingInputError } from "../src/index.ts";

const apiKey = process.env.GENERECT_API_KEY;
if (!apiKey) throw new Error("Set GENERECT_API_KEY");
const live = !apiKey.startsWith("test_");
if (live) console.warn("Live key: found emails and phones are charged to your Generect balance.");

const client = new GenerectClient({ apiKey });
const provider = generectProvider(client);
const ok: string[] = [];
const fail: string[] = [];
const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    ok.push(name);
    console.log(`ok    ${name}`);
  } catch (err) {
    fail.push(name);
    console.log(`FAIL  ${name}: ${(err as Error).message}`);
  }
};
const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(msg);
};

// accounts/me answers with the real account even on a test key, so the test-mode header is checked on a lookup.
await check("key works, and test mode is on", async () => {
  await client.checkKey();
  const res = await fetch("https://api.generect.com/api/v1/email/find/", {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ linkedin_url: "https://www.linkedin.com/in/sandbox-not-found" }),
  });
  assert(res.ok, `email/find answered ${res.status}`);
  if (!live) assert(res.headers.get("x-generect-mode") === "test", "no X-Generect-Mode: test header");
});

await check("email by name and domain", async () => {
  const r = await provider.enrich("email", { first_name: "Ada", last_name: "Testwell", domain: "https://www.microsoft.com/about" });
  console.log("      ", r);
  assert(typeof r.value === "string" && r.value.endsWith("@microsoft.com"), "no email on the asked domain");
  assert(r.confidence === "very_sure", `a valid, non-catch-all email should be very_sure, got ${r.confidence}`);
  assert(typeof r.providerCost === "number", "no amount_charged");
});

await check("email by LinkedIn URL", async () => {
  const r = await provider.enrich("email", { linkedin_url: "https://www.linkedin.com/in/sandbox-ada" });
  console.log("      ", r);
  assert(r.value === null || typeof r.value === "string", "unexpected value");
});

await check("email miss is free", async () => {
  const r = await provider.enrich("email", { linkedin_url: "https://www.linkedin.com/in/sandbox-not-found" });
  console.log("      ", r);
  assert(r.value === null && r.providerCost === 0, "a miss came back with a value or a charge");
});

await check("phone by name and company", async () => {
  const r = await provider.enrich("phone", { first_name: "Ada", last_name: "Testwell", company: "Microsoft" });
  console.log("      ", r);
  assert(r.value === null || (typeof r.value === "string" && r.value.startsWith("+")), "phone isn't E.164");
  if (r.value) assert(r.confidence === "mobile" || r.confidence === "fixed_line" || r.confidence === "voip", `unexpected phone type ${r.confidence}`);
});

await check("phone miss is free", async () => {
  const r = await provider.enrich("phone", { linkedin_url: "https://www.linkedin.com/in/sandbox-not-found" });
  console.log("      ", r);
  assert(r.value === null && r.providerCost === 0, "a miss came back with a value or a charge");
});

// Test mode forces failures with a header (ignored by live keys), so these only run on a test key.
const forcing = (behaviour: string) =>
  new GenerectClient({
    apiKey,
    fetch: (url, init) => fetch(url, { ...init, headers: { ...(init?.headers as Record<string, string>), "X-Generect-Test-Behaviour": behaviour } }),
  });
for (const [behaviour, code] of [["insufficient_funds", "insufficient_funds"], ["rate_limited", "rate_limited"]] as const) {
  if (live) break;
  await check(`${behaviour} becomes a GenerectError (${code})`, async () => {
    const e = await forcing(behaviour).findEmail({ firstName: "Ada", lastName: "Testwell", domain: "microsoft.com" }).catch((err) => err);
    console.log("      ", e instanceof GenerectError ? { code: e.code, status: e.status, message: e.message } : e);
    assert(e instanceof GenerectError && e.code === code, `expected ${code}`);
  });
}

await check("a row without enough to go on is skipped, not sent", async () => {
  const err = await provider.enrich("email", { first_name: "Ada" }).catch((e) => e);
  assert(err instanceof MissingInputError, "expected MissingInputError");
});

console.log(`\n${ok.length} ok, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
