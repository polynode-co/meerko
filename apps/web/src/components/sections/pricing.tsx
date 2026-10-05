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
    features: ["Unlimited mailboxes", "Hosted agents run 24/7", "Reply drafting & triage", "Email support"],
    cta: "Start 14-day trial",
    href: site.signupUrl,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    sub: "Volume credits",
    features: ["SSO & roles", "Audit logs", "Agency workspaces", "Dedicated support"],
    cta: "Talk to us",
    href: "mailto:hello@example.com",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20">
      <Container className="flex flex-col items-center gap-14 py-24 lg:py-[120px]">
        <div className="flex max-w-[720px] flex-col items-center gap-4 text-center">
          <Eyebrow>Pricing</Eyebrow>
          <SectionTitle>Free to own. Fair to rent.</SectionTitle>
          <p className="text-lg text-muted">Credits only for what costs us money: data lookups and AI. $1 = 100 credits.</p>
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
