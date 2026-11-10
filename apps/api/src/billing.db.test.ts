import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertMailboxAllowed,
  createApiKey,
  createSession,
  getBalance,
  PlanLimitError,
  setPlan,
  signInWithGoogle,
  STRIPE_API_VERSION,
  type BillingConfig,
} from "@meerko/core";
import { createDb, eq, mailboxes, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("billing (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const email = `billing-${run}@billing-test.example`;
  const webhookSecret = "whsec_test";
  const prices = { pro: "price_pro", credits: "price_credits" };

  // Stripe's API, faked: the real SDK runs against these objects, keyed by id.
  const objects = new Map<string, Record<string, unknown>>();
  const calls: { method: string; path: string; body: string }[] = [];
  const fakeStripe = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, path: url.pathname, body: String(init?.body ?? "") });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });
    if (method === "POST" && url.pathname === "/v1/customers") return json({ id: `cus_${run}`, object: "customer" });
    if (method === "POST" && url.pathname === "/v1/checkout/sessions") return json({ id: "cs_new", object: "checkout.session", url: "https://checkout.stripe.test/cs_new" });
    if (method === "POST" && url.pathname === "/v1/billing_portal/sessions") return json({ id: "bps_1", object: "billing_portal.session", url: "https://billing.stripe.test/p" });
    const id = url.pathname.split("/").pop()!;
    const obj = objects.get(id);
    return obj ? json(obj) : json({ error: { type: "invalid_request_error", message: `No such object: ${id}` } }, 404);
  }) as typeof fetch;
  const stripe = new Stripe("sk_test_fake", { apiVersion: STRIPE_API_VERSION, httpClient: Stripe.createFetchHttpClient(fakeStripe), maxNetworkRetries: 0 });
  const billing: BillingConfig = { stripe, webhookSecret, prices, appUrl: "https://app.example" };
  const app = createApp(db, { billing, credits: { enabled: true }, appUrl: "https://app.example" });

  let workspaceId = "";
  let session = "";
  const customer = `cus_${run}`;

  beforeAll(async () => {
    const signedIn = await signInWithGoogle(db, { sub: `sub-${run}`, email, emailVerified: true, name: "Bill Test" }, "open");
    workspaceId = signedIn.workspaceId;
    session = (await createSession(db, signedIn.userId, workspaceId)).token;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.email, email));
  });

  /** Posts a signed event the way Stripe does. */
  const deliver = (type: string, object: Record<string, unknown>, opts: { secret?: string } = {}) => {
    const payload = JSON.stringify({ id: `evt_${randomBytes(4).toString("hex")}`, object: "event", type, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? webhookSecret });
    return app.request("https://api.example/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": signature } });
  };
  const authed = (path: string, init: RequestInit = {}, token = session) =>
    app.request(`https://api.example${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });

  it("rejects a webhook that isn't signed with the endpoint's secret", async () => {
    const res = await deliver("invoice.paid", { id: "in_x" }, { secret: "whsec_other" });
    expect(res.status).toBe(400);
  });

  it("starts Checkout only for a signed-in owner, creating the Stripe customer once", async () => {
    const { key } = await createApiKey(db, workspaceId, "agent");
    const byKey = await authed("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ kind: "pro" }) }, key);
    expect(byKey.status).toBe(403);

    const pro = await authed("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ kind: "pro" }) });
    expect(pro.status).toBe(200);
    expect(await pro.json()).toEqual({ url: "https://checkout.stripe.test/cs_new" });
    const packs = await authed("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ kind: "credits", packs: 3 }) });
    expect(packs.status).toBe(200);

    expect(calls.filter((c) => c.path === "/v1/customers")).toHaveLength(1);
    const creditCheckout = calls.filter((c) => c.path === "/v1/checkout/sessions")[1]!.body;
    expect(decodeURIComponent(creditCheckout)).toContain("line_items[0][quantity]=3");
    expect(decodeURIComponent(creditCheckout)).toContain(`metadata[workspace_id]=${workspaceId}`);
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(ws!.stripeCustomerId).toBe(customer);
  });

  it("grants bought credit packs once, however often Stripe delivers the event", async () => {
    const before = await getBalance(db, workspaceId);
    objects.set("cs_paid", {
      id: "cs_paid",
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      customer,
      client_reference_id: workspaceId,
      metadata: { workspace_id: workspaceId, kind: "credits" },
      line_items: { object: "list", data: [{ id: "li_1", object: "item", quantity: 3, price: { id: prices.credits, object: "price" } }] },
    });
    const event = { id: "cs_paid", object: "checkout.session", mode: "payment" };
    expect((await deliver("checkout.session.completed", event)).status).toBe(200);
    expect((await deliver("checkout.session.completed", event)).status).toBe(200);
    expect(await getBalance(db, workspaceId)).toBe(before + 3000);
  });

  it("waits for an async payment before granting", async () => {
    const before = await getBalance(db, workspaceId);
    const unpaid = { id: "cs_sepa", object: "checkout.session", mode: "payment", payment_status: "unpaid", customer, metadata: { workspace_id: workspaceId, kind: "credits" }, line_items: { object: "list", data: [{ id: "li_2", object: "item", quantity: 1, price: { id: prices.credits, object: "price" } }] } };
    objects.set("cs_sepa", unpaid);
    await deliver("checkout.session.completed", { id: "cs_sepa", object: "checkout.session", mode: "payment" });
    expect(await getBalance(db, workspaceId)).toBe(before);
    objects.set("cs_sepa", { ...unpaid, payment_status: "paid" });
    await deliver("checkout.session.async_payment_succeeded", { id: "cs_sepa", object: "checkout.session", mode: "payment" });
    expect(await getBalance(db, workspaceId)).toBe(before + 1000);
  });

  const subscription = (status: string, extra: Record<string, unknown> = {}) => ({
    id: "sub_1",
    object: "subscription",
    customer,
    status,
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { workspace_id: workspaceId, kind: "pro" },
    items: { object: "list", data: [{ id: "si_1", object: "subscription_item", current_period_end: 1_900_000_000 }] },
    ...extra,
  });

  it("mirrors the subscription onto the workspace, re-reading it from Stripe", async () => {
    // The payload says incomplete, Stripe now says active: the current state wins.
    objects.set("sub_1", subscription("active"));
    await deliver("customer.subscription.created", subscription("incomplete"));
    let [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(ws).toMatchObject({ plan: "pro", subscriptionStatus: "active", stripeSubscriptionId: "sub_1", cancelAtPeriodEnd: false });
    expect(ws!.currentPeriodEnd?.getTime()).toBe(1_900_000_000_000);

    objects.set("sub_1", subscription("past_due", { cancel_at_period_end: true }));
    await deliver("customer.subscription.updated", subscription("past_due"));
    [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(ws).toMatchObject({ plan: "pro", subscriptionStatus: "past_due", cancelAtPeriodEnd: true });

    const res = await authed("/v1/billing");
    expect(await res.json()).toMatchObject({ enabled: true, plan: "pro", status: "past_due", cancel_at_period_end: true, has_customer: true });
  });

  it("refuses a second Pro checkout", async () => {
    const res = await authed("/v1/billing/checkout", { method: "POST", body: JSON.stringify({ kind: "pro" }) });
    expect(res.status).toBe(409);
  });

  it("grants Pro's monthly credits for the first and each renewal invoice, once each", async () => {
    const invoice = (id: string, billing_reason: string) => ({
      id,
      object: "invoice",
      customer,
      status: "paid",
      billing_reason,
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { workspace_id: workspaceId } } },
    });
    const before = await getBalance(db, workspaceId);
    for (const [id, reason] of [["in_1", "subscription_create"], ["in_2", "subscription_cycle"], ["in_3", "subscription_update"]] as const) {
      objects.set(id, invoice(id, reason));
      await deliver("invoice.paid", { id, object: "invoice" });
    }
    await deliver("invoice.paid", { id: "in_2", object: "invoice" });
    expect(await getBalance(db, workspaceId)).toBe(before + 2 * 4900);
  });

  it("drops to Free when the subscription ends; Pro's monthly credits lapse, bought ones stay", async () => {
    const before = await getBalance(db, workspaceId);
    objects.set("sub_1", subscription("canceled"));
    await deliver("customer.subscription.deleted", subscription("canceled"));
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(ws!.plan).toBe("free");
    // The two unspent monthly grants (4,900 each) go; the 1,000 bought earlier stays.
    expect(await getBalance(db, workspaceId)).toBe(before - 2 * 4900);
    // A redelivered event expires nothing twice.
    await deliver("customer.subscription.deleted", subscription("canceled"));
    expect(await getBalance(db, workspaceId)).toBe(before - 2 * 4900);
  });

  it("caps Free at one mailbox, but always lets a mailbox reconnect", async () => {
    await db.insert(mailboxes).values({ workspaceId, provider: "gmail", email: `one-${run}@example.com`, encryptedRefreshToken: "x" });
    await expect(assertMailboxAllowed(db, workspaceId, `two-${run}@example.com`)).rejects.toBeInstanceOf(PlanLimitError);
    await expect(assertMailboxAllowed(db, workspaceId, `One-${run}@example.com`)).resolves.toBeUndefined();
    await setPlan(db, workspaceId, "pro");
    await expect(assertMailboxAllowed(db, workspaceId, `two-${run}@example.com`)).resolves.toBeUndefined();
  });

  it("opens the customer portal for the workspace's customer", async () => {
    const res = await authed("/v1/billing/portal", { method: "POST" });
    expect(await res.json()).toEqual({ url: "https://billing.stripe.test/p" });
  });

  it("reports the plan and where to buy on GET /v1/credits", async () => {
    const res = await authed("/v1/credits");
    expect(await res.json()).toMatchObject({ enabled: true, plan: "pro", buy_url: "https://app.example/app/settings#billing" });
  });
});
