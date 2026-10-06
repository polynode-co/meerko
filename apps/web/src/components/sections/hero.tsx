import { MailCheck } from "lucide-react";
import { site } from "@/lib/site";
import { AnimatedMascot } from "../ui/animated-mascot";
import { CopyCommand } from "../ui/copy-command";
import { Container, PrimaryButton, TerminalWindow } from "../ui/primitives";

const session: [string, string, string][] = [
  [">", "Find 50 Series A fintech CTOs in Spain,", "user"],
  [" ", "enrich + verify, write a 3-step sequence.", "user"],
  ["●", "meerko.search_companies  → 212 matches", "tool"],
  ["●", "meerko.enrich email      → 47/50 found", "tool"],
  ["●", "meerko.verify            → 44 deliverable", "tool"],
  ["●", "meerko.sequence.start    → 3 steps, Gmail", "tool"],
];

export function Hero() {
  return (
    <section className="overflow-x-clip">
      <Container className="flex flex-col items-center gap-16 pt-16 pb-20 lg:flex-row lg:pt-24 lg:pb-28">
        <div className="flex w-full flex-1 flex-col gap-7">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 font-mono text-[13px] font-medium text-accent">
            <span className="size-2 rounded-full bg-accent" />
            Open source · AGPL · Self-host or cloud
          </span>
          <h1 className="font-display text-5xl leading-[0.98] font-bold tracking-[-0.035em] sm:text-7xl lg:text-[76px]">
            <span className="lg:whitespace-nowrap">The open&#8209;source</span>
            <br />
            GTM agent.
          </h1>
          <p className="max-w-[620px] text-lg leading-normal text-muted lg:text-xl">
            Meerko finds your leads, enriches them, sends from your own inbox and catches every reply — driven from your
            terminal or Claude Code.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton href={site.pricingUrl}>Get started free</PrimaryButton>
            <CopyCommand command={site.installCommand} />
          </div>
          <p className="text-sm text-muted">Free forever when self-hosted. 1,000 free credits on Meerko Cloud.</p>
        </div>

        <div className="relative w-full max-w-[600px] lg:h-[560px] lg:w-[600px] lg:shrink-0">
          <div className="pointer-events-none absolute top-10 left-[60px] hidden size-[520px] lg:block rounded-full bg-[radial-gradient(circle,#f2a93b33_0%,#f2a93b00_70%)]" />
          <AnimatedMascot className="meerko-idle absolute top-0 right-6 h-[170px] w-auto lg:top-[7px] lg:right-[130px] lg:h-[267px]" />
          <TerminalWindow title="claude — ~/outbound" className="relative mt-[120px] lg:absolute lg:top-[150px] lg:left-0 lg:mt-0 lg:w-[520px]">
            <div className="flex flex-col gap-2.5 px-4 py-5 font-mono text-[12px] leading-normal sm:px-[22px] sm:text-[13.5px]">
              {session.map(([mark, text, kind], i) => (
                <div key={i} className="flex gap-2 whitespace-pre-wrap">
                  <span className={kind === "user" ? "text-accent" : "text-signal"}>{mark}</span>
                  <span className={kind === "user" ? "text-fg" : "overflow-hidden text-ellipsis text-muted"}>{text}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-3 rounded-[10px] border border-signal/25 bg-signal/[0.08] p-3.5 font-sans">
                <MailCheck className="size-[18px] shrink-0 text-signal" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold">Lucía M. · CTO @ Ledgr replied</span>
                  <span className="text-[13px] text-muted">“Good timing — can we talk Thursday?”</span>
                </div>
                <span className="rounded-md bg-signal px-2 py-1 font-mono text-[11px] font-bold text-dark">Interested</span>
              </div>
            </div>
          </TerminalWindow>
        </div>
      </Container>
    </section>
  );
}
