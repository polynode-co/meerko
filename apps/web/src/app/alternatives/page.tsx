import type { Metadata } from "next";
import Image from "next/image";
import { LkPage, lead, pageTitle } from "@/components/lookout/kit";
import { LkBreadcrumbs, wrap } from "@/components/lookout/marketing/ui";
import { alternatives } from "@/lib/content";

export const metadata: Metadata = {
  title: "Open-Source Alternatives to Clay, Apollo & Instantly | Meerko",
  description: "How Meerko, the open-source AI sales agent, compares with Clay, Apollo and Instantly on price and features, from each vendor's own pages.",
  alternates: { canonical: "/alternatives" },
};

// From the .pen design "LK · Alternatives" (PeYwQ).
export default function AlternativesHub() {
  return (
    <LkPage>
      <section className={`${wrap} flex flex-col gap-5 pt-10 pb-12 lg:pt-14`}>
        <LkBreadcrumbs items={[["Home", "/"], ["Alternatives", "/alternatives"]]} />
        <h1 className={`${pageTitle} pt-6 lg:pt-10`}>Open-source alternatives</h1>
        <p className={`${lead} max-w-[760px]`}>Meerko next to the tools it replaces, using only what each vendor states on its own pages, with links.</p>
      </section>
      <ul className={`${wrap} grid gap-6 pb-16 md:grid-cols-3`}>
        {alternatives.map((a) => (
          <li key={a.slug}>
            <a
              href={`/alternatives/${a.slug}`}
              className="group flex h-full flex-col gap-[18px] bg-lk-box p-7 outline outline-1 -outline-offset-1 outline-lk-line transition hover:outline-lk-gray"
            >
              <span className="flex items-center gap-2.5">
                <span className="font-pixel text-[14px] text-lk-lime">MEERKO</span>
                <span className="font-plex text-[12.5px] text-lk-dim">VS</span>
                <Image src={a.logo} alt="" width={20} height={20} className="size-5" />
                <span className="font-pixel text-[14px] text-lk-fg uppercase">{a.name}</span>
              </span>
              <span className="flex-1 text-[16px] leading-[1.6] text-lk-muted">{a.summary}</span>
              <span className="font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-fg uppercase group-hover:text-lk-lime">
                Compare →
              </span>
            </a>
          </li>
        ))}
      </ul>
      <div className={`${wrap} pb-24`}>
        <a href="/guides" className="font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase hover:text-lk-fg">
          Read the outbound guides →
        </a>
      </div>
    </LkPage>
  );
}
