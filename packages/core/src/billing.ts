import Stripe from "stripe";
import { and, asc, creditLedger, eq, inArray, isNotNull, isNull, mailboxes, workspaces, type Db, type Plan } from "@meerko/db";
import { lapseMonthlyCredits, monthlyCreditsExpiry } from "./credits.ts";
import { billingWorkspaceOf, sharesBilling } from "./workspaces.ts";

/** Credits a Pro subscription adds on each paid month (the $49 plan at $1 = 100 credits). */
export const PRO_MONTHLY_CREDITS = 4900;
/** Pro's prices, matching core-infrastructure apps/meerko/app/stripe.tf: $49 a month, or $490 a year ($41/month). */
export const PRO_PRICES = { month: 49, year: 490 } as const;
export type BillingInterval = keyof typeof PRO_PRICES;
/**
 * The founding offer, matching the coupon in stripe.tf: 50% off the first year of annual Pro, for the first 50, until
 * the end of 2026. Each workspace has `claimDays` to take it from the first time it's shown the offer.
 */
export const FOUNDING_OFFER = { percentOff: 50, maxRedemptions: 50, redeemBy: new Date("2026-12-31T23:59:59Z"), claimDays: 30 } as const;
/** Credits in one top-up pack ($10 at $1 = 100 credits). Checkout lets the buyer pick how many packs. */
export const CREDIT_PACK_CREDITS = 1000;
export const MAX_CREDIT_PACKS = 100;
/** Mailboxes a workspace may connect on each plan. Only enforced when billing is on (Meerko Cloud). */
export const PLAN_MAILBOXES: Record<Plan, number> = { free: 1, pro: Number.POSITIVE_INFINITY };
/**
 * Whether a plan finds phone numbers on Meerko's provider key. A phone costs us $0.40 at Generect, so on Free the 200
 * signup credits would be spent on our money. A workspace's own Generect key is a Pro feature like any own key.
 */
export const PLAN_PHONES: Record<Plan, boolean> = { free: false, pro: true };

/**
 * Whether a plan may use the workspace's own provider keys (Icypeas, Firecrawl, Generect). Only enforced when billing
 * is on (Meerko Cloud): self-hosting is always on your own keys. On Free, Cloud runs on Meerko's keys and credits.
 */
export const PLAN_OWN_KEYS: Record<Plan, boolean> = { free: false, pro: true };
export const OWN_KEYS_PRO_MESSAGE =
  "Using your own provider keys on Meerko Cloud needs the Pro plan (Plan & credits in Connections). Self-hosted Meerko runs on your own keys for free.";

/** True if the workspace's plan lets it use its own provider keys. */
export async function ownKeysAllowed(db: Db, workspaceId: string) {
  const { plan } = await getBilling(db, workspaceId);
  return PLAN_OWN_KEYS[plan];
}

/** Throws a PlanLimitError if the workspace's plan can't use its own provider keys. */
export async function assertOwnKeysAllowed(db: Db, workspaceId: string) {
  if (!(await ownKeysAllowed(db, workspaceId))) throw new PlanLimitError(OWN_KEYS_PRO_MESSAGE);
}

/** Stripe statuses that keep Pro. `past_due` keeps it while Stripe retries the card. */
const PRO_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);
/** A subscription that is over for good, so Pro's monthly credits lapse. */
const ENDED_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "unpaid", "incomplete_expired"]);

/** Meerko Cloud's Stripe setup. Unset (self-hosting) means no billing routes and no plan limits. */
export interface BillingConfig {
  stripe: Stripe;
  webhookSecret: string;
  /** `proAnnual` is optional, so a deployment without the annual price still sells monthly Pro. */
  prices: { pro: string; credits: string; proAnnual?: string };
  /** The founding-offer coupon, applied on its own to annual checkouts while Stripe says it's still valid. */
  foundingCoupon?: string;
  /** The dashboard's URL; Checkout and the portal send the browser back to its Connections page. */
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
    prices: { pro: STRIPE_PRICE_PRO, credits: STRIPE_PRICE_CREDITS, proAnnual: env.STRIPE_PRICE_PRO_ANNUAL || undefined },
    foundingCoupon: env.STRIPE_COUPON_FOUNDING || undefined,
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
      billingInterval: workspaces.billingInterval,
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
    .select({ email: mailboxes.email, workspaceId: mailboxes.workspaceId, workspaceName: workspaces.name })
    .from(mailboxes)
    .innerJoin(workspaces, eq(workspaces.id, mailboxes.workspaceId))
    .where(inArray(mailboxes.workspaceId, shared))
    .orderBy(asc(mailboxes.createdAt));
  if (rows.some((m) => m.workspaceId === workspaceId && m.email === email.toLowerCase())) return;
  if (rows.length >= limit) throw new PlanLimitError(mailboxLimitText(limit, rows, workspaceId));
}

/**
 * Why a connect was refused: which mailbox holds the Free slot and where. A mailbox in another workspace is named
 * by its workspace only, since a member of this one may not be a member of that one.
 */
export function mailboxLimitText(limit: number, used: { email: string; workspaceId: string; workspaceName: string }[], workspaceId: string) {
  const here = used.find((m) => m.workspaceId === workspaceId);
  const holder = here ? here.email : `a mailbox in your "${used[0]?.workspaceName}" workspace (the plan is shared by all your workspaces)`;
  const fix = here ? "Disconnect it" : "Disconnect it there";
  return `The Free plan includes ${limit} mailbox, and ${holder} already uses it. ${fix} to connect another; the Pro plan (Plan & credits in Connections) has unlimited mailboxes.`;
}

/** Throws unless the workspace's plan includes phone numbers on Meerko's key (`PLAN_PHONES`). */
export async function assertPhonesAllowed(db: Db, workspaceId: string) {
  const { plan } = await getBilling(db, workspaceId);
  if (!PLAN_PHONES[plan]) {
    throw new PlanLimitError("Finding phone numbers needs the Pro plan (Plan & credits in Connections), or your own Generect key on Free.");
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

export type CheckoutInput = { kind: "pro"; interval?: BillingInterval } | { kind: "credits"; packs: number };

/**
 * How many founding-offer places are left, or null when there's no offer (no coupon configured, sold out, expired,
 * or Stripe unreachable). Read from the coupon itself, so the count is Stripe's.
 */
/**
 * The founding offer as this workspace sees it: places left and its own deadline (30 days from when it was first
 * shown the offer, and never past the coupon's end), or null when it's gone or the window has passed. The first call
 * that finds the offer open starts the workspace's window. Pro workspaces get null and start nothing.
 */
export async function foundingOfferFor(db: Db, cfg: BillingConfig, workspaceId: string, now = new Date()) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const [ws] = await db.select({ plan: workspaces.plan, seenAt: workspaces.foundingOfferSeenAt }).from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws || ws.plan === "pro") return null;
  if (now > FOUNDING_OFFER.redeemBy) return null;
  if (ws.seenAt && now.getTime() > ws.seenAt.getTime() + FOUNDING_OFFER.claimDays * 86_400_000) return null;
  const left = await foundingOfferLeft(cfg);
  if (left === null) return null;
  let seenAt = ws.seenAt;
  if (!seenAt) {
    seenAt = now;
    await db.update(workspaces).set({ foundingOfferSeenAt: now }).where(and(eq(workspaces.id, workspaceId), isNull(workspaces.foundingOfferSeenAt)));
  }
  const until = new Date(Math.min(seenAt.getTime() + FOUNDING_OFFER.claimDays * 86_400_000, FOUNDING_OFFER.redeemBy.getTime()));
  return { left, until };
}

export async function foundingOfferLeft(cfg: BillingConfig): Promise<number | null> {
  if (!cfg.foundingCoupon || !cfg.prices.proAnnual) return null;
  try {
    const coupon = await cfg.stripe.coupons.retrieve(cfg.foundingCoupon);
    if (!coupon.valid) return null;
    const left = (coupon.max_redemptions ?? FOUNDING_OFFER.maxRedemptions) - coupon.times_redeemed;
    return left > 0 ? left : null;
  } catch (err) {
    if (isStripeError(err)) return null;
    throw err;
  }
}

/** A Stripe Checkout page for Pro or for credit packs. Returns its URL. */
export async function startCheckout(db: Db, cfg: BillingConfig, workspaceId: string, email: string, input: CheckoutInput) {
  // Stripe only ever sees the workspace that pays, so webhooks credit and upgrade the shared plan.
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const billing = await getBilling(db, workspaceId);
  if (input.kind === "pro" && billing.plan === "pro") throw new BillingError("This workspace is already on Pro (your workspaces share one plan). Manage it from Connections → Manage billing.");
  const annual = input.kind === "pro" && input.interval === "year";
  if (annual && !cfg.prices.proAnnual) throw new BillingError("Annual Pro isn't available on this server yet. Pick monthly.");
  // The founding coupon goes on by itself while places are left. Stripe refuses `discounts` together with
  // promotion codes, so an annual checkout with the offer doesn't take codes.
  const founding = annual && (await foundingOfferFor(db, cfg, workspaceId)) !== null;
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
    ...(founding ? { discounts: [{ coupon: cfg.foundingCoupon! }] } : { allow_promotion_codes: true }),
  };
  const session =
    input.kind === "pro"
      ? await cfg.stripe.checkout.sessions.create({
          ...common,
          mode: "subscription",
          line_items: [{ price: annual ? cfg.prices.proAnnual! : cfg.prices.pro, quantity: 1 }],
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
async function grantOnce(db: Db, workspaceId: string, amount: number, reason: string, externalRef: string, expiresAt?: Date) {
  workspaceId = await billingWorkspaceOf(db, workspaceId);
  const inserted = await db
    .insert(creditLedger)
    .values({ workspaceId, delta: amount, reason, externalRef, ...(expiresAt ? { expiresAt, remaining: amount } : {}) })
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
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;
  const periodStart = item?.current_period_start;
  const interval = item?.price?.recurring?.interval === "year" ? ("year" as const) : ("month" as const);
  await db
    .update(workspaces)
    .set({
      plan: pro ? "pro" : "free",
      stripeCustomerId: idOf(sub.customer),
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
      billingInterval: interval,
      cancelAtPeriodEnd: sub.cancel_at_period_end || !!sub.cancel_at,
    })
    .where(eq(workspaces.id, workspaceId));
  // Pro is over (not just set to cancel at period end): its monthly credits go with it.
  if (!pro && ENDED_STATUSES.has(sub.status)) await lapseMonthlyCredits(db, workspaceId);
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
  // They roll over one month, then lapse (and lapse at once if Pro ends).
  const granted = await grantOnce(db, workspaceId, PRO_MONTHLY_CREDITS, "pro_monthly", `stripe:${invoice.id}`, monthlyCreditsExpiry(new Date()));
  return { workspaceId, credits: PRO_MONTHLY_CREDITS, granted };
}

/**
 * Annual Pro's monthly credits after the first month. Stripe invoices once a year and that invoice grants month 1
 * (grantMonthlyCredits); this grants each later month of the paid year on its date, once (keyed by subscription,
 * period and month). Runs on the worker tick and needs no Stripe call. A cancelled subscription keeps its months
 * until the period it paid for ends, when syncSubscription moves the workspace back to Free.
 */
export async function runAnnualCreditsTick(db: Db, now = new Date()) {
  const subs = await db
    .select({ id: workspaces.id, subscriptionId: workspaces.stripeSubscriptionId, start: workspaces.currentPeriodStart, end: workspaces.currentPeriodEnd })
    .from(workspaces)
    .where(and(eq(workspaces.plan, "pro"), eq(workspaces.billingInterval, "year"), isNotNull(workspaces.stripeSubscriptionId), isNotNull(workspaces.currentPeriodStart)));
  let granted = 0;
  for (const s of subs) {
    if (!s.start || !s.subscriptionId || (s.end && s.end <= now)) continue;
    for (let month = 1; month < 12; month++) {
      const due = addMonths(s.start, month);
      if (due > now) break;
      const ref = `stripe:${s.subscriptionId}:${s.start.toISOString().slice(0, 10)}:m${month + 1}`;
      // Same rule as monthly Pro: each month's credits roll over one month, then lapse.
      if (await grantOnce(db, s.id, PRO_MONTHLY_CREDITS, "pro_monthly", ref, monthlyCreditsExpiry(due))) granted++;
    }
  }
  return { granted };
}

/** `date` plus `n` calendar months, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb), in UTC. */
export function addMonths(date: Date, n: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** What a webhook did, for analytics. `null` when the event needed nothing. */
export type BillingOutcome =
  | { type: "subscription"; workspaceId: string; plan: Plan | null; status: string }
  | { type: "credits"; workspaceId: string; credits: number; reason: "purchase" | "pro_monthly"; granted: boolean }
  | null;

/** The events the webhook endpoint subscribes to (core-infrastructure apps/meerko/app/stripe.tf lists the same ones). */
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
