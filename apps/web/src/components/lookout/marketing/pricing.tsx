import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import { alternatives } from "@/lib/content";
import { freePlan, pricingFaq, proPlan, proPrices } from "@/lib/pricing";
import { site } from "@/lib/site";
import { CHECKED_ON, stackPrices } from "@/lib/sources";
import { Kicker, LimeButton, Window, lead, pageTitle, sectionTitle } from "../kit";
import { ProPrice } from "./pro-price";
import { FaqGrid, wrap } from "./ui";

// /pricing from the .pen design "Pricing A — Free vs Pro" (wNMnq). Plans and FAQ come from lib/pricing.ts.

const card = "relative flex flex-col gap-5 p-[30px] outline outline-1 -outline-offset-1";
const planName = "font-pixel text-[14px] uppercase";

function Features({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-1 flex-col gap-3 pb-2">
      {items.map((f) => (
        <li key={f} className="flex items-start gap-2.5 font-plex text-[13.5px] leading-snug text-lk-muted">
          <Check aria-hidden className="mt-[2px] size-[14px] shrink-0 text-lk-lime" />
          {f}
        </li>
      ))}
    </ul>
  );
}

function Plans() {
  return (
    <div className="mx-auto flex w-full max-w-[1048px] flex-col gap-6 px-6">
      <ul className="grid gap-5 sm:grid-cols-2">
        <li className={`${card} bg-lk-bg outline-lk-line`}>
          <h2 className={`${planName} flex min-h-[22px] items-center text-lk-fg`}>{freePlan.name}</h2>
          <div className="flex flex-col gap-3">
            {/* As tall as Pro's billing switch, so the two prices line up. */}
            <span aria-hidden className="h-[29px]" />
            <p className="flex items-end gap-2">
              <span className="text-[52px] leading-none font-semibold tracking-[-2px] text-lk-fg">{freePlan.price}</span>
              <span className="pb-1.5 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">{freePlan.per}</span>
            </p>
          </div>
          <p className="text-[16px] text-lk-fg">{freePlan.sub}</p>
          <span className="h-px bg-lk-line" />
          <Features items={freePlan.features} />
          <a
            href={freePlan.href}
            className="px-4 py-[13px] text-center font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-fg uppercase outline outline-1 -outline-offset-1 outline-lk-gray transition hover:outline-lk-muted"
          >
            {freePlan.cta} →
          </a>
        </li>
        <li className={`${card} z-[1] bg-lk-box outline-lk-lime`}>
          <div className="flex min-h-[22px] items-center justify-between gap-3">
            <h2 className={`${planName} text-lk-lime`}>{proPlan.name}</h2>
            <span className="bg-lk-lime px-[7px] py-[3px] font-plex text-[12px] font-semibold tracking-[0.6px] text-lk-ink uppercase">
              {proPlan.badge}
            </span>
          </div>
          <ProPrice />
          <p className="text-[16px] text-lk-fg">{proPlan.sub}</p>
          <span className="h-px bg-lk-line" />
          <Features items={proPlan.features} />
          <LimeButton href={proPlan.href} className="text-center">
            {proPlan.cta} →
          </LimeButton>
        </li>
      </ul>
      <div className="flex flex-col gap-4 bg-lk-box p-6 outline outline-1 -outline-offset-1 outline-lk-line sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h2 className={`${planName} text-lk-fg`}>Sending at volume?</h2>
          <p className="text-[15px] leading-snug text-lk-muted">Volume credit pricing and help getting set up. Tell us what you send.</p>
        </div>
        <a
          href={`mailto:${site.contactEmail}`}
          className="shrink-0 font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-fg uppercase hover:text-lk-lime"
        >
          Talk to us →
        </a>
      </div>
      <div className="flex flex-col gap-3 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase sm:flex-row sm:justify-between">
        <a href="/docs/self-hosting" className="hover:text-lk-fg">
          Or self-host it for free: open source, AGPL-3.0 →
        </a>
        <a href="/docs/credits" className="hover:text-lk-fg">
          Credit packs: 1,000 for $10, any plan, never expire →
        </a>
      </div>
    </div>
  );
}

// What a credit buys on Meerko Cloud (packages/core/src/credits.ts: charged per successful result, misses free).
const costs: [n: string, what: string, note: string][] = [
  ["5", "a found work email", "Misses are free"],
  ["1", "a lead from search", "Per result returned"],
  ["1", "an email verification", "Per result"],
  ["0", "sending, reply detection and drafts", "Always free"],
];

function Credits() {
  return (
    <section className={`${wrap} flex flex-col gap-7 pt-[72px] pb-6`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-[18px]">
          <Kicker>What credits pay for</Kicker>
          <h2 className={`${sectionTitle} leading-[1.1]`}>What a credit buys</h2>
        </div>
        <p className="text-[16px] leading-[1.6] text-lk-muted">$1 = 100 credits. You only pay when we find something: misses are free.</p>
      </div>
      <div className="bg-lk-box px-6 py-2 outline outline-1 -outline-offset-1 outline-lk-line sm:px-9">
        {costs.map(([n, what, note], i) => (
          <div key={what} className={`flex items-center gap-5 py-[22px] sm:gap-6 ${i ? "border-t border-lk-line" : ""}`}>
            <span
              className={`w-[52px] shrink-0 text-[36px] leading-none font-semibold tracking-[-1.2px] sm:w-[110px] sm:text-[40px] ${n === "0" ? "text-lk-lime" : "text-lk-fg"}`}
            >
              {n}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className="text-[17px] leading-snug text-lk-fg">
                <span className="sr-only">{n === "1" ? "credit" : "credits"}: </span>
                {what}
              </span>
              <span className="font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">{note}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase sm:flex-row sm:justify-between">
        <span>Bought credits never expire.</span>
        <a href="/docs/credits" className="hover:text-lk-fg">
          Your own provider keys on Pro? 0 credits →
        </a>
      </div>
    </section>
  );
}

// What the same loop costs when it's bought as four tools (lib/sources.ts: each vendor's own pricing page).
const stackTotal = stackPrices.reduce((sum, s) => sum + s.price, 0);
const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const included = [
  "Tables, enrichment & verification",
  "Sequences from your own Gmail or Outlook",
  "Reply detection & AI drafts",
  "Pipeline to booked meeting",
  "CLI + MCP for your agent",
];

function StackCost() {
  return (
    <section className={`${wrap} flex flex-col gap-10 pt-24`}>
      <div className="flex max-w-[820px] flex-col gap-[18px]">
        <Kicker>The stack it replaces</Kicker>
        <h2 className={`${sectionTitle} leading-[1.1]`}>The usual outbound stack costs {usd(Math.round(stackTotal))} a month, and you own none of it.</h2>
        <p className="text-[17px] leading-[1.6] text-lk-muted">
          Four tools, four logins, four bills, glued together with Zapier. Meerko replaces the loop with one open-source engine you can run
          yourself.
        </p>
      </div>
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-10">
        <div className="flex w-full flex-1 flex-col">
          <div className="flex flex-col outline outline-1 -outline-offset-1 outline-lk-line">
            {stackPrices.map(({ tool, logo, job, plan, price, url }, i) => (
              <div key={tool} className={`flex items-center gap-3 bg-lk-box px-4 py-4 sm:gap-4 sm:px-5 ${i ? "border-t border-lk-line" : ""}`}>
                <span className="flex shrink-0 items-center gap-3 sm:w-40">
                  <span className="grid size-[26px] shrink-0 place-items-center bg-lk-paper">
                    <Image src={logo} alt="" width={16} height={16} className="object-contain" />
                  </span>
                  {/* Tools with a comparison page link to it (lib/content.ts) */}
                  {alternatives.some((a) => a.name === tool) ? (
                    <a href={`/alternatives/${tool.toLowerCase()}`} className="text-[17px] font-semibold text-lk-fg line-through decoration-lk-dim hover:text-lk-lime">
                      {tool}
                    </a>
                  ) : (
                    <span className="text-[17px] font-semibold text-lk-fg line-through decoration-lk-dim">{tool}</span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-[15px] text-lk-muted">
                  {job}
                  <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim">{plan}</span>
                </span>
                <a href={url} target="_blank" rel="noopener" className="shrink-0 font-plex text-[15px] whitespace-nowrap text-lk-muted underline decoration-lk-gray underline-offset-4 hover:text-lk-fg">
                  {/* "/mo" drops on phones so the row fits; the caption below says monthly */}
                  {usd(price)}
                  <span className="hidden sm:inline">/mo</span>
                </a>
              </div>
            ))}
          </div>
          <div className="flex justify-between px-5 py-3">
            <span className="text-[15px] text-lk-muted">Entry-level stack</span>
            <span className="font-plex text-[15px] font-semibold text-lk-fg">{usd(stackTotal)}/mo</span>
          </div>
          <p className="px-5 text-[13px] leading-[1.55] text-lk-dim">
            Entry-level paid plans, billed monthly, from each vendor&apos;s pricing page (linked) on {CHECKED_ON}.{" "}
            <a href="/alternatives" className="text-lk-fg underline underline-offset-2 hover:text-lk-lime">
              Compare Meerko with Clay, Apollo and Instantly →
            </a>
          </p>
        </div>
        <ArrowRight aria-hidden className="size-9 shrink-0 rotate-90 text-lk-lime lg:rotate-0" />
        <Window title="MEERKO — one engine" className="w-full flex-1" bodyClassName="flex flex-col gap-5 p-7">
          <ul className="flex flex-col gap-4">
            {included.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[16px]">
                <span className="grid size-5 shrink-0 place-items-center bg-lk-ink text-lk-lime">
                  <Check aria-hidden className="size-3.5" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t-[1.5px] border-lk-ink pt-4 font-plex">
            <span className="bg-lk-ink px-2 py-1 text-[14px] font-semibold text-lk-lime">${proPrices.month}/mo, all in one</span>
            <a href="/docs/self-hosting" className="text-[13.5px] text-lk-gray hover:text-lk-ink">
              or $0 self-hosted
            </a>
          </div>
        </Window>
      </div>
    </section>
  );
}

// The product questions that used to close the landing page; they sit with the pricing ones in one FAQ.
const productFaq: [string, string][] = [
  [
    "Why not just give my agent a Gmail and an Icypeas connector?",
    "Your agent forgets between sessions and can't send on a schedule. Meerko keeps the leads, sequences, replies and pipeline in one place, sends within each mailbox's daily limit while your agent is closed, skips unsubscribes and duplicates, and wakes your agent when someone replies.",
  ],
  [
    "Is Meerko an open-source Clay alternative?",
    "For outbound, yes: tables, enrichment and AI columns, plus sending from your own Gmail or Outlook and a reply inbox. The difference is that Meerko is open source, so you can self-host it and keep every row in your own Postgres.",
  ],
  [
    "How do you protect deliverability?",
    "You send from your own mailboxes with daily caps, send windows, jitter and threading. Unsubscribes are honored across every sequence in your workspace.",
  ],
  [
    "Can my AI agent really run campaigns?",
    "Every action is an MCP tool. Replies are drafted for your approval, and the Meerko commands never start a sequence without your OK.",
  ],
];

export function PricingPage() {
  return (
    <>
      <section className={`${wrap} flex flex-col items-center gap-5 pt-16 pb-14 text-center lg:pt-24`}>
        <Kicker as="p">Pricing</Kicker>
        <h1 className={pageTitle}>Start free. Pay for data, not seats.</h1>
        <p className={`${lead} max-w-[760px]`}>Sending, reply detection and drafts never cost credits. Lookups do, and misses are free.</p>
      </section>
      <Plans />
      <Credits />
      <StackCost />
      <section className={`${wrap} flex flex-col gap-9 pt-24 pb-[120px]`}>
        <div className="flex flex-col gap-[18px]">
          <Kicker>Questions</Kicker>
          <h2 className="text-[32px] font-semibold tracking-[-1.2px] text-lk-fg sm:text-[40px]">Pricing, plainly.</h2>
        </div>
        <FaqGrid items={[...(pricingFaq as [string, string][]), ...productFaq]} />
      </section>
    </>
  );
}
