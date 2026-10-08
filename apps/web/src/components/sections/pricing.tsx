import { Check } from "lucide-react";
import { site } from "@/lib/site";
import { Container, Eyebrow, SectionTitle } from "../ui/primitives";

const plans = [
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
    sub: "1,000 credits included",
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
    href: site.signupUrl,
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

/** The plans, as the main content of /pricing. */
export function Pricing() {
  return (
    <section>
      <Container className="flex flex-col items-center gap-14 pt-24 pb-16 lg:pt-[96px] lg:pb-[72px]">
        <div className="flex max-w-[720px] flex-col items-center gap-4 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <SectionTitle as="h1">Free to own. Fair to rent.</SectionTitle>
          <p className="text-lg text-muted">Credits only for what costs us money: data lookups. $1 = 100 credits.</p>
        </div>
        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col gap-5 rounded-[18px] p-7 ${
                plan.popular ? "border-[1.5px] border-accent bg-accent/[0.06]" : "border border-line bg-raised"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{plan.name}</h3>
                {plan.popular && <span className="rounded-md bg-accent px-2 py-1 text-[11px] font-bold text-dark">Popular</span>}
              </div>
              <p className="flex items-end gap-1.5">
                <span className="font-display text-[44px] leading-none font-bold tracking-tight">{plan.price}</span>
                {plan.per && <span className="pb-1 text-sm text-muted">{plan.per}</span>}
              </p>
              <p className={`font-mono text-sm ${plan.popular ? "text-accent" : "text-muted"}`}>{plan.sub}</p>
              <ul className="flex flex-1 flex-col gap-2.5 border-t border-line pt-4 pb-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className={`size-4 ${plan.popular ? "text-accent" : "text-signal"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={`rounded-[10px] px-4 py-3 text-center text-sm font-semibold transition ${
                  plan.popular ? "bg-accent text-dark hover:brightness-110" : "border border-line bg-white/5 hover:border-muted"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// What a credit buys on Meerko Cloud (core/credits.ts). Misses are never charged.
const costs = [
  { n: "8", unit: "credits", what: "A found work email" },
  { n: "1", unit: "credit", what: "An email verification" },
  { n: "1", unit: "credit", what: "A lead from search" },
  { n: "0", unit: "credits", what: "Sending, replies, AI drafts" },
];

export function CreditCosts() {
  return (
    <section>
      <Container className="pb-24 lg:pb-28">
        <div className="flex flex-col gap-7 rounded-[18px] border border-line bg-raised px-6 py-8 sm:px-10 sm:py-9">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[28px] font-bold">What a credit buys</h2>
              <p className="text-muted">$1 = 100 credits. You only pay when we find something: misses are free.</p>
            </div>
            <p className="font-mono text-[13px] text-signal">Your own provider keys? 0 credits.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {costs.map((c) => (
              <div key={c.what} className="flex flex-col gap-2.5 rounded-xl border border-line px-[22px] py-5">
                <p className="flex items-end gap-2">
                  <span className={`font-display text-[40px] leading-none font-bold ${c.n === "0" ? "text-signal" : "text-accent"}`}>{c.n}</span>
                  <span className="font-mono text-[13px] text-muted">{c.unit}</span>
                </p>
                <p className="text-[15px]">{c.what}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export const pricingFaq = [
  ["Is self-hosting really free?", "Yes. Meerko is AGPL-3.0: run the whole stack on your own infra and bring your own provider keys. You pay us nothing; you pay your data providers directly."],
  ["What uses credits?", "Only data that costs us money: finding and verifying emails, and lead search. Sending, reply detection and drafts don't."],
  ["Do misses cost anything?", "No. If no email is found, or the lookup fails, you aren't charged."],
  ["Can I use my own Icypeas key on Cloud?", "Yes. Add it with `meerko keys set icypeas` and lookups run on your key, with no credits charged."],
  ["What happens when I run out?", "Lookups stop until you add credits. Sequences, reply detection and drafts keep running."],
  ["Can I move from Cloud to self-hosted?", "Any time. It's the same code: ask us for an export of your workspace and load it into your own Postgres."],
];

export function PricingFaq() {
  return (
    <section className="bg-sand text-dark">
      <Container className="flex flex-col gap-12 py-24 lg:py-28">
        <div className="flex flex-col gap-3">
          <Eyebrow tone="deep">Questions</Eyebrow>
          <SectionTitle className="text-dark">Pricing, plainly.</SectionTitle>
        </div>
        <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {pricingFaq.map(([q, a]) => (
            <div key={q} className="flex flex-col gap-2.5 border-t border-dark/12 pt-6">
              <dt className="text-lg font-semibold">{q}</dt>
              <dd className="leading-[1.55] text-dark-muted">
                {/* `backticks` mark a command */}
                {a.split("`").map((part, i) => (i % 2 ? <code key={i} className="font-mono text-[0.92em] text-dark">{part}</code> : part))}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
