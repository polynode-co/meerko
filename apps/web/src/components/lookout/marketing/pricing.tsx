import { plans, pricingFaq } from "@/lib/pricing";
import { site } from "@/lib/site";
import { Kicker, LimeButton, lead, pageTitle, sectionTitle } from "../kit";
import { FaqGrid, wrap } from "./ui";

// /pricing from the .pen design "LK · Pricing" (I23s2f). Plans and FAQ come from components/sections/pricing.tsx.

function Plans() {
  return (
    <div className={`${wrap} flex flex-col gap-6`}>
      <ul className="grid sm:grid-cols-2">
        {plans.map((plan) => {
          const pro = "popular" in plan && plan.popular;
          return (
            <li
              key={plan.name}
              className={`relative flex flex-col gap-5 p-[30px] outline outline-1 -outline-offset-1 ${pro ? "z-[1] bg-lk-box outline-lk-lime" : "bg-lk-bg outline-lk-line"}`}
            >
              <div className="flex min-h-[22px] items-center justify-between gap-3">
                <h2
                  className={`font-pixel text-[14px] uppercase ${pro ? "text-lk-lime" : "text-lk-fg"}`}
                >
                  {plan.name}
                </h2>
                {pro && (
                  <span className="bg-lk-lime px-[7px] py-[3px] font-plex text-[12px] font-semibold tracking-[0.6px] text-lk-ink">
                    POPULAR
                  </span>
                )}
              </div>
              <p className="flex items-end gap-2">
                <span className="text-[52px] leading-none font-semibold tracking-[-2px] text-lk-fg">
                  {plan.price}
                </span>
                {plan.per && (
                  <span className="pb-1.5 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">
                    {plan.per}
                  </span>
                )}
              </p>
              <p className="text-[16px] text-lk-fg">{plan.sub}</p>
              <span className="h-px bg-lk-line" />
              <ul className="flex flex-1 flex-col gap-3 pb-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="font-plex text-[13.5px] leading-snug text-lk-muted"
                  >
                    + {f}
                  </li>
                ))}
              </ul>
              {pro ? (
                <LimeButton href={plan.href} className="text-center">
                  {plan.cta} →
                </LimeButton>
              ) : (
                <a
                  href={plan.href}
                  className="font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-fg uppercase outline outline-1 -outline-offset-1 outline-lk-gray px-4 py-[13px] text-center transition hover:outline-lk-muted"
                >
                  {plan.cta} →
                </a>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-3 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase">
        <a href="/docs/credits" className="hover:text-lk-fg">
          Need more? Credit packs: 1,000 credits for $10, on any plan, never
          expire →
        </a>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <a href="/docs/self-hosting" className="hover:text-lk-fg">
            Rather run it yourself? Self-host free · AGPL-3.0 →
          </a>
          <a href={`mailto:${site.contactEmail}`} className="hover:text-lk-fg">
            Sending at volume? Talk to us →
          </a>
        </div>
      </div>
    </div>
  );
}

// What a credit buys on Meerko Cloud (packages/core/src/credits.ts: charged per successful result, misses free).
const costs: [n: string, what: string, note: string][] = [
  ["8", "a found work email", "Misses are free"],
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
          <h2 className={`${sectionTitle} leading-[1.1]`}>
            What a credit buys
          </h2>
        </div>
        <p className="text-[16px] leading-[1.6] text-lk-muted">
          $1 = 100 credits. You only pay when we find something: misses are
          free.
        </p>
      </div>
      <div className="bg-lk-box px-6 py-2 outline outline-1 -outline-offset-1 outline-lk-line sm:px-9">
        {costs.map(([n, what, note], i) => (
          <div
            key={what}
            className={`flex items-center gap-5 py-[22px] sm:gap-6 ${i ? "border-t border-lk-line" : ""}`}
          >
            <span
              className={`w-[52px] shrink-0 text-[36px] leading-none font-semibold tracking-[-1.2px] sm:w-[110px] sm:text-[40px] ${n === "0" ? "text-lk-lime" : "text-lk-fg"}`}
            >
              {n}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <span className="text-[17px] leading-snug text-lk-fg">
                <span className="sr-only">
                  {n === "1" ? "credit" : "credits"}:{" "}
                </span>
                {what}
              </span>
              <span className="font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">
                {note}
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase sm:flex-row sm:justify-between">
        <span>Credits don&apos;t expire.</span>
        <a href="/docs/credits" className="hover:text-lk-fg">
          Your own provider keys on Pro? 0 credits →
        </a>
      </div>
    </section>
  );
}

export function PricingPage() {
  return (
    <>
      <section className={`${wrap} flex flex-col gap-5 pt-16 pb-14 lg:pt-24`}>
        <Kicker as="p">Pricing</Kicker>
        <h1 className={pageTitle}>Free to own. Fair to rent.</h1>
        <p className={`${lead} max-w-[760px]`}>
          Credits only for what costs us money: data lookups. $1 = 100 credits.
        </p>
      </section>
      <Plans />
      <Credits />
      <section className={`${wrap} flex flex-col gap-9 pt-24 pb-[120px]`}>
        <div className="flex flex-col gap-[18px]">
          <Kicker>Questions</Kicker>
          <h2 className="text-[32px] font-semibold tracking-[-1.2px] text-lk-fg sm:text-[40px]">
            Pricing, plainly.
          </h2>
        </div>
        <FaqGrid items={pricingFaq as [string, string][]} />
      </section>
    </>
  );
}
