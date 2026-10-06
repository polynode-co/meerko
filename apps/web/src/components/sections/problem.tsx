import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import { Logo } from "../ui/brand";
import { alternatives } from "@/lib/content";
import { CHECKED_ON, stackPrices } from "@/lib/sources";
import { Container, Eyebrow, SectionTitle } from "../ui/primitives";

// Logos: Clay and Instantly from their own site icons; HubSpot and Zapier from Simple Icons (CC0).
// Prices and their sources: lib/sources.ts.
const total = stackPrices.reduce((sum, s) => sum + s.price, 0);
const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

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
            Your outbound stack costs {usd(Math.round(total))} a month, and you own none of it.
          </SectionTitle>
          <p className="text-lg leading-[1.55] text-dark-muted lg:text-[19px]">
            Four tools, four logins, four bills, glued together with Zapier. Meerko replaces the loop with one open-source engine
            you can run yourself.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row">
          <div className="flex w-full flex-1 flex-col gap-2.5">
            {stackPrices.map(({ tool, logo, job, plan, price, url }) => (
              <div key={tool} className="flex items-center gap-4 rounded-[10px] border border-dark/10 bg-white/60 px-5 py-4">
                <span className="flex w-[124px] shrink-0 items-center gap-3 sm:w-36">
                  <Image src={logo} alt="" width={24} height={24} className="size-6 shrink-0 rounded-md" />
                  {/* Tools with a comparison page link to it (lib/content.ts) */}
                  {alternatives.some((a) => a.name === tool) ? (
                    <a href={`/alternatives/${tool.toLowerCase()}`} className="text-[17px] font-semibold line-through hover:text-accent-deep">
                      {tool}
                    </a>
                  ) : (
                    <span className="text-[17px] font-semibold line-through">{tool}</span>
                  )}
                </span>
                <span className="flex flex-1 flex-col text-sm text-dark-muted sm:text-[15px]">
                  {job}
                  <span className="text-xs opacity-80">{plan}</span>
                </span>
                <a href={url} target="_blank" rel="noopener" className="font-mono text-[15px] text-dark-muted underline decoration-dark/25 underline-offset-4 hover:text-dark">
                  {usd(price)}/mo
                </a>
              </div>
            ))}
            <div className="flex justify-between px-5 py-2">
              <span className="text-[15px] text-dark-muted">Entry-level stack</span>
              <span className="font-mono text-[15px] font-bold">{usd(total)}/mo</span>
            </div>
            <p className="px-5 text-xs text-dark-muted">
              Entry-level paid plans, billed monthly, from each vendor&apos;s pricing page (linked) on {CHECKED_ON}.{" "}
              <a href="/alternatives" className="font-semibold text-dark underline underline-offset-2">
                Compare Meerko with Clay, Apollo and Instantly →
              </a>
            </p>
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
