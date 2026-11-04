import { Plus } from "lucide-react";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { CtaBand, GhostButton, Kicker, LimeButton, LkPage, Window } from "@/components/lookout/kit";
import { IntegrationTile } from "@/components/lookout/marketing/integration-tile";
import { H2, LkBreadcrumbs, SourceList, SourceRef, wrap, type Source } from "@/components/lookout/marketing/ui";
import { LogoMark } from "@/components/ui/brand";
import { integrationBySlug, integrations } from "@/lib/integrations";
import { site } from "@/lib/site";

// An integration's marketing page, from the .pen design "LK · Integration detail" (bPfAw).

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

// The hero's window: an illustration of a sent folder, using the same sample leads as the home page.
const sentFolder: Record<string, string> = { gmail: "GMAIL — Sent", outlook: "OUTLOOK — Sent Items" };
const sample = [
  ["Lucía M.", "Intro: ledger reconciliation for Series A teams", "DAY 0"],
  ["Pau R.", "Intro: ledger reconciliation for Series A teams", "DAY 0"],
  ["Marta G.", "Re: Intro: ledger reconciliation for Series A teams", "DAY 3"],
  ["Ana L.", "Intro: ledger reconciliation for Series A teams", "DAY 0"],
];

function SentWindow({ title }: { title: string }) {
  return (
    <div aria-hidden className="w-full min-w-0 lg:w-[520px] lg:shrink-0">
      <Window title={title}>
        {sample.map(([who, subject, when], k) => (
          <div key={who} className={`flex items-center gap-3.5 px-1 py-3 ${k ? "border-t border-lk-ink" : ""}`}>
            <span className="w-[72px] shrink-0 font-plex text-[12.5px] text-lk-ink">{who}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-lk-ink">{subject}</span>
            <span className="shrink-0 font-plex text-[12px] text-lk-gray">{when}</span>
          </div>
        ))}
      </Window>
    </div>
  );
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
    <LkPage>
      <section className={`${wrap} flex flex-col gap-14 pt-10 pb-16 lg:flex-row lg:items-center lg:gap-[72px] lg:pt-14 lg:pb-[72px]`}>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <LkBreadcrumbs items={[["Home", "/"], ["Integrations", "/integrations"], [i.name, `/integrations/${slug}`]]} />
          <p className="flex flex-wrap items-center gap-3 pt-4">
            <span className="flex items-center gap-3">
              <IntegrationTile i={i} size={44} />
              <Plus aria-hidden className="size-3.5 text-lk-dim" />
              <span className="grid size-11 place-items-center bg-lk-paper">
                <LogoMark size={26} />
              </span>
            </span>
            <span className="font-plex text-[13px] tracking-[0.8px] text-lk-lime uppercase">
              {i.group} · {i.setup}
            </span>
          </p>
          <h1 className="text-[38px] leading-[1.06] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[50px] sm:tracking-[-1.8px]">{h1}</h1>
          <div className="text-[17px] leading-[1.6] text-lk-muted">{lead}</div>
          <div className="flex flex-wrap gap-4 pt-2">
            <LimeButton href={site.signupUrl}>Start free →</LimeButton>
            <GhostButton href="/docs/mailboxes">Read the setup docs →</GhostButton>
          </div>
        </div>
        {sentFolder[slug] && <SentWindow title={sentFolder[slug]} />}
      </section>

      <section className={`${wrap} flex flex-col gap-7 pb-16`}>
        <Kicker as="h2">Set it up</Kicker>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map(([title, text], k) => (
            <li key={title} className="flex flex-col gap-2.5 bg-lk-box p-6 outline outline-1 -outline-offset-1 outline-lk-line">
              <span className="font-pixel text-[14px] text-lk-lime">{String(k + 1).padStart(2, "0")}</span>
              <span className="text-[19px] font-semibold text-lk-fg">{title}</span>
              <span className="text-[15.5px] leading-[1.6] text-lk-muted">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <article className={`${wrap} pb-20`}>
        <div className="flex max-w-[820px] flex-col gap-[22px] text-[17px] leading-[1.65] text-lk-muted [&_a]:underline-offset-4">
          {children}

          {compare && (
            <>
              <H2 id="compare">Meerko next to {compare.them}</H2>
              <div className="overflow-x-auto outline outline-1 -outline-offset-1 outline-lk-line">
                <table className="w-full min-w-[560px] text-left text-[15.5px] leading-[1.55]">
                  <thead className="bg-lk-box">
                    <tr>
                      <th className="px-4 py-3">
                        <span className="sr-only">Feature</span>
                      </th>
                      <th className="border-l border-lk-line px-4 py-3 font-pixel text-[13px] font-normal text-lk-lime uppercase">Meerko</th>
                      <th className="border-l border-lk-line px-4 py-3 font-plex text-[12.5px] font-normal tracking-[0.6px] text-lk-fg uppercase">{compare.them}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compare.rows.map((r) => (
                      <tr key={r.label} className="border-t border-lk-line align-top">
                        <th scope="row" className="px-4 py-3 font-normal text-lk-muted">{r.label}</th>
                        <td className="border-l border-lk-line bg-lk-lime/[0.05] px-4 py-3 text-lk-fg">{r.meerko}</td>
                        <td className="border-l border-lk-line px-4 py-3 text-lk-fg">
                          {r.them}
                          <SourceRef n={n(r.source)} />
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
            <div key={q} className="flex flex-col gap-2 border-t border-lk-line pt-5">
              <h3 className="text-[18px] font-semibold text-lk-fg">{q}</h3>
              <p className="text-[16px] leading-[1.6]">{a}</p>
            </div>
          ))}

          <section className="mt-6 flex flex-col gap-4 border-t border-lk-line pt-6">
            <h2 className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim uppercase">More {i.group.toLowerCase()}</h2>
            <ul className="grid gap-3.5 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <a href={r.href} className="flex h-full items-center gap-3.5 px-4 py-3.5 outline outline-1 -outline-offset-1 outline-lk-line transition hover:bg-lk-box">
                    <IntegrationTile i={r} />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15.5px] leading-snug font-semibold text-lk-fg">{r.name}</span>
                      <span className="text-[15px] leading-snug text-lk-muted">{r.summary}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <a href="/integrations" className="w-fit font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase hover:text-lk-fg">
              All integrations →
            </a>
          </section>

          <div className="pt-2">
            <SourceList sources={sources} />
          </div>
        </div>
      </article>

      <CtaBand
        title="Run it from your coding agent"
        body="Meerko finds the leads, sends the sequence from your own Gmail or Outlook and stops it when someone replies. Self-host it for free or start on Meerko Cloud with 200 free credits."
      />
      <JsonLd data={software} />
      <JsonLd data={faqJsonLd(faq)} />
    </LkPage>
  );
}
