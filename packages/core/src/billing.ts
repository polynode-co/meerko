import Stripe from "stripe";
import { creditLedger, eq, inArray, mailboxes, workspaces, type Db, type Plan } from "@meerko/db";
import { billingWorkspaceOf, sharesBilling } from "./workspaces.ts";

/** Credits a Pro subscription adds on each paid month (the $49 plan at $1 = 100 credits). */
export const PRO_MONTHLY_CREDITS = 4900;
/** Credits in one top-up pack ($10 at $1 = 100 credits). Checkout lets the buyer pick how many packs. */
export const CREDIT_PACK_CREDITS = 1000;
export const MAX_CREDIT_PACKS = 100;
/** Mailboxes a workspace may connect on each plan. Only enforced when billing is on (Meerko Cloud). */
export const PLAN_MAILBOXES: Record<Plan, number> = { free: 1, pro: Number.POSITIVE_INFINITY };

/** Stripe statuses that keep Pro. `past_due` keeps it while Stripe retries the card. */
const PRO_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

/** Meerko Cloud's Stripe setup. Unset (self-hosting) means no billing routes and no plan limits. */
export interface BillingConfig {
  stripe: Stripe;
  webhookSecret: string;
  prices: { pro: string; credits: string };
  /** The dashboard's URL; Checkout and the portal send the browser back to its Settings page. */
  appUrl: string;
  /** A billing portal configuration (bpc_…); the account's default when unset. */
  portalConfiguration?: string;
  /** Stripe Tax: only once the account has a head office address and its tax registrations. */
  automaticTax?: boolean;
}

/** The pinned API version, so objects have the shape this file expects whatever the account's default is. */
export const STRIPE_API_VERSION = "2026-08-26.dahlia" as const;

export function stripeFromEnv(env: NodeJS.ProcessEnv = process.env): BillingConfig | undefined {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_CREDITS, MEERKO_APP_URL } = env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !STRIPE_PRICE_PRO || !STRIPE_PRICE_CREDITS || !MEERKO_APP_URL) return undefined;
  return {
    stripe: new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION }),
    webhookSecret: STRIPE_WEBHOOK_SECRET,
    prices: { pro: STRIPE_PRICE_PRO, credits: STRIPE_PRICE_CREDITS },
    appUrl: MEERKO_APP_URL,
    portalConfiguration: env.STRIPE_PORTAL_CONFIGURATION || undefined,
    automaticTax: env.STRIPE_AUTOMATIC_TAX === "on",
  };
}

/** Refused for the workspace's plan (e.g. a second mailbox on Free). The message is safe to show. */
export class PlanLimitError extends Error {}

/** A billing request that doesn't fit the workspace's state (already on Pro, nothing to manage yet). */
export class BillingError extends Error {}

/** Stripe refused or couldn't be reached (bad key, outage, rate limit). */
export const isStripeError = (err: unknown): err is Stripe.errors.StripeError => err instanceof Stripe.errors.StripeError;

/** The plan and subscription `workspaceId` runs on: those of the workspace that pays for it (`billingWorkspaceOf`). */
export async function getBilling(db: Db, workspaceId: string) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const [ws] = await db
    .select({
      plan: workspaces.plan,
      status: workspaces.subscriptionStatus,
      currentPeriodEnd: workspaces.currentPeriodEnd,
      cancelAtPeriodEnd: workspaces.cancelAtPeriodEnd,
      customerId: workspaces.stripeCustomerId,
      subscriptionId: workspaces.stripeSubscriptionId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
  return ws;
}

/**
 * Throws if connecting `email` would take the plan over its mailbox count. The count is across every workspace on
 * the same plan, so a second brand doesn't get a second free mailbox. Reconnecting a mailbox the workspace already
 * has is always allowed.
 */
export async function assertMailboxAllowed(db: Db, workspaceId: string, email: string) {
  const { plan } = await getBilling(db, workspaceId);
  const limit = PLAN_MAILBOXES[plan];
  if (!Number.isFinite(limit)) return;
  const billingId = await billingWorkspaceOf(db, workspaceId);
  const shared = db.select({ id: workspaces.id }).from(workspaces).where(sharesBilling(billingId));
  const rows = await db
    .select({ email: mailboxes.email, workspaceId: mailboxes.workspaceId })
    .from(mailboxes)
    .where(inArray(mailboxes.workspaceId, shared));
  if (rows.some((m) => m.workspaceId === workspaceId && m.email === email.toLowerCase())) return;
  if (rows.length >= limit) {
    throw new PlanLimitError(`The Free plan includes ${limit} mailbox. Upgrade to Pro in Settings to connect more.`);
  }
}

/** The workspace's Stripe customer, created on first use. The idempotency key stops two tabs creating two. */
async function ensureCustomer(db: Db, cfg: BillingConfig, workspaceId: string, email: string) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
  if (ws.stripeCustomerId) return ws.stripeCustomerId;
  const customer = await cfg.stripe.customers.create(
    { email, name: ws.name, metadata: { workspace_id: workspaceId } },
    { idempotencyKey: `meerko-customer-${workspaceId}` },
  );
  await db.update(workspaces).set({ stripeCustomerId: customer.id }).where(eq(workspaces.id, workspaceId));
  return customer.id;
}

export type CheckoutInput = { kind: "pro" } | { kind: "credits"; packs: number };

/** A Stripe Checkout page for Pro or for credit packs. Returns its URL. */
export async function startCheckout(db: Db, cfg: BillingConfig, workspaceId: string, email: string, input: CheckoutInput) {
  // Stripe only ever sees the workspace that pays, so webhooks credit and upgrade the shared plan.
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const billing = await getBilling(db, workspaceId);
  if (input.kind === "pro" && billing.plan === "pro") throw new BillingError("This workspace is already on Pro (your workspaces share one plan). Manage it from Settings → Manage billing.");
  const customer = await ensureCustomer(db, cfg, workspaceId, email);
  const settings = `${cfg.appUrl.replace(/\/$/, "")}/app/settings`;
  const metadata = { workspace_id: workspaceId, kind: input.kind };
  const common = {
    customer,
    client_reference_id: workspaceId,
    metadata,
    cancel_url: settings,
    // With Stripe Tax on, the address typed at checkout is the one tax is worked out from.
    ...(cfg.automaticTax ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" as const, name: "auto" as const } } : {}),
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
  };
  const session =
    input.kind === "pro"
      ? await cfg.stripe.checkout.sessions.create({
          ...common,
          mode: "subscription",
          line_items: [{ price: cfg.prices.pro, quantity: 1 }],
          subscription_data: { metadata },
          success_url: `${settings}?billing=pro`,
        })
      : await cfg.stripe.checkout.sessions.create({
          ...common,
          mode: "payment",
          line_items: [
            {
              price: cfg.prices.credits,
              quantity: Math.min(Math.max(1, Math.floor(input.packs)), MAX_CREDIT_PACKS),
              adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_CREDIT_PACKS },
            },
          ],
          payment_intent_data: { metadata },
          // A receipt is not an invoice; businesses need one for VAT.
          invoice_creation: { enabled: true, invoice_data: { metadata } },
          success_url: `${settings}?billing=credits`,
        });
  if (!session.url) throw new Error("Stripe returned a Checkout session without a URL");
  return session.url;
}

/** Stripe's customer portal: card, invoices, cancelling Pro. */
export async function openPortal(db: Db, cfg: BillingConfig, workspaceId: string) {
  const { customerId } = await getBilling(db, workspaceId);
  if (!customerId) throw new BillingError("Nothing to manage yet: this workspace hasn't bought anything.");
  const session = await cfg.stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${cfg.appUrl.replace(/\/$/, "")}/app/settings`,
    ...(cfg.portalConfiguration ? { configuration: cfg.portalConfiguration } : {}),
  });
  return session.url;
}

/** Adds credits once per Stripe object: a redelivered webhook hits the unique `external_ref` and does nothing. */
async function grantOnce(db: Db, workspaceId: string, amount: number, reason: string, externalRef: string) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const inserted = await db
    .insert(creditLedger)
    .values({ workspaceId, delta: amount, reason, externalRef })
    .onConflictDoNothing({ target: creditLedger.externalRef })
    .returning({ id: creditLedger.id });
  return inserted.length > 0;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id);

async function workspaceForCustomer(db: Db, customerId: string | undefined, hint?: string | null) {
  if (hint) {
    const [ws] = await db.select({ id: workspaces.id, billing: workspaces.billingWorkspaceId }).from(workspaces).where(eq(workspaces.id, hint));
    if (ws) return ws.billing ?? ws.id;
  }
  if (!customerId) return undefined;
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.stripeCustomerId, customerId));
  return ws?.id;
}

/** Mirrors a subscription onto its workspace. Always re-read from Stripe, so out-of-order events can't regress it. */
async function syncSubscription(db: Db, cfg: BillingConfig, subscriptionId: string) {
  const sub = await cfg.stripe.subscriptions.retrieve(subscriptionId);
  const workspaceId = await workspaceForCustomer(db, idOf(sub.customer), sub.metadata?.workspace_id);
  if (!workspaceId) return null;
  const pro = PRO_STATUSES.has(sub.status);
  // A workspace that cancelled one subscription and started another must not be downgraded by the old one's events.
  const [ws] = await db.select({ subscriptionId: workspaces.stripeSubscriptionId }).from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!pro && ws?.subscriptionId && ws.subscriptionId !== sub.id) return { workspaceId, plan: null };
  const periodEnd = sub.items.data[0]?.current_period_end;
  await db
    .update(workspaces)
    .set({
      plan: pro ? "pro" : "free",
      stripeCustomerId: idOf(sub.customer),
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at,
    })
    .where(eq(workspaces.id, workspaceId));
  return { workspaceId, plan: pro ? ("pro" as const) : ("free" as const) };
}

/** Credit packs bought in a paid Checkout session. */
async function grantCreditPacks(db: Db, cfg: BillingConfig, sessionId: string) {
  const session = await cfg.stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  if (session.mode !== "payment" || session.metadata?.kind !== "credits" || session.payment_status !== "paid") return null;
  const workspaceId = await workspaceForCustomer(db, idOf(session.customer), session.metadata?.workspace_id ?? session.client_reference_id);
  if (!workspaceId) return null;
  const packs = (session.line_items?.data ?? []).filter((li) => li.price?.id === cfg.prices.credits).reduce((n, li) => n + (li.quantity ?? 0), 0);
  if (packs <= 0) return null;
  const credits = packs * CREDIT_PACK_CREDITS;
  const granted = await grantOnce(db, workspaceId, credits, "purchase", `stripe:${session.id}`);
  return { workspaceId, credits, granted };
}

/** Pro's monthly credits, granted when the first and each renewal invoice is paid. */
async function grantMonthlyCredits(db: Db, cfg: BillingConfig, invoiceId: string) {
  const invoice = await cfg.stripe.invoices.retrieve(invoiceId);
  if (invoice.billing_reason !== "subscription_create" && invoice.billing_reason !== "subscription_cycle") return null;
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId || invoice.status !== "paid") return null;
  const workspaceId = await workspaceForCustomer(db, idOf(invoice.customer), invoice.parent?.subscription_details?.metadata?.workspace_id);
  if (!workspaceId) return null;
  const granted = await grantOnce(db, workspaceId, PRO_MONTHLY_CREDITS, "pro_monthly", `stripe:${invoice.id}`);
  return { workspaceId, credits: PRO_MONTHLY_CREDITS, granted };
}

/** What a webhook did, for analytics. `null` when the event needed nothing. */
export type BillingOutcome =
  | { type: "subscription"; workspaceId: string; plan: Plan | null; status: string }
  | { type: "credits"; workspaceId: string; credits: number; reason: "purchase" | "pro_monthly"; granted: boolean }
  | null;

/** The events the webhook endpoint subscribes to (terraform/app/stripe.tf lists the same ones). */
export const STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
] as const;

/** Verifies a webhook's signature and returns the event; throws on a forged or stale one. */
export function verifyStripeEvent(cfg: BillingConfig, payload: string, signature: string) {
  return cfg.stripe.webhooks.constructEvent(payload, signature, cfg.webhookSecret);
}

/**
 * Applies a Stripe event. Only the event's type and object id are trusted from the payload; the object
 * is re-read from the API, so its shape follows the pinned API version and the state is current.
 */
export async function handleStripeEvent(db: Db, cfg: BillingConfig, event: Stripe.Event): Promise<BillingOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.mode === "subscription") {
        const subscriptionId = idOf(session.subscription);
        if (!subscriptionId) return null;
        const synced = await syncSubscription(db, cfg, subscriptionId);
        return synced ? { type: "subscription", workspaceId: synced.workspaceId, plan: synced.plan, status: "checkout_completed" } : null;
      }
      const result = await grantCreditPacks(db, cfg, session.id);
      return result ? { type: "credits", reason: "purchase", ...result } : null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const synced = await syncSubscription(db, cfg, event.data.object.id);
      return synced ? { type: "subscription", workspaceId: synced.workspaceId, plan: synced.plan, status: event.type.split(".").pop()! } : null;
    }
    case "invoice.paid": {
      const id = event.data.object.id;
      if (!id) return null;
      const result = await grantMonthlyCredits(db, cfg, id);
      return result ? { type: "credits", reason: "pro_monthly", ...result } : null;
    }
    default:
      return null;
  }
}

/** Sets a workspace's plan by hand, e.g. to comp Pro for a design partner. Stripe webhooks don't touch it without a subscription. */
export async function setPlan(db: Db, workspaceId: string, plan: Plan) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const [ws] = await db
    .update(workspaces)
    .set({ plan })
    .where(eq(workspaces.id, workspaceId))
    .returning({ id: workspaces.id, name: workspaces.name, plan: workspaces.plan });
  return ws ?? null;
}
