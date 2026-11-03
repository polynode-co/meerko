import { ArrowRight, ExternalLink } from "lucide-react";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { H2, type Source } from "@/components/content/guide-shell";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container } from "@/components/ui/primitives";
import { integrationBySlug, integrations } from "@/lib/integrations";
import { site } from "@/lib/site";
import { IntegrationIcon } from "./integration-icon";

/** A row of "how it compares" facts. `source` cites the other product's cell; Meerko's cells describe Meerko's own code. */
export interface CompareRow {
  label: string;
  meerko: string;
  them: string;
  source: Source;
}

export interface IntegrationShellProps {
  slug: string;
  h1: string;
  lead: React.ReactNode;
  /** The setup in a few steps, shown near the top. */
  steps: [title: string, text: React.ReactNode][];
  compare?: { them: string; rows: CompareRow[] };
  faq: [string, string][];
  sources: Source[];
  description: string;
  children: React.ReactNode;
}

export function IntegrationShell({ slug, h1, lead, steps, compare, faq, sources, description, children }: IntegrationShellProps) {
  const i = integrationBySlug(slug);
  const related = integrations.filter((x) => x.group === i.group && x.slug !== slug);
  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Meerko for ${i.name}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "Meerko", url: site.url },
  };
  const n = (s: Source) => {
    const k = sources.findIndex((x) => x.url === s.url) + 1;
    if (k === 0) throw new Error(`Cited a source missing from the page's list: ${s.url}`);
    return k;
  };
  return (
    <>
      <Nav />
      <main>
        <Container className="flex flex-col gap-[22px] pt-7 pb-20 text-[17px] leading-[1.65] text-muted">
          <div className="flex max-w-[820px] flex-col gap-[22px]">
            <Breadcrumbs items={[["Home", "/"], ["Integrations", "/integrations"], [i.name, `/integrations/${slug}`]]} />
            <p className="flex items-center gap-3 pt-5 font-mono text-[13px] tracking-[0.12em] text-accent uppercase">
              <IntegrationIcon i={i} size={32} />
              {i.group} · {i.setup}
            </p>
            <h1 className="font-display text-5xl leading-[1.04] font-bold tracking-[-0.03em] text-fg lg:text-[56px]">{h1}</h1>
            <div className="text-lg leading-[1.55] text-fg">{lead}</div>
            <div className="flex flex-wrap gap-3">
              <a href={site.signupUrl} className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-3 font-semibold text-dark hover:brightness-110">
                Start free <ArrowRight className="size-4" />
              </a>
              <a href="/docs/mailboxes" className="inline-flex items-center rounded-[10px] border border-line px-5 py-3 font-semibold text-fg hover:border-muted">
                Read the setup docs
              </a>
            </div>
          </div>

          <ol className="grid gap-3 pt-4 sm:grid-cols-3">
            {steps.map(([title, text], k) => (
              <li key={title} className="flex flex-col gap-1.5 rounded-xl border border-line bg-raised px-5 py-4">
                <span className="font-mono text-xs text-accent">{String(k + 1).padStart(2, "0")}</span>
                <span className="text-[17px] font-semibold text-fg">{title}</span>
                <span className="text-[15px] leading-snug">{text}</span>
              </li>
            ))}
          </ol>

          <article className="flex max-w-[820px] flex-col gap-[22px]">
            {children}

            {compare && (
              <>
                <H2 id="compare">Meerko next to {compare.them}</H2>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[560px] text-left text-[15px]">
                    <thead className="bg-raised font-mono text-xs tracking-[0.1em] uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium"></th>
                        <th className="px-4 py-3 font-medium text-accent">Meerko</th>
                        <th className="px-4 py-3 font-medium">{compare.them}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compare.rows.map((r) => (
                        <tr key={r.label} className="border-t border-line align-top">
                          <th className="px-4 py-3 font-semibold text-fg">{r.label}</th>
                          <td className="px-4 py-3 text-fg">{r.meerko}</td>
                          <td className="px-4 py-3">
                            {r.them}
                            <sup>
                              <a href={`#source-${n(r.source)}`} className="ml-0.5 font-mono text-[11px] text-accent hover:underline">[{n(r.source)}]</a>
                            </sup>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <H2 id="faq">FAQ</H2>
            {faq.map(([q, a]) => (
              <div key={q} className="flex flex-col gap-1.5 border-t border-line pt-4">
                <h3 className="text-lg font-semibold text-fg">{q}</h3>
                <p>{a}</p>
              </div>
            ))}

            <section className="mt-4 flex flex-col gap-3.5 border-t border-line pt-6">
              <h2 className="font-mono text-xs tracking-[0.15em] uppercase">More {i.group.toLowerCase()}</h2>
              <ul className="grid gap-3.5 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <a href={r.href} className="flex h-full items-center gap-3 rounded-xl border border-line px-4 py-3.5 hover:border-muted">
                      <IntegrationIcon i={r} size={34} />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px] leading-snug font-semibold text-fg">{r.name}</span>
                        <span className="text-[13px] leading-snug">{r.summary}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <a href="/integrations" className="w-fit text-sm font-semibold text-accent hover:underline">All integrations →</a>
            </section>

            {sources.length > 0 && (
              <section className="flex flex-col gap-2 pt-3">
                <h2 className="font-mono text-xs tracking-[0.15em] uppercase">Sources</h2>
                <ol className="flex flex-col gap-1.5 text-sm">
                  {sources.map((s, k) => (
                    <li key={s.url} id={`source-${k + 1}`} className="scroll-mt-24">
                      [{k + 1}]{" "}
                      <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-fg hover:text-accent">
                        {s.label} <ExternalLink className="size-3" />
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </article>
        </Container>
      </main>
      <Footer />
      <JsonLd data={software} />
      <JsonLd data={faqJsonLd(faq)} />
    </>
  );
}
