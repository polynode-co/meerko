import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { JsonLd } from "@/components/json-ld";
import { LkFooter, LkNav } from "@/components/lookout/kit";
import { GitHubIcon } from "@/components/ui/brand";
import { DOCS_GROUPS, docBySlug, docHref, docNeighbours, docPages, mcp, searchEntries } from "@/lib/docs";
import { site } from "@/lib/site";
import { LkBreadcrumbs } from "./breadcrumbs";
import { lkScopeClass, lkScopeStyle } from "./scope";
import { DocsSearch } from "./search";
import { LkToc } from "./toc";

// The docs article template from the .pen design (pnGLf): the docs menu on the left, the article, and
// "On this page" on the right. Every /docs/* page renders through it.

const groupLabel = "font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase";

function DocsMenu({ slug }: { slug: string }) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-7">
      <DocsSearch entries={searchEntries()} />
      {DOCS_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-0.5">
          <p className={`${groupLabel} mb-1.5`}>{group}</p>
          {docPages
            .filter((p) => p.group === group)
            .map((p) => {
              const on = p.slug === slug;
              return (
                <a
                  key={p.slug}
                  href={docHref(p.slug)}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 px-2.5 py-[7px] text-[15.5px] ${on ? "bg-lk-lime font-semibold text-lk-ink" : "text-lk-muted hover:text-lk-fg"}`}
                >
                  {p.title}
                  {p.slug === "mcp-tools" && <span className={`font-plex text-[12px] ${on ? "text-lk-ink" : "text-lk-dim"}`}>{mcp.tools.length}</span>}
                </a>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

export interface DocsShellProps {
  slug: string;
  /** The page's h1, when it differs from its sidebar title. */
  h1?: string;
  lead: React.ReactNode;
  toc: [id: string, label: string][];
  /** MCP tools this page covers, listed under "On this page". */
  tools?: string[];
  children: React.ReactNode;
}

export function DocsShell({ slug, h1, lead, toc, tools, children }: DocsShellProps) {
  const page = docBySlug(slug);
  const { prev, next } = docNeighbours(slug);
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: h1 ?? page.title,
    description: page.description,
    publisher: { "@type": "Organization", name: "Meerko", url: site.url },
  };
  const pager = "flex min-w-0 flex-1 flex-col gap-1.5 p-5 outline outline-1 -outline-offset-1 outline-lk-line transition hover:outline-lk-gray";
  return (
    <div className="min-h-dvh bg-lk-bg text-lk-fg">
      <LkNav wide />
      <main style={lkScopeStyle} className={lkScopeClass}>
        <div className="flex">
          <aside className="hidden w-[296px] shrink-0 border-r border-lk-line lg:block">
            <div className="lk-scroll sticky top-[var(--lk-nav-h)] max-h-[calc(100dvh-var(--lk-nav-h))] overflow-y-auto py-10 pr-6 pl-12">
              <DocsMenu slug={slug} />
            </div>
          </aside>

          <article className="flex min-w-0 flex-1 flex-col gap-[22px] px-5 pt-10 pb-20 text-[16px] leading-[1.65] text-lk-muted sm:px-10 lg:px-[72px] lg:pt-14 lg:pb-24">
            <div className="mx-auto flex w-full max-w-[880px] flex-col gap-[22px]">
              <LkBreadcrumbs items={[["Docs", "/docs"], [page.title, docHref(slug)]]} trail={[["Docs", "/docs"], [page.group]]} />
              <header className="flex flex-col gap-4">
                <h1 className="font-sans text-[36px] leading-[1.08] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[48px] sm:leading-[50px] sm:tracking-[-2px]">
                  {h1 ?? page.title}
                </h1>
                <div className="text-[17px] leading-[1.6] text-lk-muted sm:text-[18px] sm:leading-[29px]">{lead}</div>
              </header>
              <details className="group bg-lk-box outline outline-1 -outline-offset-1 outline-lk-line lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-plex text-[13px] tracking-[0.8px] text-lk-fg uppercase [&::-webkit-details-marker]:hidden">
                  Docs menu <ChevronDown className="size-4 text-lk-dim transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-lk-line px-3 py-4">
                  <DocsMenu slug={slug} />
                </div>
              </details>

              {children}

              <div className="mt-4 flex flex-col gap-4 pt-6 sm:flex-row sm:gap-6">
                {prev ? (
                  <a href={docHref(prev.slug)} className={pager}>
                    <span className="font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">← Previous</span>
                    <span className="text-[16px] font-semibold text-lk-fg">{prev.title}</span>
                  </a>
                ) : (
                  <span className="hidden flex-1 sm:block" />
                )}
                {next ? (
                  <a href={docHref(next.slug)} className={`${pager} items-end text-right`}>
                    <span className="font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">Next →</span>
                    <span className="text-[16px] font-semibold text-lk-fg">{next.title}</span>
                  </a>
                ) : (
                  <span className="hidden flex-1 sm:block" />
                )}
              </div>
            </div>
          </article>

          <aside className="hidden w-[288px] shrink-0 xl:block">
            <div className="lk-scroll sticky top-[var(--lk-nav-h)] flex max-h-[calc(100dvh-var(--lk-nav-h))] flex-col gap-7 overflow-y-auto pt-14 pr-12 pb-10">
              {toc.length > 0 && <LkToc items={toc} />}
              {tools && tools.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-lk-line pt-5">
                  <p className={groupLabel}>MCP tools</p>
                  {tools.map((t) => (
                    <a key={t} href={`/docs/mcp-tools#${t}`} className="font-plex text-[13px] text-lk-muted hover:text-lk-lime">
                      {t}
                    </a>
                  ))}
                </div>
              )}
              <a
                href={`${site.githubUrl}/edit/main/apps/web/src/app/docs/${slug}/page.tsx`}
                className="inline-flex items-center gap-2 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase hover:text-lk-fg"
              >
                <GitHubIcon className="size-3.5" /> Edit this page
              </a>
            </div>
          </aside>
        </div>
      </main>
      <LkFooter />
      <JsonLd data={article} />
    </div>
  );
}

/** Title, description and canonical URL for a docs page, from the registry. */
export function docsMetadata(slug: string, title?: string): Metadata {
  const page = docBySlug(slug);
  return { title: title ?? `${page.title} | Meerko docs`, description: page.description, alternates: { canonical: docHref(slug) } };
}
