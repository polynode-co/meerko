import { site } from "@/lib/site";

// The plans and pricing FAQ shown on /pricing. Figures match packages/core (credits.ts, billing.ts).

export const plans = [
  {
    name: "Self-hosted",
    price: "$0",
    per: "forever",
    sub: "Your infra, your keys",
    features: ["Everything in the repo", "Bring your own provider keys", "CLI, MCP & API", "Community support"],
    cta: "Clone on GitHub",
    href: site.githubUrl,
  },
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
    features: ["Unlimited mailboxes", "Sending & reply scan, 24/7", "Reply drafting & triage", "Email support"],
    cta: "Get started",
    // Sign in (or up), then upgrade from Settings, where Checkout starts.
    href: `${site.signupUrl}?next=${encodeURIComponent("/app/settings#billing")}`,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    sub: "Volume credits",
    features: ["Volume credit pricing", "Custom sending limits", "Onboarding help", "Dedicated support"],
    cta: "Talk to us",
    href: `mailto:${site.contactEmail}`,
  },
];

export const pricingFaq = [
  ["Is self-hosting really free?", "Yes. Meerko is AGPL-3.0: run the whole stack on your own infra and bring your own provider keys. You pay us nothing; you pay your data providers directly."],
  ["What uses credits?", "Only data that costs us money: finding and verifying emails, and lead search. Sending, reply detection and drafts don't."],
  ["Do misses cost anything?", "No. If no email is found, or the lookup fails, you aren't charged."],
  ["Can I use my own Icypeas key on Cloud?", "Yes. Add it in Settings (or with `meerko keys set icypeas`) and lookups run on your key, with no credits charged."],
  ["What happens when I run out?", "Lookups stop until you add credits. Top up in Settings on any plan, in packs of 1,000 credits for $10. Sequences, reply detection and drafts keep running."],
  ["Do credits expire?", "No. Free, bought and monthly Pro credits all stay in your balance, and you keep them if you cancel Pro."],
  ["How do I cancel Pro?", "In Settings → Manage billing. Pro runs to the end of the month you paid for, then you're back on Free with the credits you have left."],
  ["Can I move from Cloud to self-hosted?", "Any time. It's the same code: ask us for an export of your workspace and load it into your own Postgres."],
];
