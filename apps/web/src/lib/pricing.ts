import { site } from "@/lib/site";

// The plans and pricing FAQ shown on /pricing (Pen "Pricing A — Free vs Pro", wNMnq). Figures match packages/core
// (credits.ts, billing.ts: PRO_PRICES, FOUNDING_OFFER) and core-infrastructure apps/meerko/app/stripe.tf; the web app can't import core, so
// change them together. Two plans plus credit packs as the add-on. Self-hosting and volume deals are one row each under
// the cards, not plans: there's nothing to buy for the first, and no enterprise tier yet for the second.

export const proPrices = { month: 49, year: 490 } as const;
/** 50% off the first year of annual Pro, for the first 50 customers, until the end of 2026 (the Stripe coupon). */
export const foundingOffer = { percentOff: 50, places: 50, until: "Dec 31, 2026", endsAt: "2026-12-31T23:59:59Z" } as const;

export const freePlan = {
  name: "Free",
  price: "$0",
  per: "to start",
  sub: "200 credits included, once",
  features: ["Hosted and maintained", "1 mailbox", "Managed enrichment", "Every agent tool: MCP, CLI, API"],
  cta: "Start free",
  href: site.signupUrl,
};

export const proPlan = {
  name: "Pro",
  badge: "Most teams",
  sub: "4,900 credits every month",
  features: [
    "Everything in Free",
    "Unlimited mailboxes",
    "Sending and reply scan, 24/7",
    "Reply drafting and triage",
    "Your own provider keys, 0 credits",
    "Email support",
  ],
  cta: "Get Pro",
  // Sign in (or up), then upgrade from settings, where Checkout starts (monthly or yearly).
  href: `${site.signupUrl}?next=${encodeURIComponent("/app/settings#billing")}`,
};

export const pricingFaq = [
  ["Is self-hosting really free?", "Yes. Meerko is AGPL-3.0: run the whole stack on your own infra and bring your own provider keys. You pay us nothing; you pay your data providers directly."],
  ["What uses credits?", "Only data that costs us money: finding and verifying emails, and lead search. Sending, reply detection and drafts don't."],
  ["Do misses cost anything?", "No. If no email is found, or the lookup fails, you aren't charged."],
  ["Can I use my own Icypeas key on Cloud?", "On Pro, yes. Add it in Connections (or with `meerko keys set icypeas`) and lookups run on your key, with no credits charged. On Free, lookups use Meerko's keys and your credits. Self-hosted, your own keys are always free."],
  ["What happens when I run out?", "Lookups stop until you add credits. Top up in Settings on any plan, in packs of 1,000 credits for $10. Sequences, reply detection and drafts keep running."],
  ["Do credits expire?", "Free and bought credits never expire. Pro's monthly credits roll over one month: what you don't use in the month they arrive is still yours the month after, then it lapses. Spending always uses the credits that lapse soonest first."],
  ["Is there a yearly plan?", "Yes: Pro is $490 a year, about $41 a month, with the same 4,900 credits arriving each month. Until Dec 31, 2026 the first 50 customers on yearly Pro get 50% off their first year ($245); each Free workspace has 30 days to claim it from when it first sees the offer."],
  ["How do I cancel Pro?", "In Settings → Manage billing. Pro runs to the end of the month or year you paid for, then you're back on Free. Pro's monthly credits end with it; credits you bought stay."],
  ["Can I move from Cloud to self-hosted?", "Any time. It's the same code: ask us for an export of your workspace and load it into your own Postgres."],
];
