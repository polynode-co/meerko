import { BookOpen, Check } from "lucide-react";
import Image from "next/image";
import { GhostButton, Kicker, LimeButton, LkPage, PaperButton, crumb, sectionTitle } from "@/components/lookout/kit";
import { FaqGrid, LkBreadcrumbs, SourceList, SourceRef, wrap } from "@/components/lookout/marketing/ui";
import { LogoMark } from "@/components/ui/brand";
import { alternativeBySlug, alternatives } from "@/lib/content";
import { CHECKED_ON } from "@/lib/sources";
import { site } from "@/lib/site";

// /alternatives/<vendor>, from the .pen design "LK · Alternative detail" (c1Z9tc).

export interface Source {
  label: string;
  url: string;
}

/** A row compares facts only where both sides are sourced. `source` backs the competitor's cell. */
export interface CompareRow {
  label: string;
  meerko: string;
  them: string;
  source: Source;
}

export interface Comparison {
  /** URL slug under /alternatives. */
  slug: string;
  name: string;
  pitch: string;
  rows: CompareRow[];
  /** Where the competitor is stronger, each point sourced. */
  theyWin: { text: string; source: Source }[];
  /** The competitor's own plan list, for "how much does X cost" searches. */
  pricing?: { plans: { name: string; price: string; detail: string }[]; note: string; source: Source };
  /** Questions people search, answered from the sources above. */
  faq?: [string, string][];
}

// Facts about Meerko, each with the page that shows it.
const onlyMeerko = [
  { title: "Open source (AGPL-3.0)", body: "The code that runs Meerko Cloud is the code you can run yourself.", href: "/docs/self-hosting" },
  { title: "Self-host for $0", body: "Run it on your own infra with your own provider keys.", href: "/docs/self-hosting" },
  { title: "Your Postgres", body: "Self-hosted, every lead, email and reply stays in your database.", href: "/docs/self-hosting#what-runs" },
];

const box = "bg-lk-box outline outline-1 -outline-offset-1 outline-lk-line";

export function ComparePage({ c }: { c: Comparison }) {
  const { logo } = alternativeBySlug(c.slug);
  // Number each distinct source once, in order of first use.
  const sources: Source[] = [];
  const cite = (s: Source) => {
    let i = sources.findIndex((x) => x.url === s.url);
    if (i < 0) i = sources.push(s) - 1;
    return i + 1;
  };
  // Register every source up front, so the list at the bottom is complete before anything renders.
  for (const r of c.rows) cite(r.source);
  for (const w of c.theyWin) cite(w.source);
  if (c.pricing) cite(c.pricing.source);
  const Ref = ({ s }: { s: Source }) => <SourceRef n={cite(s)} />;

  return (
    <LkPage>
      <section className={`${wrap} flex flex-col gap-5 pt-10 pb-12 lg:pt-14`}>
        <LkBreadcrumbs items={[["Home", "/"], ["Alternatives", "/alternatives"], [`${c.name} alternative`, `/alternatives/${c.slug}`]]} />
        <div className="flex items-center gap-3 pt-6 lg:pt-10">
          <span className="grid size-11 place-items-center bg-lk-paper">
            <LogoMark size={28} />
          </span>
          <span className="font-plex text-[13px] text-lk-dim">VS</span>
          <span className="grid size-11 place-items-center bg-lk-paper">
            <Image src={logo} alt={`${c.name} logo`} width={28} height={28} priority className="size-7" />
          </span>
          <span className="pl-2 font-plex text-[13px] tracking-[0.8px] text-lk-lime uppercase">Meerko vs {c.name}</span>
        </div>
        <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[52px] sm:tracking-[-1.9px]">
          The open-source {c.name} alternative.
        </h1>
        <p className="max-w-[820px] text-[17px] leading-[1.6] text-lk-muted sm:text-[18px]">{c.pitch}</p>
        <div className="flex flex-wrap gap-4 pt-2">
          <LimeButton href={site.pricingUrl}>Start free →</LimeButton>
          <GhostButton href="#switch">Import a {c.name} CSV</GhostButton>
        </div>
      </section>

      <section className={`${wrap} flex flex-col gap-4 pb-20`}>
        <div className="overflow-x-auto outline outline-1 -outline-offset-1 outline-lk-line">
          <table className="w-full min-w-[640px] text-left text-[16px] leading-[1.5]">
            <thead className="bg-lk-box">
              <tr>
                <th className="w-[28%] px-5 py-4">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="border-l border-lk-line px-5 py-4 font-pixel text-[13px] font-normal text-lk-lime">MEERKO</th>
                <th className="border-l border-lk-line px-5 py-4 font-pixel text-[13px] font-normal text-lk-fg uppercase">{c.name}</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.label} className="border-t border-lk-line align-top">
                  <th scope="row" className="px-5 py-4 font-normal text-lk-muted">{r.label}</th>
                  <td className="border-l border-lk-line bg-lk-lime/[0.05] px-5 py-4 text-lk-fg">{r.meerko}</td>
                  <td className="border-l border-lk-line px-5 py-4 text-lk-fg">
                    {r.them}
                    <Ref s={r.source} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={crumb}>
          {c.name} facts from {c.name}&apos;s own pages, checked {CHECKED_ON}. Prices are per month on monthly billing.
        </p>
      </section>

      <section className={`${wrap} grid gap-6 pb-20 md:grid-cols-2`}>
        <div className={`${box} flex flex-col gap-4 p-7`}>
          <h2 className="flex items-center gap-3 text-[22px] font-semibold tracking-[-0.4px] text-lk-fg">
            <span className="grid size-8 place-items-center bg-lk-paper">
              <Image src={logo} alt="" width={20} height={20} className="size-5" />
            </span>
            Where {c.name} is stronger
          </h2>
          <ul className="flex flex-col gap-2.5 text-[16px] leading-[1.6] text-lk-muted">
            {c.theyWin.map((w) => (
              <li key={w.text} className="flex gap-3">
                <span aria-hidden className="mt-[11px] size-1.5 shrink-0 bg-lk-dim" />
                <span>
                  {w.text}
                  <Ref s={w.source} />
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${box} flex flex-col gap-4 p-7`}>
          <h2 className="flex items-center gap-3 text-[22px] font-semibold tracking-[-0.4px] text-lk-fg">
            <span className="grid size-8 place-items-center bg-lk-paper">
              <LogoMark size={20} />
            </span>
            Only with Meerko
          </h2>
          <ul className="flex flex-col gap-2.5">
            {onlyMeerko.map((m) => (
              <li key={m.title} className="flex gap-3 text-[16px] leading-[1.6] text-lk-muted">
                <Check aria-hidden className="mt-1 size-4 shrink-0 text-lk-lime" />
                <span>
                  <a href={m.href} target="_blank" rel="noopener" className="font-semibold text-lk-fg underline-offset-4 hover:text-lk-lime hover:underline">
                    {m.title}
                  </a>
                  . {m.body}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {c.pricing && (
        <section className={`${wrap} flex flex-col gap-7 pb-24`}>
          <div className="flex flex-col gap-[18px]">
            <Kicker>{c.name} pricing</Kicker>
            <h2 className={`${sectionTitle} leading-[1.1]`}>
              How much does {c.name} cost?
              <Ref s={c.pricing.source} />
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            {c.pricing.plans.map((p) => (
              <div key={p.name} className="flex flex-col gap-3 p-6 outline outline-1 -outline-offset-1 outline-lk-line">
                <p className="font-pixel text-[14px] text-lk-fg uppercase">{p.name}</p>
                <p className="text-[36px] leading-none font-semibold tracking-[-1.2px] text-lk-fg">{p.price}</p>
                <p className="text-[15px] leading-[1.6] text-lk-muted">{p.detail}</p>
              </div>
            ))}
          </div>
          <p className="max-w-[900px] text-[15px] leading-[1.6] text-lk-dim">{c.pricing.note}</p>
        </section>
      )}

      <section id="switch" className="scroll-mt-20 border-y border-lk-line bg-lk-box">
        <div className={`${wrap} flex flex-col gap-12 py-20 lg:flex-row lg:items-center lg:gap-[72px] lg:py-24`}>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <Kicker>Switch in an afternoon</Kicker>
            <h2 className={`${sectionTitle} leading-[1.1]`}>Bring your {c.name} tables with you.</h2>
            <ol className="flex flex-col gap-3.5">
              {[`Export your ${c.name} table as CSV.`, "Import it: unknown columns become Meerko columns.", "Ask your agent to enrich, write a sequence and start it."].map((t, i) => (
                <li key={t} className="flex items-center gap-3.5 text-[17px] leading-[1.5] text-lk-fg">
                  <span className="grid size-8 shrink-0 place-items-center bg-lk-lime font-pixel text-[14px] text-lk-ink">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          {/* The CLI's real commands and output format (packages/cli). */}
          <div className="w-full min-w-0 bg-lk-ink outline outline-1 -outline-offset-1 outline-lk-gray lg:w-[560px] lg:shrink-0">
            <div className="flex justify-between border-b border-lk-gray px-3 py-[7px] text-[13px] text-lk-muted">
              <span className="font-pixel">ZSH — IMPORT</span>
              <span className="font-plex">[x]</span>
            </div>
            <pre className="overflow-x-auto px-5 py-5 font-plex text-[13.5px] leading-[1.7]">
              <div className="text-lk-fg">$ meerko tables create &quot;Fintech CTOs&quot;</div>
              <div className="text-lk-dim">Created table &quot;Fintech CTOs&quot; (8f2c…)</div>
              <div className="text-lk-fg">$ meerko tables import 8f2c… {c.name.toLowerCase()}-export.csv</div>
              <div className="text-lk-dim">Imported 1240 rows. New columns: linkedin, title, funding</div>
              <div className="text-lk-lime">› enrich them and draft a 3-step sequence</div>
            </pre>
          </div>
        </div>
      </section>

      {c.faq && (
        <section className={`${wrap} flex flex-col gap-8 pt-24`}>
          <div className="flex flex-col gap-[18px]">
            <Kicker>FAQ</Kicker>
            <h2 className={`${sectionTitle} leading-[1.1]`}>Questions</h2>
          </div>
          <FaqGrid items={c.faq} />
        </section>
      )}

      <section className={`${wrap} flex flex-col gap-4 pt-20`}>
        <h2 className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim uppercase">Other comparisons</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {alternatives
            .filter((a) => a.slug !== c.slug)
            .map((a) => (
              <li key={a.slug}>
                <a href={`/alternatives/${a.slug}`} className={`${box} flex h-full items-center gap-3.5 px-[18px] py-4 transition hover:outline-lk-gray`}>
                  <span className="grid size-10 shrink-0 place-items-center bg-lk-paper">
                    <Image src={a.logo} alt="" width={24} height={24} className="size-6" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[16px] font-semibold text-lk-fg">Meerko vs {a.name}</span>
                    <span className="text-[15px] leading-snug text-lk-muted">{a.summary}</span>
                  </span>
                </a>
              </li>
            ))}
          <li>
            <a href="/guides" className={`${box} flex h-full items-center gap-3.5 px-[18px] py-4 transition hover:outline-lk-gray`}>
              <span className="grid size-10 shrink-0 place-items-center bg-lk-paper">
                <BookOpen className="size-5 text-lk-ink" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[16px] font-semibold text-lk-fg">Outbound guides</span>
                <span className="text-[15px] leading-snug text-lk-muted">Cold email, follow-ups, deliverability and Gmail limits.</span>
              </span>
            </a>
          </li>
        </ul>
      </section>

      <div className={`${wrap} py-14`}>
        <SourceList sources={sources} />
      </div>

      <div className={`${wrap} pb-24`}>
        <div className="flex flex-col items-start justify-between gap-6 bg-lk-box p-8 outline outline-1 -outline-offset-1 outline-lk-gray sm:p-10 lg:flex-row lg:items-center">
          <div className="flex max-w-[720px] flex-col gap-2.5">
            <h2 className="text-[26px] font-semibold tracking-[-0.6px] text-lk-fg">Try the open-source alternative</h2>
            <p className="text-[15.5px] leading-[1.6] text-lk-muted">
              Self-host it for free with your own provider keys, or use Meerko Cloud, which starts free with 200 credits.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <LimeButton href={site.pricingUrl}>Start free →</LimeButton>
            <PaperButton href="/docs/self-hosting">Self-host it →</PaperButton>
          </div>
        </div>
      </div>
    </LkPage>
  );
}
