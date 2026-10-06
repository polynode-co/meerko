import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { Toc } from "@/components/content/client";
import { JsonLd } from "@/components/json-ld";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { GitHubIcon } from "@/components/ui/brand";
import { Container } from "@/components/ui/primitives";
import { DOCS_GROUPS, docBySlug, docHref, docNeighbours, docPages, mcp, searchEntries } from "@/lib/docs";
import { site } from "@/lib/site";
import { DocsSearch } from "./search";

function Sidebar({ slug }: { slug: string }) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-6">
      <DocsSearch entries={searchEntries()} />
      {DOCS_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-0.5">
          <p className="mb-1.5 font-mono text-[11px] tracking-[0.15em] text-muted uppercase">{group}</p>
          {docPages
            .filter((p) => p.group === group)
            .map((p) => {
              const on = p.slug === slug;
              return (
                <a
                  key={p.slug}
                  href={docHref(p.slug)}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center justify-between rounded-md px-2.5 py-[7px] text-sm ${on ? "bg-accent-soft font-semibold text-accent" : "text-fg hover:text-accent"}`}
                >
                  {p.title}
                  {p.slug === "mcp-tools" && <span className="font-mono text-[11px] text-muted">{mcp.tools.length}</span>}
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

/** The docs page layout from the Pencil design: sidebar, article, and an "On this page" column. */
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
  return (
    <>
      <Nav />
      <main>
        <Container className="flex gap-14 pt-12 pb-24">
          <aside className="hidden w-[220px] shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6">
              <Sidebar slug={slug} />
            </div>
          </aside>

          <article className="flex min-w-0 flex-1 flex-col gap-6 text-base leading-[1.6] text-muted">
            <Breadcrumbs items={[["Docs", "/docs"], [page.title, docHref(slug)]]} />
            <p className="-mt-3 font-mono text-xs tracking-[0.15em] text-accent uppercase">{page.group}</p>
            <header className="-mt-3 flex flex-col gap-3">
              <h1 className="font-display text-4xl leading-tight font-bold tracking-[-0.02em] text-fg lg:text-[44px]">{h1 ?? page.title}</h1>
              <div className="text-lg leading-[1.55]">{lead}</div>
            </header>
            <details className="group rounded-xl border border-line bg-raised lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-fg [&::-webkit-details-marker]:hidden">
                Docs menu <ChevronDown className="size-4 text-muted transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-line px-3 py-4">
                <Sidebar slug={slug} />
              </div>
            </details>

            {children}

            <div className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
              {prev ? (
                <a href={docHref(prev.slug)} className="flex flex-col gap-1 rounded-xl border border-line px-[18px] py-4 hover:border-muted">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs"><ArrowLeft className="size-3" /> Previous</span>
                  <span className="font-semibold text-fg">{prev.title}</span>
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a href={docHref(next.slug)} className="flex flex-col items-end gap-1 rounded-xl border border-line px-[18px] py-4 hover:border-muted">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">Next <ArrowRight className="size-3" /></span>
                  <span className="font-semibold text-fg">{next.title}</span>
                </a>
              )}
            </div>
          </article>

          <aside className="hidden w-[220px] shrink-0 xl:block">
            <div className="sticky top-24 flex flex-col gap-6">
              {toc.length > 0 && <Toc items={toc} />}
              {tools && tools.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-line pt-5">
                  <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">MCP tools</p>
                  {tools.map((t) => (
                    <a key={t} href={`/docs/mcp-tools#${t}`} className="font-mono text-[12.5px] text-fg hover:text-accent">
                      {t}
                    </a>
                  ))}
                </div>
              )}
              <a href={`${site.githubUrl}/edit/main/apps/web/src/app/docs/${slug}/page.tsx`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
                <GitHubIcon className="size-3.5" /> Edit this page
              </a>
            </div>
          </aside>
        </Container>
      </main>
      <Footer />
      <JsonLd data={article} />
    </>
  );
}

/** Title, description and canonical URL for a docs page, from the registry. */
export function docsMetadata(slug: string, title?: string): Metadata {
  const page = docBySlug(slug);
  return { title: title ?? `${page.title} | Meerko docs`, description: page.description, alternates: { canonical: docHref(slug) } };
}
