import { ArrowRight, ExternalLink } from "lucide-react";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container } from "@/components/ui/primitives";
import { guideBySlug, relatedGuides } from "@/lib/content";
import { site } from "@/lib/site";
import { CHECKED_ON } from "@/lib/sources";
import { Breadcrumbs } from "./breadcrumbs";

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

/** A copyable-looking email or code sample. */
export function Sample({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-raised">
      {title && <p className="border-b border-line px-4 py-2 font-mono text-xs text-muted">{title}</p>}
      <div className="px-5 py-4 font-mono text-[14px] leading-relaxed whitespace-pre-line text-fg">{children}</div>
    </div>
  );
}

const ctas = {
  start: {
    title: "Run this from your coding agent",
    body: "Meerko finds the leads, sends the sequence from your own Gmail and stops it when someone replies. Self-host it for free or start on Meerko Cloud with 1,000 free credits.",
    primary: ["Get started free", site.pricingUrl],
    secondary: ["Connect it to Claude Code", site.docsUrl],
  },
  docs: {
    title: "Try it in Claude Code",
    body: "Add the Meerko MCP server and ask for a lead list, a sequence or a reply triage in plain language.",
    primary: ["Set up the MCP server", site.docsUrl],
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
  const related = relatedGuides(slug);
  const c = ctas[cta];
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
        <Container className="flex gap-14 pt-12 pb-24 lg:pt-16">
          <article className="flex min-w-0 max-w-[760px] flex-1 flex-col gap-5 text-[17px] leading-[1.65] text-muted">
            <Breadcrumbs items={[["Home", "/"], ["Guides", "/guides"], [guideBySlug(slug).title, `/guides/${slug}`]]} />
            <p className="pt-4 font-mono text-[13px] tracking-[0.15em] text-accent uppercase">{eyebrow}</p>
            <h1 className="font-display text-5xl leading-[1.04] font-bold tracking-[-0.03em] text-fg lg:text-[56px]">{h1}</h1>
            <div className="text-xl leading-[1.55] text-fg">{lead}</div>
            <p className="text-sm">Updated {CHECKED_ON}. Facts link to their sources.</p>

            {children}

            <div className="my-6 flex flex-col gap-4 rounded-2xl border border-accent/25 bg-accent-soft px-7 py-7">
              <p className="font-display text-2xl font-bold text-fg">{c.title}</p>
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

            <section className="mt-6 flex flex-col gap-3 border-t border-line pt-6">
              <h2 className="font-mono text-xs tracking-[0.15em] uppercase">Related guides</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {related.map((g) => (
                  <li key={g.slug}>
                    <a href={`/guides/${g.slug}`} className="flex h-full flex-col gap-1 rounded-xl border border-line px-4 py-3.5 hover:border-muted">
                      <span className="font-semibold text-fg">{g.title}</span>
                      <span className="text-sm leading-snug">{g.summary}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            {sources.length > 0 && (
              <section className="flex flex-col gap-2 pt-4">
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

          <aside className="hidden w-[220px] shrink-0 lg:block">
            <nav aria-label="On this page" className="sticky top-28 flex flex-col gap-2.5">
              <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">On this page</p>
              {[...toc, ...(faq ? [["faq", "FAQ"] as [string, string]] : [])].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="text-[13px] text-muted hover:text-accent">
                  {label}
                </a>
              ))}
            </nav>
          </aside>
        </Container>
      </main>
      <Footer />
      <JsonLd data={article} />
      {faq && <JsonLd data={faqJsonLd(faq)} />}
    </>
  );
}
