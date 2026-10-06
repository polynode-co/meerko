import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container } from "@/components/ui/primitives";
import { alternatives, guides, TOPICS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Outbound Guides: Cold Email, Deliverability & GTM | Meerko",
  description: "Practical guides on cold email follow-ups, subject lines, templates, Gmail sending limits, deliverability and GTM engineering, with sources.",
  alternates: { canonical: "/guides" },
};

export default function GuidesHub() {
  return (
    <>
      <Nav />
      <main>
        <Container className="flex flex-col gap-12 pt-12 pb-24 lg:pt-16">
          <div className="flex max-w-[720px] flex-col gap-4">
            <Breadcrumbs items={[["Home", "/"], ["Guides", "/guides"]]} />
            <h1 className="pt-4 font-display text-5xl leading-[1.04] font-bold tracking-[-0.03em]">Outbound guides</h1>
            <p className="text-lg leading-[1.55] text-muted">
              How to write cold email that gets replies, send it without landing in spam, and build the systems around it. Every
              fact links to its source.
            </p>
          </div>
          {TOPICS.map((topic) => (
            <section key={topic} className="flex flex-col gap-4">
              <h2 className="font-display text-[28px] font-bold">{topic}</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {guides
                  .filter((g) => g.topic === topic)
                  .map((g) => (
                    <li key={g.slug}>
                      <a href={`/guides/${g.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-line px-5 py-5 hover:border-muted">
                        <span className="text-lg font-semibold">{g.title}</span>
                        <span className="text-[15px] leading-snug text-muted">{g.summary}</span>
                      </a>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-[28px] font-bold">Comparisons</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {alternatives.map((a) => (
                <li key={a.slug}>
                  <a href={`/alternatives/${a.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-line px-5 py-5 hover:border-muted">
                    <span className="text-lg font-semibold">Meerko vs {a.name}</span>
                    <span className="text-[15px] leading-snug text-muted">{a.summary}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </Container>
      </main>
      <Footer />
    </>
  );
}
