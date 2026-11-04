import { ExternalLink } from "lucide-react";
import { JsonLd, faqJsonLd } from "@/components/json-ld";
import { site } from "@/lib/site";
import { crumb } from "../kit";

// Pieces the Lookout marketing pages share (pricing, integrations, alternatives, legal): breadcrumbs,
// headings, citations, source lists and FAQ lists, in the kit's night palette.

export interface Source {
  label: string;
  url: string;
}

/** The page's outer width, matching the .pen frames (1152px content at 1440). */
export const wrap = "mx-auto w-full max-w-[1440px] px-6 lg:px-36";

/** Mono "A / B / C" breadcrumb plus BreadcrumbList markup. The last item is the current page. */
export function LkBreadcrumbs({ items }: { items: [label: string, path: string][] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: new URL(path, site.url).toString() })),
  };
  return (
    <nav aria-label="Breadcrumb" className={crumb}>
      <ol className="flex flex-wrap gap-x-2 gap-y-1">
        {items.map(([label, path], i) => (
          <li key={path} className="flex gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i === items.length - 1 ? (
              <span className="text-lk-muted" aria-current="page">
                {label}
              </span>
            ) : (
              <a href={path} className="hover:text-lk-fg">
                {label}
              </a>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={data} />
    </nav>
  );
}

/** A section heading inside an article ("On this page" targets). */
export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 pt-6 text-[28px] leading-tight font-semibold tracking-[-0.8px] text-lk-fg sm:text-[32px]">
      {children}
    </h2>
  );
}

/** A citation numbered by the page's source list: `const Cite = citer(sources)`, then <Cite s={…} />. */
export function citer(sources: Source[]) {
  return function Cite({ s }: { s: Source }) {
    const n = sources.findIndex((x) => x.url === s.url) + 1;
    if (n === 0) throw new Error(`Cited a source missing from the page's list: ${s.url}`);
    return <SourceRef n={n} />;
  };
}

export function SourceRef({ n }: { n: number }) {
  return (
    <sup>
      <a href={`#source-${n}`} className="ml-0.5 font-plex text-[12px] text-lk-lime hover:underline">
        [{n}]
      </a>
    </sup>
  );
}

/** The numbered source list at the foot of a page. */
export function SourceList({ sources, title = "Sources" }: { sources: Source[]; title?: string }) {
  if (!sources.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim uppercase">{title}</h2>
      <ol className="flex flex-col gap-2 text-[15px] leading-[1.6] text-lk-muted">
        {sources.map((s, i) => (
          <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-24">
            <span className="font-plex text-[13px] text-lk-dim">[{i + 1}]</span>{" "}
            <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-lk-fg underline-offset-4 hover:text-lk-lime hover:underline">
              {s.label} <ExternalLink className="size-3" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `backticks` mark a command. */
export function withCode(text: string) {
  return text.split("`").map((part, i) => (i % 2 ? <code key={i} className="font-plex text-[0.92em] text-lk-fg">{part}</code> : part));
}

/** Question/answer pairs in two columns with top rules, plus FAQPage markup. */
export function FaqGrid({ items, columns = 2 }: { items: [string, string][]; columns?: 1 | 2 }) {
  return (
    <>
      <dl className={`grid gap-x-12 gap-y-8 ${columns === 2 ? "md:grid-cols-2" : ""}`}>
        {items.map(([q, a]) => (
          <div key={q} className="flex flex-col gap-2.5 border-t border-lk-line pt-6">
            <dt className="text-[18px] font-semibold text-lk-fg">{q}</dt>
            <dd className="text-[16px] leading-[1.6] text-lk-muted">{withCode(a)}</dd>
          </div>
        ))}
      </dl>
      <JsonLd data={faqJsonLd(items)} />
    </>
  );
}

/** A row of steps (e.g. a follow-up cadence); `highlight` marks one. */
export function Timeline({ steps, highlight }: { steps: [label: string, text: string][]; highlight?: number }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {steps.map(([label, text], i) => (
        <li
          key={label}
          className={`flex flex-col gap-1.5 px-4 py-3.5 outline outline-1 -outline-offset-1 ${i === highlight ? "bg-lk-lime/[0.07] outline-lk-lime/40" : "bg-lk-box outline-lk-line"}`}
        >
          <span className={`font-plex text-[12.5px] tracking-[0.6px] uppercase ${i === highlight ? "text-lk-lime" : "text-lk-dim"}`}>{label}</span>
          <span className="text-[15.5px] font-semibold text-lk-fg">{text}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A new mailbox's ramp, drawn from packages/core/src/sending/ramp.ts: linear from 10 a day to the daily limit
 * (50 by default) over 21 days.
 */
export function RampChart({ start = 10, limit = 50, days = 21 }: { start?: number; limit?: number; days?: number }) {
  // One bar per day, linear from the first day's allowance to the limit (schematic; the caption carries the numbers).
  const at = (d: number) => start + ((limit - start) * d) / (days - 1);
  return (
    <figure className="flex flex-col gap-3">
      <div aria-hidden className="flex h-[110px] items-end gap-[3px] sm:h-[140px] sm:gap-1.5">
        {Array.from({ length: days }, (_, d) => (
          <span key={d} className={`flex-1 ${d === days - 1 ? "bg-lk-lime" : "bg-lk-line"}`} style={{ height: `${(at(d) / limit) * 100}%` }} />
        ))}
      </div>
      <figcaption className="flex flex-col justify-between gap-1 font-plex text-[12.5px] tracking-[0.6px] uppercase sm:flex-row">
        <span className="text-lk-muted">Day 1 · {start} emails</span>
        <span className="text-lk-lime">After day {days} · {limit} emails (default limit)</span>
      </figcaption>
    </figure>
  );
}
