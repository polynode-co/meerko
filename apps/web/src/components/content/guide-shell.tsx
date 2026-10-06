import { ArrowRight, Calendar, ExternalLink, Link2, Scale } from "lucide-react";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { LogoMark } from "@/components/ui/brand";
import { Container } from "@/components/ui/primitives";
import { guideBySlug, relatedGuides, topicMeta } from "@/lib/content";
import { site } from "@/lib/site";
import { CHECKED_ON } from "@/lib/sources";
import { Breadcrumbs } from "./breadcrumbs";
import { CopySample, Toc } from "./client";

export interface Source {
  label: string;
  url: string;
}

/** A citation component numbered by the page's source list: `const Cite = citer(sources)`, then <Cite s={…} />. */
export function citer(sources: Source[]) {
  return function Cite({ s }: { s: Source }) {
    const n = sources.findIndex((x) => x.url === s.url) + 1;
    if (n === 0) throw new Error(`Cited a source missing from the page's list: ${s.url}`);
    return (
      <sup>
        <a href={`#source-${n}`} className="ml-0.5 font-mono text-[11px] text-accent hover:underline">
          [{n}]
        </a>
      </sup>
    );
  };
}

/** A section heading that the "On this page" list links to. */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-6 font-display text-[30px] leading-tight font-bold tracking-[-0.02em] text-fg">
      {children}
    </h2>
  );
}

/** An email or code sample with a Copy button (pass the text as a string child). */
export function Sample({ title, children }: { title?: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <p className="font-mono text-xs text-muted">{title}</p>
        <CopySample text={children} />
      </div>
      <div className="px-[18px] py-4 font-mono text-[14px] leading-relaxed whitespace-pre-line text-fg">{children}</div>
    </div>
  );
}

/** A boxed note for rules and legal requirements. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-line px-5 py-[18px] text-[15px] leading-[1.55] text-fg">
      <Scale className="mt-0.5 size-[18px] shrink-0 text-accent" />
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/** A row of steps (e.g. a follow-up cadence); `highlight` marks one. */
export function Timeline({ steps, highlight }: { steps: [label: string, text: string][]; highlight?: number }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {steps.map(([label, text], i) => (
        <li key={label} className={`flex flex-col gap-1.5 rounded-xl border px-4 py-3.5 ${i === highlight ? "border-accent/35 bg-accent-soft" : "border-line bg-raised"}`}>
          <span className={`font-mono text-xs ${i === highlight ? "text-accent" : "text-muted"}`}>{label}</span>
          <span className="text-[15px] font-semibold text-fg">{text}</span>
        </li>
      ))}
    </ol>
  );
}

const ctas = {
  start: {
    title: "Run this from your coding agent",
    body: "Meerko finds the leads, sends the sequence from your own Gmail and stops it when someone replies. Self-host it for free or start on Meerko Cloud with 1,000 free credits.",
    primary: ["Get started free", site.pricingUrl],
    secondary: ["Connect it to Claude Code", "/docs/claude-code"],
  },
  docs: {
    title: "Try it in Claude Code",
    body: "Add the Meerko MCP server and ask for a lead list, a sequence or a reply triage in plain language.",
    primary: ["Set up the MCP server", "/docs/claude-code"],
    secondary: ["See pricing", site.pricingUrl],
  },
} as const;

export interface GuideShellProps {
  slug: string;
  eyebrow: string;
  h1: string;
  /** The short answer at the top, written to be quotable. */
  lead: React.ReactNode;
  toc: [id: string, label: string][];
  sources: Source[];
  faq?: [string, string][];
  cta?: keyof typeof ctas;
  children: React.ReactNode;
  description: string;
}

export function GuideShell({ slug, eyebrow, h1, lead, toc, sources, faq, cta = "start", children, description }: GuideShellProps) {
  const guide = guideBySlug(slug);
  const TopicIcon = topicMeta[guide.topic].icon;
  const related = relatedGuides(slug);
  const c = ctas[cta];
  const tocItems: [string, string][] = [...toc, ...(faq ? [["faq", "FAQ"] as [string, string]] : [])];
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: h1,
    description,
    dateModified: "2026-10-06",
    publisher: { "@type": "Organization", name: "Meerko", url: site.url },
  };
  return (
    <>
      <Nav />
      <main>
        <Container className="flex gap-[72px] pt-7 pb-20">
          <article className="flex min-w-0 max-w-[760px] flex-1 flex-col gap-[22px] text-[17px] leading-[1.65] text-muted">
            <Breadcrumbs items={[["Home", "/"], ["Guides", "/guides"], [guide.title, `/guides/${slug}`]]} />
            <p className="flex items-center gap-2.5 pt-5 font-mono text-[13px] tracking-[0.12em] text-accent uppercase">
              <span className="grid size-7 place-items-center rounded-lg bg-accent-soft">
                <TopicIcon className="size-[15px]" />
              </span>
              {eyebrow}
            </p>
            <h1 className="font-display text-5xl leading-[1.04] font-bold tracking-[-0.03em] text-fg lg:text-[56px]">{h1}</h1>
            <div className="flex flex-col gap-2 rounded-xl border-l-[3px] border-accent bg-raised px-[22px] py-[18px]">
              <p className="font-mono text-[11px] tracking-[0.15em] text-accent uppercase">The short answer</p>
              <div className="text-lg leading-[1.55] text-fg">{lead}</div>
            </div>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Updated {CHECKED_ON}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="size-3.5" /> Facts link to their sources
              </span>
            </p>

            {children}

            <div className="my-4 flex flex-col gap-3.5 rounded-[18px] border border-accent/25 bg-accent-soft p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink">
                  <LogoMark size={30} />
                </span>
                <p className="font-display text-2xl font-bold text-fg">{c.title}</p>
              </div>
              <p>{c.body}</p>
              <div className="flex flex-wrap gap-3">
                <a href={c.primary[1]} className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-3 font-semibold text-dark hover:brightness-110">
                  {c.primary[0]} <ArrowRight className="size-4" />
                </a>
                <a href={c.secondary[1]} className="inline-flex items-center rounded-[10px] border border-line px-5 py-3 font-semibold text-fg hover:border-muted">
                  {c.secondary[0]}
                </a>
              </div>
            </div>

            {faq && (
              <>
                <H2 id="faq">FAQ</H2>
                {faq.map(([q, a]) => (
                  <div key={q} className="flex flex-col gap-1.5 border-t border-line pt-4">
                    <h3 className="text-lg font-semibold text-fg">{q}</h3>
                    <p>{a}</p>
                  </div>
                ))}
              </>
            )}

            <section className="mt-4 flex flex-col gap-3.5 border-t border-line pt-6">
              <h2 className="font-mono text-xs tracking-[0.15em] uppercase">Related guides</h2>
              <ul className="grid gap-3.5 sm:grid-cols-2">
                {related.map((g) => {
                  const Icon = topicMeta[g.topic].icon;
                  return (
                    <li key={g.slug}>
                      <a href={`/guides/${g.slug}`} className="flex h-full items-center gap-3 rounded-xl border border-line px-4 py-3.5 hover:border-muted">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
                          <Icon className="size-4 text-accent" />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[15px] leading-snug font-semibold text-fg">{g.title}</span>
                          <span className="text-[13px] leading-snug">{g.summary}</span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>

            {sources.length > 0 && (
              <section className="flex flex-col gap-2 pt-3">
                <h2 className="font-mono text-xs tracking-[0.15em] uppercase">Sources</h2>
                <ol className="flex flex-col gap-1.5 text-sm">
                  {sources.map((s, i) => (
                    <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-24">
                      [{i + 1}]{" "}
                      <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-fg hover:text-accent">
                        {s.label} <ExternalLink className="size-3" />
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>

          <aside className="hidden w-[240px] shrink-0 lg:block">
            <div className="sticky top-28 flex flex-col gap-7 pt-24">
              <Toc items={tocItems} />
              <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-raised p-[18px]">
                <span className="flex items-center gap-2.5 font-display text-lg font-bold">
                  <LogoMark size={26} /> Meerko
                </span>
                <p className="text-[13px] leading-normal text-muted">The open-source AI sales agent, run from Claude Code. Sends from your own Gmail.</p>
                <a href={site.pricingUrl} className="rounded-[9px] bg-accent px-3.5 py-2.5 text-center text-sm font-semibold text-dark hover:brightness-110">
                  Get started free
                </a>
              </div>
            </div>
          </aside>
        </Container>
      </main>
      <Footer />
      <JsonLd data={article} />
      {faq && <JsonLd data={faqJsonLd(faq)} />}
    </>
  );
}
