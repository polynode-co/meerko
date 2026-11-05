import { Check } from "lucide-react";
import Image from "next/image";
import { Kicker, LimeButton, LkPage, PaperButton, crumb, sectionTitle } from "@/components/lookout/kit";
import { FaqGrid, LkBreadcrumbs, SourceList, SourceRef, wrap } from "@/components/lookout/marketing/ui";
import { LogoMark } from "@/components/ui/brand";
import { versusPages } from "@/lib/content";
import { CHECKED_ON } from "@/lib/sources";
import { site } from "@/lib/site";
import type { Source } from "./compare-page";

// /compare/<a>-vs-<b>: two other tools side by side, in the same Lookout style as /alternatives/<vendor>.
// Every cell about either tool cites that tool's own page. Meerko only appears as a third option at the end.

export interface VersusTool {
  name: string;
  /** The vendor's own site icon (public/logos). */
  logo: string;
  /** Its /alternatives page, if there is one. */
  alternative?: string;
  pricing: { plans: { name: string; price: string; detail: string }[]; note: string; source: Source };
  /** "Pick <tool> if…" reasons, each sourced. */
  pickIf: { text: string; source: Source }[];
}

export interface VersusRow {
  label: string;
  a: string;
  aSource: Source;
  b: string;
  bSource: Source;
}

export interface Versus {
  /** URL slug under /compare. */
  slug: string;
  a: VersusTool;
  b: VersusTool;
  intro: string;
  rows: VersusRow[];
  faq: [string, string][];
}

const box = "bg-lk-box outline outline-1 -outline-offset-1 outline-lk-line";

function ToolMark({ t, size = 28 }: { t: VersusTool; size?: number }) {
  return (
    <span className="grid size-11 place-items-center bg-lk-paper">
      <Image src={t.logo} alt={`${t.name} logo`} width={size} height={size} className="size-7" />
    </span>
  );
}

export function VersusPage({ v }: { v: Versus }) {
  const { a, b } = v;
  const title = `${a.name} vs ${b.name}`;
  // Number each distinct source once, in order of first use, before anything renders.
  const sources: Source[] = [];
  const cite = (s: Source) => {
    let i = sources.findIndex((x) => x.url === s.url);
    if (i < 0) i = sources.push(s) - 1;
    return i + 1;
  };
  for (const r of v.rows) {
    cite(r.aSource);
    cite(r.bSource);
  }
  for (const t of [a, b]) {
    for (const p of t.pickIf) cite(p.source);
    cite(t.pricing.source);
  }
  const Ref = ({ s }: { s: Source }) => <SourceRef n={cite(s)} />;

  return (
    <LkPage>
      <section className={`${wrap} flex flex-col gap-5 pt-10 pb-12 lg:pt-14`}>
        <LkBreadcrumbs items={[["Home", "/"], ["Alternatives", "/alternatives"], [title, `/compare/${v.slug}`]]} />
        <div className="flex items-center gap-3 pt-6 lg:pt-10">
          <ToolMark t={a} />
          <span className="font-plex text-[13px] text-lk-dim">VS</span>
          <ToolMark t={b} />
          <span className="pl-2 font-plex text-[13px] tracking-[0.8px] text-lk-lime uppercase">Head-to-head</span>
        </div>
        <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[52px] sm:tracking-[-1.9px]">
          {title}: features and pricing (2026)
        </h1>
        <p className="max-w-[820px] text-[17px] leading-[1.6] text-lk-muted sm:text-[18px]">{v.intro}</p>
      </section>

      <section className={`${wrap} flex flex-col gap-4 pb-20`}>
        <div className="overflow-x-auto outline outline-1 -outline-offset-1 outline-lk-line">
          <table className="w-full min-w-[640px] text-left text-[16px] leading-[1.5]">
            <thead className="bg-lk-box">
              <tr>
                <th className="w-[24%] px-5 py-4">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="border-l border-lk-line px-5 py-4 font-pixel text-[13px] font-normal text-lk-fg uppercase">{a.name}</th>
                <th className="border-l border-lk-line px-5 py-4 font-pixel text-[13px] font-normal text-lk-fg uppercase">{b.name}</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.label} className="border-t border-lk-line align-top">
                  <th scope="row" className="px-5 py-4 font-normal text-lk-muted">{r.label}</th>
                  <td className="border-l border-lk-line px-5 py-4 text-lk-fg">
                    {r.a}
                    <Ref s={r.aSource} />
                  </td>
                  <td className="border-l border-lk-line px-5 py-4 text-lk-fg">
                    {r.b}
                    <Ref s={r.bSource} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={crumb}>
          Facts from {a.name}&apos;s and {b.name}&apos;s own pages, checked {CHECKED_ON}. Prices are per month on monthly billing.
        </p>
      </section>

      <section className={`${wrap} grid gap-6 pb-20 md:grid-cols-2`}>
        {[a, b].map((t) => (
          <div key={t.name} className={`${box} flex flex-col gap-4 p-7`}>
            <h2 className="flex items-center gap-3 text-[22px] font-semibold tracking-[-0.4px] text-lk-fg">
              <span className="grid size-8 place-items-center bg-lk-paper">
                <Image src={t.logo} alt="" width={20} height={20} className="size-5" />
              </span>
              Pick {t.name} if
            </h2>
            <ul className="flex flex-col gap-2.5 text-[16px] leading-[1.6] text-lk-muted">
              {t.pickIf.map((p) => (
                <li key={p.text} className="flex gap-3">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-lk-lime" />
                  <span>
                    {p.text}
                    <Ref s={p.source} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {[a, b].map((t) => (
        <section key={t.name} className={`${wrap} flex flex-col gap-7 pb-20`}>
          <div className="flex flex-col gap-[18px]">
            <Kicker>{t.name} pricing</Kicker>
            <h2 className={`${sectionTitle} leading-[1.1]`}>
              How much does {t.name} cost?
              <Ref s={t.pricing.source} />
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            {t.pricing.plans.map((p) => (
              <div key={p.name} className="flex flex-col gap-3 p-6 outline outline-1 -outline-offset-1 outline-lk-line">
                <p className="font-pixel text-[14px] text-lk-fg uppercase">{p.name}</p>
                <p className="text-[36px] leading-none font-semibold tracking-[-1.2px] text-lk-fg">{p.price}</p>
                <p className="text-[15px] leading-[1.6] text-lk-muted">{p.detail}</p>
              </div>
            ))}
          </div>
          <p className="max-w-[900px] text-[15px] leading-[1.6] text-lk-dim">{t.pricing.note}</p>
        </section>
      ))}

      <section className="border-y border-lk-line bg-lk-box">
        <div className={`${wrap} flex flex-col gap-6 py-20 lg:py-24`}>
          <Kicker>A third option</Kicker>
          <h2 className={`${sectionTitle} max-w-[880px] leading-[1.1]`}>Or run outbound from your own assistant.</h2>
          <p className="max-w-[820px] text-[17px] leading-[1.6] text-lk-muted">
            Meerko is an open-source outbound engine you use from Claude, ChatGPT, Grok, Claude Code, Cursor or Codex. It finds leads, finds and
            verifies emails, sends sequences from your own Gmail, Outlook or IMAP mailboxes and drafts replies you approve. Free to start with 200
            credits, Pro at $49/mo, or self-host it for free.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <LimeButton href={site.pricingUrl}>See pricing →</LimeButton>
            <PaperButton href="/docs/claude">Add it to Claude →</PaperButton>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 font-plex text-[13px] tracking-[0.6px] uppercase">
            {[a, b]
              .filter((t) => t.alternative)
              .map((t) => (
                <li key={t.name}>
                  <a href={t.alternative} className="flex items-center gap-2 text-lk-muted hover:text-lk-fg">
                    <LogoMark size={14} /> Meerko vs {t.name} →
                  </a>
                </li>
              ))}
          </ul>
        </div>
      </section>

      <section className={`${wrap} flex flex-col gap-8 pt-24`}>
        <div className="flex flex-col gap-[18px]">
          <Kicker>FAQ</Kicker>
          <h2 className={`${sectionTitle} leading-[1.1]`}>Questions</h2>
        </div>
        <FaqGrid items={v.faq} />
      </section>

      {versusPages.length > 1 && (
        <section className={`${wrap} flex flex-col gap-4 pt-20`}>
          <h2 className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim uppercase">Other head-to-heads</h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {versusPages
              .filter((p) => p.slug !== v.slug)
              .map((p) => (
                <li key={p.slug}>
                  <a href={`/compare/${p.slug}`} className={`${box} flex h-full flex-col gap-0.5 px-[18px] py-4 transition hover:outline-lk-gray`}>
                    <span className="text-[16px] font-semibold text-lk-fg">{p.title}</span>
                    <span className="text-[15px] leading-snug text-lk-muted">{p.summary}</span>
                  </a>
                </li>
              ))}
            <li>
              <a href="/alternatives" className={`${box} flex h-full flex-col gap-0.5 px-[18px] py-4 transition hover:outline-lk-gray`}>
                <span className="text-[16px] font-semibold text-lk-fg">All comparisons</span>
                <span className="text-[15px] leading-snug text-lk-muted">Meerko next to Clay, Apollo, Instantly and more.</span>
              </a>
            </li>
          </ul>
        </section>
      )}

      <div className={`${wrap} py-14 pb-24`}>
        <SourceList sources={sources} />
      </div>
    </LkPage>
  );
}
