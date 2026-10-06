import { ArrowRight, Check, ExternalLink, FileUp, Sparkles, ThumbsUp } from "lucide-react";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container, Eyebrow, SectionTitle, TerminalWindow } from "@/components/ui/primitives";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { alternatives } from "@/lib/content";
import { CHECKED_ON } from "@/lib/sources";
import { site } from "@/lib/site";

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

const repo = site.githubUrl;
// Facts about Meerko, each with the page that shows it.
const onlyMeerko = [
  { title: "Open source (AGPL-3.0)", body: "Read, fork and audit every line.", href: `${repo}/blob/main/LICENSE` },
  { title: "Self-host for $0", body: "Run it on your own infra with your own provider keys.", href: `${repo}/blob/main/docs/DEPLOY.md` },
  { title: "Your Postgres", body: "Self-hosted, every lead, email and reply stays in your database.", href: `${repo}#quick-start-self-hosted` },
];

export function ComparePage({ c }: { c: Comparison }) {
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
  const Ref = ({ s }: { s: Source }) => (
    <sup>
      <a href={`#source-${cite(s)}`} className="ml-0.5 font-mono text-[11px] text-accent hover:underline">
        [{cite(s)}]
      </a>
    </sup>
  );

  return (
    <>
      <Nav />
      <main>
        <section>
          <Container className="pt-8">
            <Breadcrumbs items={[["Home", "/"], ["Alternatives", "/alternatives"], [`${c.name} alternative`, `/alternatives/${c.slug}`]]} />
          </Container>
          <Container className="flex flex-col items-center gap-6 pt-16 pb-16 text-center lg:pt-20 lg:pb-[72px]">
            <span className="rounded-full bg-accent-soft px-3.5 py-1.5 font-mono text-[13px] tracking-[0.1em] text-accent uppercase">
              Meerko vs {c.name}
            </span>
            <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-6xl lg:text-[72px]">
              The open-source
              <br />
              {c.name} alternative.
            </h1>
            <p className="max-w-[720px] text-lg leading-[1.55] text-muted lg:text-[19px]">{c.pitch}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <a href={site.pricingUrl} className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-[22px] py-[15px] font-semibold text-dark hover:brightness-110">
                Start free <ArrowRight className="size-[17px]" />
              </a>
              <a href="#switch" className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-raised px-[22px] py-[15px] font-semibold hover:border-muted">
                <FileUp className="size-[17px]" /> Import a {c.name} CSV
              </a>
            </div>
          </Container>
        </section>

        <section>
          <Container className="flex flex-col gap-3 pb-20 lg:px-[180px]">
            <div className="overflow-x-auto rounded-[18px] border border-line">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-raised font-mono text-[13px] tracking-[0.08em] uppercase">
                  <tr>
                    <th className="px-7 py-[18px] font-normal">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th className="w-[270px] px-7 py-[18px] font-bold text-accent">Meerko</th>
                    <th className="w-[270px] px-7 py-[18px] font-normal text-muted">{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={r.label} className="border-t border-line">
                      <th scope="row" className="px-7 py-[18px] text-[15px] font-medium">{r.label}</th>
                      <td className="px-7 py-[18px] text-[15px] text-fg">{r.meerko}</td>
                      <td className="px-7 py-[18px] text-[15px] text-muted">
                        {r.them}
                        <Ref s={r.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-2 text-xs text-muted">{c.name} facts from {c.name}&apos;s own pages, checked {CHECKED_ON}. Prices are billed monthly.</p>
          </Container>
        </section>

        <section>
          <Container className="grid gap-6 pb-24 md:grid-cols-2 lg:px-[180px] lg:pb-28">
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-raised px-[30px] py-7">
              <h2 className="flex items-center gap-2.5 font-display text-[22px] font-bold">
                <ThumbsUp className="size-[18px] text-muted" /> Where {c.name} is stronger
              </h2>
              <ul className="flex flex-col gap-2 leading-[1.55] text-muted">
                {c.theyWin.map((w) => (
                  <li key={w.text}>
                    {w.text}
                    <Ref s={w.source} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-raised px-[30px] py-7">
              <h2 className="flex items-center gap-2.5 font-display text-[22px] font-bold">
                <Sparkles className="size-[18px] text-accent" /> Only with Meerko
              </h2>
              <ul className="flex flex-col gap-2.5">
                {onlyMeerko.map((m) => (
                  <li key={m.title} className="flex gap-2.5">
                    <Check className="mt-1 size-4 shrink-0 text-signal" />
                    <span className="leading-[1.5] text-muted">
                      <a href={m.href} target="_blank" rel="noopener" className="font-semibold text-fg hover:text-accent">
                        {m.title}
                      </a>
                      . {m.body}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        {c.pricing && (
          <section>
            <Container className="flex flex-col gap-6 pb-24 lg:px-[180px] lg:pb-28">
              <h2 className="font-display text-[32px] font-bold tracking-[-0.02em]">
                How much does {c.name} cost?
                <Ref s={c.pricing.source} />
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {c.pricing.plans.map((p) => (
                  <div key={p.name} className="flex flex-col gap-2 rounded-xl border border-line px-5 py-5">
                    <p className="font-semibold">{p.name}</p>
                    <p className="font-display text-[32px] leading-none font-bold">{p.price}</p>
                    <p className="text-sm leading-normal text-muted">{p.detail}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted">{c.pricing.note}</p>
            </Container>
          </section>
        )}

        <section id="switch" className="scroll-mt-20 bg-sand text-dark">
          <Container className="flex flex-col items-center gap-14 py-24 lg:flex-row lg:gap-[72px] lg:py-28">
            <div className="flex w-full flex-1 flex-col gap-7">
              <Eyebrow tone="deep">Switch in an afternoon</Eyebrow>
              <SectionTitle className="text-dark">Bring your {c.name} tables with you.</SectionTitle>
              <ol className="flex flex-col gap-3.5">
                {[`Export your ${c.name} table as CSV.`, "Import it: unknown columns become Meerko columns.", "Ask your agent to enrich, write a sequence and start it."].map((t, i) => (
                  <li key={t} className="flex items-center gap-3.5 text-[17px]">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-dark font-mono text-[13px] font-bold text-sand">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            {/* The CLI's real commands and output format (packages/cli). */}
            <TerminalWindow title="zsh — import" className="w-full lg:w-[560px] lg:shrink-0">
              <pre className="overflow-x-auto px-6 py-[22px] font-mono text-[13.5px] leading-[1.65]">
                <div className="text-fg">$ meerko tables create &quot;Fintech CTOs&quot;</div>
                <div className="text-signal">Created table &quot;Fintech CTOs&quot; (8f2c…)</div>
                <div className="text-fg">$ meerko tables import 8f2c… {c.name.toLowerCase()}-export.csv</div>
                <div className="text-signal">Imported 1240 rows. New columns: linkedin, title, funding</div>
                <div className="text-accent">› enrich them and draft a 3-step sequence</div>
              </pre>
            </TerminalWindow>
          </Container>
        </section>

        {c.faq && (
          <section>
            <Container className="flex flex-col gap-2 py-24 lg:px-[180px]">
              <h2 className="mb-4 font-display text-[32px] font-bold tracking-[-0.02em]">Questions</h2>
              {c.faq.map(([q, a]) => (
                <div key={q} className="flex flex-col gap-2 border-t border-line py-5">
                  <h3 className="text-lg font-semibold">{q}</h3>
                  <p className="leading-[1.55] text-muted">{a}</p>
                </div>
              ))}
            </Container>
            <JsonLd data={faqJsonLd(c.faq)} />
          </section>
        )}

        <section className="border-t border-line">
          <Container className="flex flex-col gap-3 pt-12">
            <h2 className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Other comparisons</h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {alternatives
                .filter((a) => a.slug !== c.slug)
                .map((a) => (
                  <li key={a.slug}>
                    <a href={`/alternatives/${a.slug}`} className="flex h-full flex-col gap-1 rounded-xl border border-line px-4 py-3.5 hover:border-muted">
                      <span className="font-semibold">Meerko vs {a.name}</span>
                      <span className="text-sm text-muted">{a.summary}</span>
                    </a>
                  </li>
                ))}
              <li>
                <a href="/guides" className="flex h-full flex-col gap-1 rounded-xl border border-line px-4 py-3.5 hover:border-muted">
                  <span className="font-semibold">Outbound guides</span>
                  <span className="text-sm text-muted">Cold email, follow-ups, deliverability and Gmail limits.</span>
                </a>
              </li>
            </ul>
          </Container>
          <Container className="py-12">
            <h2 className="mb-3 font-mono text-xs tracking-[0.15em] text-muted uppercase">Sources</h2>
            <ol className="flex flex-col gap-1.5 text-sm">
              {sources.map((s, i) => (
                <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-24 text-muted">
                  [{i + 1}]{" "}
                  <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-fg hover:text-accent">
                    {s.label} <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
