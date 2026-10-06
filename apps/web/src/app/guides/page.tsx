import { ArrowRight, Scale, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { LogoMark } from "@/components/ui/brand";
import { Container } from "@/components/ui/primitives";
import { alternatives, FEATURED_GUIDE, guideBySlug, guides, TOPICS, topicMeta } from "@/lib/content";
import { site } from "@/lib/site";

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

function TopicIcon({ icon: Icon, size = "md" }: { icon: (typeof topicMeta)[keyof typeof topicMeta]["icon"]; size?: "md" | "sm" }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-[10px] bg-accent-soft ${size === "md" ? "size-10" : "size-8 rounded-lg"}`}>
      <Icon className={`text-accent ${size === "md" ? "size-5" : "size-4"}`} />
    </span>
  );
}

export default function GuidesHub() {
  const featured = guideBySlug(FEATURED_GUIDE);
  return (
    <>
      <Nav />
      <main>
        <Container className="flex flex-col gap-[18px] pt-7 pb-14">
          <Breadcrumbs items={[["Home", "/"], ["Guides", "/guides"]]} />
          <p className="pt-4 font-mono text-[13px] tracking-[0.15em] text-accent uppercase">Guides</p>
          <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-[-0.03em] lg:text-[64px]">Outbound guides</h1>
          <p className="max-w-[720px] text-lg leading-[1.55] text-muted lg:text-[19px]">
            How to write cold email that gets replies, send it without landing in spam, and build the systems around it. Every fact
            links to its source.
          </p>
        </Container>

        <Container className="pb-[72px]">
          <a
            href={`/guides/${featured.slug}`}
            className="group flex flex-col gap-10 rounded-[20px] border border-accent/25 bg-raised px-7 py-8 shadow-[0_20px_60px_rgba(242,169,59,0.08)] lg:flex-row lg:items-center lg:gap-12 lg:px-11 lg:py-10"
          >
            <div className="flex flex-1 flex-col gap-3.5">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-soft px-3 py-[5px] font-mono text-xs tracking-[0.1em] text-accent uppercase">
                <Sparkles className="size-3.5" /> Start here · {featured.topic}
              </span>
              <h2 className="font-display text-3xl font-bold tracking-[-0.02em] lg:text-[40px]">{featured.title}</h2>
              <p className="text-[17px] leading-[1.55] text-muted">
                {featured.summary} With the CAN-SPAM rules you have to follow.
              </p>
              <span className="inline-flex items-center gap-2 pt-1.5 font-semibold text-accent">
                Read the guide <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </div>
            <ol className="flex flex-col gap-2.5 lg:w-[480px] lg:shrink-0">
              {cadence.map(([day, text], i) => (
                <li
                  key={day}
                  className={`flex items-center gap-3.5 rounded-[10px] border px-4 py-3 text-sm ${i === 1 ? "border-accent/35 bg-accent-soft" : "border-line bg-ink"}`}
                >
                  <span className={`w-12 shrink-0 font-mono text-xs ${i === 1 ? "text-accent" : "text-muted"}`}>{day}</span>
                  {text}
                </li>
              ))}
            </ol>
          </a>
        </Container>

        {TOPICS.map((topic) => (
          <Container key={topic} className="flex flex-col gap-5 pb-14">
            <div className="flex items-center gap-3.5">
              <TopicIcon icon={topicMeta[topic].icon} />
              <div>
                <h2 className="font-display text-[26px] font-bold">{topic}</h2>
                <p className="text-sm text-muted">{topicMeta[topic].tagline}</p>
              </div>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guides
                .filter((g) => g.topic === topic)
                .map((g) => (
                  <li key={g.slug}>
                    <a href={`/guides/${g.slug}`} className="group flex h-full flex-col gap-2.5 rounded-[14px] border border-line bg-raised p-[22px] hover:border-muted">
                      <span className="text-lg leading-snug font-semibold">{g.title}</span>
                      <span className="flex-1 text-sm leading-normal text-muted">{g.summary}</span>
                      <span className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-accent">
                        Read <ArrowRight className="size-[15px] transition group-hover:translate-x-0.5" />
                      </span>
                    </a>
                  </li>
                ))}
            </ul>
          </Container>
        ))}

        <Container className="flex flex-col gap-5 pb-16">
          <div className="flex items-center gap-3.5">
            <span className="grid size-10 place-items-center rounded-[10px] bg-accent-soft">
              <Scale className="size-5 text-accent" />
            </span>
            <div>
              <h2 className="font-display text-[26px] font-bold">Comparisons</h2>
              <p className="text-sm text-muted">Meerko next to the tools it replaces, from each vendor&apos;s own pages.</p>
            </div>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {alternatives.map((a) => (
              <li key={a.slug}>
                <a href={`/alternatives/${a.slug}`} className="flex items-center gap-4 rounded-[14px] border border-line bg-raised px-5 py-[18px] hover:border-muted">
                  <span className="flex shrink-0 items-center">
                    <span className="grid size-10 place-items-center rounded-[10px] border border-line bg-ink">
                      <LogoMark size={26} />
                    </span>
                    <Image src={a.logo} alt="" width={40} height={40} className="-ml-2 size-10 rounded-[10px] border-2 border-raised" />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">Meerko vs {a.name}</span>
                    <span className="text-[13px] text-muted">{a.name} pricing and features</span>
                  </span>
                  <ArrowRight className="size-4 text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </Container>

        <Container className="pt-2 pb-24">
          <div className="flex flex-col gap-6 rounded-[20px] border border-accent/25 bg-accent-soft px-7 py-8 sm:flex-row sm:items-center sm:gap-8 lg:px-10">
            <span className="grid size-[72px] shrink-0 place-items-center rounded-[18px] bg-ink">
              <LogoMark size={48} />
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="font-display text-[26px] font-bold">Put the guides to work</p>
              <p className="leading-normal text-muted">
                Meerko finds the leads, sends the sequence from your own Gmail and stops it when someone replies, driven from Claude
                Code.
              </p>
            </div>
            <a href={site.pricingUrl} className="inline-flex shrink-0 items-center gap-2 self-start rounded-[10px] bg-accent px-[22px] py-[15px] font-semibold text-dark hover:brightness-110 sm:self-auto">
              Get started free <ArrowRight className="size-4" />
            </a>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
