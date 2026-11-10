import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMonths, createSession, getBalance, runAnnualCreditsTick, signInWithGoogle, STRIPE_API_VERSION, type BillingConfig } from "@meerko/core";
import { createDb, eq, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("annual Pro and the founding offer (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const email = `annual-${run}@billing-test.example`;
  const webhookSecret = "whsec_test";
  const prices = { pro: "price_pro", credits: "price_credits", proAnnual: "price_pro_annual" };

  const objects = new Map<string, Record<string, unknown>>();
  const calls: { method: string; path: string; body: string }[] = [];
  const fakeStripe = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, body: decodeURIComponent(String(init?.body ?? "")) });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });
    if (method === "POST" && url.pathname === "/v1/customers") return json({ id: `cus_${run}`, object: "customer" });
    if (method === "POST" && url.pathname === "/v1/checkout/sessions") return json({ id: "cs_new", object: "checkout.session", url: "https://checkout.stripe.test/cs_new" });
    const id = url.pathname.split("/").pop()!;
    const obj = objects.get(id);
    return obj ? json(obj) : json({ error: { type: "invalid_request_error", message: `No such object: ${id}` } }, 404);
  }) as typeof fetch;
  const stripe = new Stripe("sk_test_fake", { apiVersion: STRIPE_API_VERSION, httpClient: Stripe.createFetchHttpClient(fakeStripe), maxNetworkRetries: 0 });
  const billing: BillingConfig = { stripe, webhookSecret, prices, foundingCoupon: "founding", appUrl: "https://app.example" };
  const app = createApp(db, { billing, credits: { enabled: true }, appUrl: "https://app.example" });
  const coupon = (valid: boolean, times_redeemed = 3) => ({ id: "founding", object: "coupon", valid, max_redemptions: 50, times_redeemed, percent_off: 50 });

  let workspaceId = "";
  let session = "";
  const customer = `cus_${run}`;
  beforeAll(async () => {
    const signedIn = await signInWithGoogle(db, { sub: `sub-${run}`, email, emailVerified: true, name: "Annual Test" }, "open");
    workspaceId = signedIn.workspaceId;
    session = (await createSession(db, signedIn.userId, workspaceId)).token;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.email, email));
  });

  const authed = (path: string, init: RequestInit = {}) =>
    app.request(`https://api.example${path}`, { ...init, headers: { authorization: `Bearer ${session}`, "content-type": "application/json" } });
  const checkout = async (interval?: "month" | "year") => {
    calls.length = 0;
    const res = await authed("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ kind: "pro", ...(interval ? { interval } : {}) }) });
    expect(res.status).toBe(200);
    return calls.find((c) => c.path === "/v1/checkout/sessions")!.body;
  };
  const deliver = (type: string, object: Record<string, unknown>) => {
    const payload = JSON.stringify({ id: `evt_${randomBytes(4).toString("hex")}`, object: "event", type, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    return app.request("https://api.example/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } });
  };

  it("shows both prices and the places left in the founding offer", async () => {
    objects.set("founding", coupon(true, 3));
    const body = await (await authed("/v1/billing")).json();
    expect(body).toMatchObject({ prices: { month: 49, year: 490 }, founding_offer: { percent_off: 50, left: 47, until: "2026-12-31T23:59:59.000Z" }, interval: null });
  });

  it("puts the founding coupon on annual checkouts only", async () => {
    objects.set("founding", coupon(true));
    const annual = await checkout("year");
    expect(annual).toContain("line_items[0][price]=price_pro_annual");
    expect(annual).toContain("discounts[0][coupon]=founding");
    expect(annual).not.toContain("allow_promotion_codes");

    const monthly = await checkout();
    expect(monthly).toContain("line_items[0][price]=price_pro");
    expect(monthly).not.toContain("price_pro_annual");
    expect(monthly).not.toContain("discounts");
    expect(monthly).toContain("allow_promotion_codes=true");
  });

  it("drops the offer once it's sold out or expired", async () => {
    objects.set("founding", coupon(false, 50));
    expect((await (await authed("/v1/billing")).json()).founding_offer).toBeNull();
    const annual = await checkout("year");
    expect(annual).toContain("price_pro_annual");
    expect(annual).not.toContain("discounts");
  });

  it("grants annual Pro's credits every month of the paid year, once each", async () => {
    const start = new Date("2026-01-31T10:00:00Z");
    const end = addMonths(start, 12);
    const sub = {
      id: `sub_${run}`,
      object: "subscription",
      customer,
      status: "active",
      cancel_at_period_end: false,
      cancel_at: null,
      metadata: { workspace_id: workspaceId, kind: "pro" },
      items: {
        object: "list",
        data: [{ id: "si_1", object: "subscription_item", current_period_start: start.getTime() / 1000, current_period_end: end.getTime() / 1000, price: { id: prices.proAnnual, object: "price", recurring: { interval: "year" } } }],
      },
    };
    objects.set(sub.id, sub);
    await deliver("customer.subscription.created", sub);
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(ws).toMatchObject({ plan: "pro", billingInterval: "year" });
    expect((await (await authed("/v1/billing")).json()).interval).toBe("year");

    const before = await getBalance(db, workspaceId);
    // 31 Jan + 1 month is 28 Feb; by 1 Apr, months 2 and 3 (Feb 28, Mar 31) are due. Month 1 came with the invoice.
    await runAnnualCreditsTick(db, new Date("2026-04-01T00:00:00Z"));
    await runAnnualCreditsTick(db, new Date("2026-04-01T00:00:00Z"));
    expect(await getBalance(db, workspaceId)).toBe(before + 2 * 4900);
    // By the end of the year, all 11 later months, never a 12th.
    await runAnnualCreditsTick(db, new Date(addMonths(start, 11).getTime() + 86_400_000));
    await runAnnualCreditsTick(db, new Date(end.getTime() - 1000));
    expect(await getBalance(db, workspaceId)).toBe(before + 11 * 4900);
  });
});
