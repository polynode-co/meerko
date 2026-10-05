import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import { Logo } from "../ui/brand";
import { Container, Eyebrow, SectionTitle } from "../ui/primitives";

// Logos: Clay, Apollo and Instantly from their own site icons; HubSpot and Zapier from Simple Icons (CC0).
const stack = [
  ["Clay", "/logos/clay.png", "Tables & enrichment", "$349/mo"],
  ["Apollo", "/logos/apollo.png", "Contact data", "$99/mo"],
  ["Instantly", "/logos/instantly.png", "Sending", "$97/mo"],
  ["HubSpot", "/logos/hubspot.svg", "CRM", "$90/mo"],
  ["Zapier", "/logos/zapier.svg", "Glue", "$69/mo"],
];

const included = [
  "Tables, enrichment & verification",
  "Sequences from your own Gmail",
  "Reply detection & AI drafts",
  "Pipeline to booked meeting",
  "CLI + MCP for your agent",
];

export function Problem() {
  return (
    <section className="bg-sand text-dark">
      <Container className="flex flex-col gap-14 py-24 lg:py-[120px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow tone="deep">The problem</Eyebrow>
          <SectionTitle className="text-dark">
            Your outbound stack costs $700 a month and still can’t talk to your agent.
          </SectionTitle>
          <p className="text-lg leading-[1.55] text-dark-muted lg:text-[19px]">
            Five tools, five logins, five bills — glued together with Zapier. None of it was built for Claude Code. Meerko
            replaces the whole loop with one open-source engine.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row">
          <div className="flex w-full flex-1 flex-col gap-2.5">
            {stack.map(([tool, logo, job, price]) => (
              <div key={tool} className="flex items-center gap-4 rounded-[10px] border border-dark/10 bg-white/60 px-5 py-4">
                <span className="flex w-[124px] shrink-0 items-center gap-3 sm:w-36">
                  <Image src={logo} alt="" width={24} height={24} className="size-6 shrink-0 rounded-md" />
                  <span className="text-[17px] font-semibold line-through">{tool}</span>
                </span>
                <span className="flex-1 text-sm text-dark-muted sm:text-[15px]">{job}</span>
                <span className="font-mono text-[15px] text-dark-muted">{price}</span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-2">
              <span className="text-[15px] text-dark-muted">Typical stack</span>
              <span className="font-mono text-[15px] font-bold">≈ $704/mo</span>
            </div>
          </div>

          <ArrowRight className="size-10 shrink-0 rotate-90 text-accent-deep lg:rotate-0" />

          <div className="flex w-full flex-1 flex-col gap-5 rounded-[18px] bg-ink p-9 text-fg shadow-[0_24px_48px_rgba(26,22,17,0.2)]">
            <Logo size={44} className="text-3xl" />
            <ul className="flex flex-col gap-5">
              {included.map((item) => (
                <li key={item} className="flex items-center gap-3 text-base">
                  <Check className="size-[18px] text-signal" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line pt-4">
              <span className="font-mono text-base font-bold text-accent">$0 self-hosted</span>
              <span className="font-mono text-sm text-muted">Cloud from $49/mo</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
