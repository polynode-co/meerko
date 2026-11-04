import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { LimeButton, LkFooter, LkNav, kicker, lead, pageTitle } from "@/components/lookout/kit";
import { LkBreadcrumbs } from "@/components/lookout/docs/breadcrumbs";
import { alternatives, FEATURED_GUIDE, guideBySlug, guides, TOPICS, topicMeta } from "@/lib/content";
import { site } from "@/lib/site";

// The guides hub from the .pen design "LK · Guides" (i7uyO): a numbered list of every guide, comparisons, a closing panel.

export const metadata: Metadata = {
  title: "Outbound Guides: Cold Email, Deliverability & GTM | Meerko",
  description: "Practical guides on cold email follow-ups, subject lines, templates, Gmail sending limits, deliverability and GTM engineering, with sources.",
  alternates: { canonical: "/guides" },
};

// The follow-up cadence from the featured guide, as a preview.
const cadence: [string, string][] = [
  ["Day 1", "First email"],
  ["Day 4", "Follow-up 1 · a short bump with something new"],
  ["Day 8", "Follow-up 2 · a different angle"],
  ["Day 14", "Follow-up 3 · the polite close"],
];

const section = "mx-auto max-w-[1440px] px-6 lg:px-36";
const mono = "font-plex text-[12.5px] tracking-[0.6px] uppercase";

export default function GuidesHub() {
  const featured = guideBySlug(FEATURED_GUIDE);
  const ordered = TOPICS.flatMap((t) => guides.filter((g) => g.topic === t));
  return (
    <div className="min-h-dvh bg-lk-bg text-lk-fg">
      <LkNav />
      <main>
        <section className={`${section} flex flex-col gap-5 pt-14 pb-12 lg:pt-24 lg:pb-14`}>
          <LkBreadcrumbs items={[["Home", "/"], ["Guides", "/guides"]]} />
          <span className={`${kicker} pt-4`}>Guides</span>
          <h1 className={`${pageTitle} max-w-[900px]`}>Outbound guides</h1>
          <p className={`${lead} max-w-[680px]`}>
            How to write cold email that gets replies, send it without landing in spam, and build the systems around it. Every fact links to
            its source.
          </p>
        </section>

        <section className={`${section} pb-16`}>
          <a
            href={`/guides/${featured.slug}`}
            className="group flex flex-col gap-8 bg-lk-box p-7 outline outline-1 -outline-offset-1 outline-lk-gray transition hover:outline-lk-muted lg:flex-row lg:items-center lg:gap-12 lg:p-10"
          >
            <div className="flex flex-1 flex-col gap-3.5">
              <span className="font-pixel text-[13px] text-lk-lime">Start here · {featured.topic}</span>
              <h2 className="text-[28px] leading-tight font-semibold tracking-[-1px] text-lk-fg lg:text-[36px] lg:tracking-[-1.4px]">{featured.title}</h2>
              <p className="text-[17px] leading-[1.6] text-lk-muted">{featured.summary} With the CAN-SPAM rules you have to follow.</p>
              <span className={`${mono} pt-1.5 font-semibold text-lk-fg`}>
                Read the guide <span className="inline-block transition group-hover:translate-x-0.5">→</span>
              </span>
            </div>
            <ol className="flex flex-col lg:w-[480px] lg:shrink-0">
              {cadence.map(([day, text], i) => (
                <li
                  key={day}
                  className={`-mt-px flex items-center gap-4 px-4 py-3 text-[15px] outline outline-1 -outline-offset-1 ${i === 1 ? "bg-lk-lime/[0.07] text-lk-fg outline-lk-lime/45" : "bg-lk-ink text-lk-muted outline-lk-line"}`}
                >
                  <span className={`w-14 shrink-0 font-plex text-[12.5px] uppercase ${i === 1 ? "text-lk-lime" : "text-lk-dim"}`}>{day}</span>
                  {text}
                </li>
              ))}
            </ol>
          </a>
        </section>

        <section className={`${section} flex flex-col gap-12`}>
          {TOPICS.map((topic) => (
            <div key={topic} className="flex flex-col">
              <div className="flex flex-col gap-1 pb-4 sm:flex-row sm:items-baseline sm:gap-4">
                <h2 className={kicker}>{topic}</h2>
                <p className="text-[15px] text-lk-muted">{topicMeta[topic].tagline}</p>
              </div>
              <ul className="border-b border-lk-line">
                {guides
                  .filter((g) => g.topic === topic)
                  .map((g) => (
                    <li key={g.slug} className="border-t border-lk-line">
                      <a href={`/guides/${g.slug}`} className="group flex items-start gap-4 py-6 sm:gap-8 sm:py-[26px]">
                        <span className="pt-1.5 font-plex text-[13.5px] tracking-[0.6px] text-lk-lime">{String(ordered.indexOf(g) + 1).padStart(2, "0")}</span>
                        <span className={`${mono} hidden w-[150px] shrink-0 pt-1.5 text-lk-dim md:block`}>{g.topic}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="text-[20px] leading-snug font-semibold tracking-[-0.6px] text-lk-fg group-hover:text-lk-lime sm:text-[24px] sm:tracking-[-0.8px]">
                            {g.title}
                          </span>
                          <span className="text-[15.5px] leading-[1.55] text-lk-muted">{g.summary}</span>
                        </span>
                        <ArrowRight className="mt-2 hidden size-4 shrink-0 text-lk-dim transition group-hover:translate-x-0.5 group-hover:text-lk-lime sm:block" />
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>

        <section className={`${section} flex flex-col gap-6 pt-20 pb-16`}>
          <h2 className={kicker}>Comparisons</h2>
          <p className="max-w-[640px] text-[17px] leading-[28px] text-lk-muted">Meerko next to the tools it replaces, from each vendor&apos;s own pages.</p>
          <ul className="grid gap-6 md:grid-cols-3">
            {alternatives.map((a) => (
              <li key={a.slug}>
                <a href={`/alternatives/${a.slug}`} className="group flex h-full items-center gap-4 bg-lk-box p-6 outline outline-1 -outline-offset-1 outline-lk-line transition hover:outline-lk-gray">
                  <Image src={a.logo} alt="" width={32} height={32} className="size-8 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[18px] font-semibold text-lk-fg">Meerko vs {a.name}</span>
                    <span className="text-[15px] text-lk-muted">{a.name} pricing and features</span>
                  </span>
                  <span className={`${mono} shrink-0 text-lk-muted group-hover:text-lk-lime`}>Compare →</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${section} pb-24`}>
          <div className="flex flex-col items-start gap-6 bg-lk-box p-8 outline outline-1 -outline-offset-1 outline-lk-gray sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-[720px] flex-col gap-2.5">
              <p className="text-[26px] leading-[33px] font-semibold tracking-[-0.6px] text-lk-fg">Put the guides to work</p>
              <p className="text-[16px] leading-[26px] text-lk-muted">
                Meerko finds the leads, sends the sequence from your own Gmail or Outlook and stops it when someone replies, driven from Claude Code.
              </p>
            </div>
            <LimeButton href={site.pricingUrl} className="shrink-0">
              Get started free →
            </LimeButton>
          </div>
        </section>
      </main>
      <LkFooter />
    </div>
  );
}
