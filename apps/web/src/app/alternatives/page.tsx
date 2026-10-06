import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container } from "@/components/ui/primitives";
import { alternatives } from "@/lib/content";

export const metadata: Metadata = {
  title: "Open-Source Alternatives to Clay, Apollo & Instantly | Meerko",
  description: "How Meerko, the open-source AI sales agent, compares with Clay, Apollo and Instantly on price and features, from each vendor's own pages.",
  alternates: { canonical: "/alternatives" },
};

export default function AlternativesHub() {
  return (
    <>
      <Nav />
      <main>
        <Container className="flex flex-col gap-10 pt-12 pb-24 lg:pt-16">
          <div className="flex max-w-[720px] flex-col gap-4">
            <Breadcrumbs items={[["Home", "/"], ["Alternatives", "/alternatives"]]} />
            <h1 className="pt-4 font-display text-5xl leading-[1.04] font-bold tracking-[-0.03em]">Open-source alternatives</h1>
            <p className="text-lg leading-[1.55] text-muted">
              Meerko next to the tools it replaces, using only what each vendor states on its own pages, with links.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {alternatives.map((a) => (
              <li key={a.slug}>
                <a href={`/alternatives/${a.slug}`} className="flex h-full flex-col gap-2 rounded-xl border border-line px-5 py-5 hover:border-muted">
                  <span className="text-lg font-semibold">Meerko vs {a.name}</span>
                  <span className="text-[15px] leading-snug text-muted">{a.summary}</span>
                </a>
              </li>
            ))}
          </ul>
          <a href="/guides" className="w-fit font-semibold text-accent hover:underline">Read the outbound guides →</a>
        </Container>
      </main>
      <Footer />
    </>
  );
}
