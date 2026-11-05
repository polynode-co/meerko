import { site } from "@/lib/site";

// The plans and pricing FAQ shown on /pricing. Figures match packages/core (credits.ts, billing.ts).
// Two plans plus credit packs as the add-on. Self-hosting and volume deals are one line each under the cards,
// not plans: there's nothing to buy for the first, and no enterprise features yet for the second.

export const plans = [
  {
    name: "Cloud Free",
    price: "$0",
    per: "to start",
    sub: "200 credits included",
    features: ["Hosted & maintained", "1 mailbox", "Managed enrichment", "All agent tools"],
    cta: "Start free",
    href: site.signupUrl,
  },
  {
    name: "Cloud Pro",
    price: "$49",
    per: "/ month",
    sub: "4,900 credits / month",
    features: ["Unlimited mailboxes", "Sending & reply scan, 24/7", "Your own provider keys, 0 credits", "Email support"],
    cta: "Get started",
    // Sign in (or up), then upgrade from Connections, where Checkout starts.
    href: `${site.signupUrl}?next=${encodeURIComponent("/app/settings#billing")}`,
    popular: true,
  },
];

export const pricingFaq = [
  ["Is self-hosting really free?", "Yes. Meerko is AGPL-3.0: run the whole stack on your own infra and bring your own provider keys. You pay us nothing; you pay your data providers directly."],
  ["What uses credits?", "Only data that costs us money: finding and verifying emails, and lead search. Sending, reply detection and drafts don't."],
  ["Do misses cost anything?", "No. If no email is found, or the lookup fails, you aren't charged."],
  ["Can I use my own Icypeas key on Cloud?", "On Pro, yes. Add it in Connections (or with `meerko keys set icypeas`) and lookups run on your key, with no credits charged. On Free, lookups use Meerko's keys and your credits. Self-hosted, your own keys are always free."],
  ["What happens when I run out?", "Lookups stop until you add credits. Top up in Connections on any plan, in packs of 1,000 credits for $10. Sequences, reply detection and drafts keep running."],
  ["Do credits expire?", "No. Free, bought and monthly Pro credits all stay in your balance, and you keep them if you cancel Pro."],
  ["How do I cancel Pro?", "In Connections → Manage billing. Pro runs to the end of the month you paid for, then you're back on Free with the credits you have left."],
  ["Can I move from Cloud to self-hosted?", "Any time. It's the same code: ask us for an export of your workspace and load it into your own Postgres."],
];
