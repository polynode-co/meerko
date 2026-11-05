import { ExternalLink, Scale } from "lucide-react";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { GhostButton, LimeButton, LkLandscapeFooter, LkNav } from "@/components/lookout/kit";
import { LogoMark } from "@/components/ui/brand";
import { guideBySlug, relatedGuides } from "@/lib/content";
import { site } from "@/lib/site";
import { CHECKED_ON } from "@/lib/sources";
import { LkBreadcrumbs } from "./breadcrumbs";
import { lkScopeClass, lkScopeStyle } from "./scope";
import { CopyText, LkToc } from "./toc";

// The guide article template from the .pen design (xHrWK): one centred 760px column, paper windows for samples,
// a closing panel. "On this page" sits to the right on wide screens.

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
        <a href={`#source-${n}`} className="ml-0.5 font-plex text-[12px] text-lk-lime hover:underline">
          [{n}]
        </a>
      </sup>
    );
  };
}

/** A section heading that the "On this page" list links to. */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-6 font-sans text-[26px] leading-tight font-semibold tracking-[-1px] text-lk-fg sm:text-[30px] sm:tracking-[-1.4px]">
      {children}
    </h2>
  );
}

/** An email or code sample in a paper window, with a Copy button (pass the text as a string child). */
export function Sample({ title, children }: { title?: string; children: string }) {
  return (
    <div className="mr-2.5 bg-lk-paper text-lk-ink shadow-[10px_10px_0_#000] outline outline-1 -outline-offset-1 outline-lk-fg">
      <div className="flex items-center justify-between gap-4 border-b-[1.5px] border-lk-ink px-3 py-[7px]">
        <p className="min-w-0 truncate font-pixel text-[13px]">{title ?? "Sample"}</p>
        <CopyText text={children} className="shrink-0 text-lk-ink" />
      </div>
      <div className="p-[18px] font-plex text-[14px] leading-[1.6] break-words whitespace-pre-line">{children}</div>
    </div>
  );
}

/** A lime note for rules and legal requirements. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-lk-lime/[0.07] px-4 py-3.5 text-[15.5px] leading-[1.6] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-lime/35">
      <Scale className="mt-[3px] size-4 shrink-0 text-lk-lime" />
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

/** A row of steps (e.g. a follow-up cadence); `highlight` marks one. */
export function Timeline({ steps, highlight }: { steps: [label: string, text: string][]; highlight?: number }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {steps.map(([label, text], i) => (
        <li
          key={label}
          className={`flex flex-col gap-1.5 px-4 py-3.5 outline outline-1 -outline-offset-1 ${i === highlight ? "bg-lk-lime/[0.07] outline-lk-lime/45" : "bg-lk-box outline-lk-line"}`}
        >
          <span className={`font-plex text-[12.5px] tracking-[0.6px] uppercase ${i === highlight ? "text-lk-lime" : "text-lk-dim"}`}>{label}</span>
          <span className="text-[15px] leading-snug font-semibold text-lk-fg">{text}</span>
        </li>
      ))}
    </ol>
  );
}

const ctas = {
  start: {
    title: "Run this from your coding agent",
    body: "Meerko finds the leads, sends the sequence from your own Gmail or Outlook and stops it when someone replies. Self-host it for free or start on Meerko Cloud with 200 free credits.",
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

const meta = "font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase";
const smallHead = "font-plex text-[13px] tracking-[0.8px] text-lk-dim uppercase";

export function GuideShell({ slug, eyebrow, h1, lead, toc, sources, faq, cta = "start", children, description }: GuideShellProps) {
  const guide = guideBySlug(slug);
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
    <div className="min-h-dvh bg-lk-bg text-lk-fg">
      <LkNav />
      <main style={lkScopeStyle} className={lkScopeClass}>
        <div className="mx-auto grid max-w-[1440px] px-5 pt-12 pb-20 sm:px-10 lg:pt-20 xl:grid-cols-[1fr_minmax(0,760px)_1fr] xl:gap-12 xl:px-12">
          <div className="hidden xl:block" />
          <article className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-[22px] text-[17px] leading-[1.7] text-lk-muted">
            <header className="flex flex-col gap-5 pb-6">
              <LkBreadcrumbs
                items={[["Home", "/"], ["Guides", "/guides"], [guide.title, `/guides/${slug}`]]}
                trail={[["Home", "/"], ["Guides", "/guides"], [guide.topic]]}
              />
              <p className="font-pixel text-[13px] text-lk-lime">{eyebrow}</p>
              <h1 className="font-sans text-[38px] leading-[1.06] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[52px] sm:leading-[55px] sm:tracking-[-2px]">{h1}</h1>
              <div className="flex flex-col gap-2 border-l-2 border-lk-lime pl-5">
                <p className="font-plex text-[12.5px] tracking-[0.8px] text-lk-lime uppercase">The short answer</p>
                <div className="text-[18px] leading-[29px] text-lk-fg">{lead}</div>
              </div>
              <p className="flex flex-wrap gap-x-5 gap-y-1">
                <span className={meta}>Updated {CHECKED_ON}</span>
                <span className={meta}>Facts link to their sources</span>
              </p>
            </header>

            {children}

            <div className="my-6 flex flex-col gap-5 bg-lk-box p-7 outline outline-1 -outline-offset-1 outline-lk-gray sm:p-10">
              <div className="flex items-center gap-3.5">
                <LogoMark size={30} />
                <p className="text-[24px] leading-tight font-semibold tracking-[-0.6px] text-lk-fg sm:text-[26px]">{c.title}</p>
              </div>
              <p className="text-[16px] leading-[26px]">{c.body}</p>
              <div className="flex flex-wrap gap-3">
                <LimeButton href={c.primary[1]}>{c.primary[0]} →</LimeButton>
                <GhostButton href={c.secondary[1]}>{c.secondary[0]}</GhostButton>
              </div>
            </div>

            {faq && (
              <>
                <H2 id="faq">FAQ</H2>
                {faq.map(([q, a]) => (
                  <div key={q} className="flex flex-col gap-1.5 border-t border-lk-line pt-4">
                    <h3 className="text-[19px] font-semibold tracking-[-0.3px] text-lk-fg">{q}</h3>
                    <p>{a}</p>
                  </div>
                ))}
              </>
            )}

            <section className="mt-6 flex flex-col gap-4 border-t border-lk-line pt-7">
              <h2 className={smallHead}>Related guides</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((g) => (
                  <li key={g.slug}>
                    <a href={`/guides/${g.slug}`} className="group flex h-full flex-col gap-1.5 bg-lk-box p-5 outline outline-1 -outline-offset-1 outline-lk-line transition hover:outline-lk-gray">
                      <span className="font-plex text-[12px] tracking-[0.6px] text-lk-lime uppercase">{g.topic}</span>
                      <span className="text-[16px] leading-snug font-semibold text-lk-fg">{g.title}</span>
                      <span className="text-[15px] leading-[1.5]">{g.summary}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            {sources.length > 0 && (
              <section className="flex flex-col gap-3 pt-4">
                <h2 className={smallHead}>Sources</h2>
                <ol className="flex flex-col gap-2 text-[15px] leading-[1.5]">
                  {sources.map((s, i) => (
                    <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-24">
                      <span className="font-plex text-[13px] text-lk-dim">[{i + 1}]</span>{" "}
                      <a href={s.url} target="_blank" rel="noopener" className="text-lk-fg underline decoration-lk-gray underline-offset-4 hover:text-lk-lime hover:decoration-lk-lime">
                        {s.label}
                        <ExternalLink className="ml-1 inline size-3 align-baseline" />
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>

          <aside className="hidden pt-[220px] xl:block">
            <div className="sticky top-[calc(var(--lk-nav-h)+2rem)] flex max-w-[260px] flex-col gap-8">
              <LkToc items={tocItems} />
              <div className="flex flex-col gap-3 bg-lk-box p-[18px] outline outline-1 -outline-offset-1 outline-lk-line">
                <span className="flex items-center gap-2.5 font-pixel text-[15px] text-lk-fg">
                  <LogoMark size={22} /> Meerko
                </span>
                <p className="text-[15px] leading-[1.5] text-lk-muted">The open-source AI sales agent, run from Claude Code. Sends from your own Gmail or Outlook.</p>
                <LimeButton href={site.pricingUrl} className="text-center">
                  Get started free
                </LimeButton>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <LkLandscapeFooter />
      <JsonLd data={article} />
      {faq && <JsonLd data={faqJsonLd(faq)} />}
    </div>
  );
}
