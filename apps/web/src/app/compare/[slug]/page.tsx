import { ArrowRight, Check, CircleDot, FileUp, Minus, Sparkles, ThumbsUp } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container, Eyebrow, SectionTitle, TerminalWindow } from "@/components/ui/primitives";
import { site } from "@/lib/site";

// "yes" | "no" | "partial", then the text shown. Competitor claims: re-check before publishing a new page.
type Cell = ["yes" | "no" | "partial", string];
interface Competitor {
  name: string;
  pitch: string;
  rows: [string, Cell, Cell][];
  theyWin: string;
  importNote: string;
}

const competitors: Record<string, Competitor> = {
  clay: {
    name: "Clay",
    pitch:
      "Clay is a great spreadsheet for enrichment. Meerko is the whole outbound loop: find, enrich, send from your own inbox and work the replies, driven by your agent. And you can self-host it for $0.",
    rows: [
      ["Open source & self-hostable", ["yes", "AGPL-3.0"], ["no", "Closed"]],
      ["Price to start", ["yes", "$0, or $49/mo cloud"], ["partial", "From $349/mo"]],
      ["Sends from your own inbox", ["yes", "Gmail, threaded"], ["no", "Via a separate tool"]],
      ["Reply inbox & AI drafts", ["yes", "Built in"], ["no", "Not included"]],
      ["Driven by your agent (MCP + CLI)", ["yes", "31 tools, 4 commands"], ["partial", "Web app first"]],
      ["Enrichment providers", ["partial", "Waterfall of 4+"], ["yes", "100+ providers"]],
      ["Your data", ["yes", "Your Postgres"], ["partial", "Their cloud"]],
    ],
    theyWin: "A huge provider marketplace, AI research agents, and a polished spreadsheet for ops teams who live in a browser.",
    importNote: "Export your Clay table as CSV.",
  },
};

export function generateStaticParams() {
  return Object.keys(competitors).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = competitors[(await params).slug];
  if (!c) return {};
  return {
    title: `The open-source ${c.name} alternative — Meerko`,
    description: `Meerko vs ${c.name}: find, enrich, send from your own inbox and work replies from your agent. Open source and self-hostable.`,
    alternates: { canonical: `/compare/${(await params).slug}` },
  };
}

function Mark({ kind, ours }: { kind: Cell[0]; ours: boolean }) {
  if (kind === "yes") return <Check className={`size-4 shrink-0 ${ours ? "text-signal" : "text-muted"}`} />;
  if (kind === "no") return <Minus className="size-4 shrink-0 text-muted" />;
  return <CircleDot className="size-4 shrink-0 text-muted" />;
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const c = competitors[(await params).slug];
  if (!c) notFound();
  return (
    <>
      <Nav />
      <main>
        <section>
          <Container className="flex flex-col items-center gap-6 pt-24 pb-16 text-center lg:pt-[104px] lg:pb-[72px]">
            <span className="rounded-full bg-accent-soft px-3.5 py-1.5 font-mono text-[13px] tracking-[0.1em] text-accent uppercase">
              Meerko vs {c.name}
            </span>
            <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-[-0.03em] sm:text-6xl lg:text-[72px]">
              The open-source
              <br />
              {c.name} alternative.
            </h1>
            <p className="max-w-[720px] text-lg leading-[1.55] text-muted lg:text-[19px]">{c.pitch}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <a href={site.pricingUrl} className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-[22px] py-[15px] font-semibold text-dark hover:brightness-110">
                Start free <ArrowRight className="size-[17px]" />
              </a>
              <a href="#switch" className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-raised px-[22px] py-[15px] font-semibold hover:border-muted">
                <FileUp className="size-[17px]" /> Import a {c.name} CSV
              </a>
            </div>
          </Container>
        </section>

        <section>
          <Container className="pb-24 lg:px-[180px] lg:pb-[104px]">
            <div className="overflow-x-auto rounded-[18px] border border-line">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-raised font-mono text-[13px] tracking-[0.08em] uppercase">
                  <tr>
                    <th className="px-7 py-[18px] font-normal">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th className="w-[250px] px-7 py-[18px] font-bold text-accent">Meerko</th>
                    <th className="w-[220px] px-7 py-[18px] font-normal text-muted">{c.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map(([label, ours, theirs]) => (
                    <tr key={label} className="border-t border-line">
                      <th scope="row" className="px-7 py-[18px] text-[15px] font-medium">{label}</th>
                      {[ours, theirs].map(([kind, text], i) => (
                        <td key={i} className="px-7 py-[18px] text-[15px] whitespace-nowrap text-muted">
                          <span className="flex items-center gap-2">
                            <Mark kind={kind} ours={i === 0} />
                            {text}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>
        </section>

        <section>
          <Container className="grid gap-6 pb-24 md:grid-cols-2 lg:px-[180px] lg:pb-28">
            {[
              { title: `Where ${c.name} still wins`, body: c.theyWin, Icon: ThumbsUp, tone: "text-muted" },
              {
                title: "Where Meerko wins",
                body: "One loop from lead to reply, run by your agent from the terminal. Open source, so you can read, fork and self-host every line.",
                Icon: Sparkles,
                tone: "text-accent",
              },
            ].map(({ title, body, Icon, tone }) => (
              <div key={title} className="flex flex-col gap-3 rounded-2xl border border-line bg-raised px-[30px] py-7">
                <h2 className="flex items-center gap-2.5 font-display text-[22px] font-bold">
                  <Icon className={`size-[18px] ${tone}`} /> {title}
                </h2>
                <p className="leading-[1.55] text-muted">{body}</p>
              </div>
            ))}
          </Container>
        </section>

        <section id="switch" className="scroll-mt-20 bg-sand text-dark">
          <Container className="flex flex-col items-center gap-14 py-24 lg:flex-row lg:gap-[72px] lg:py-28">
            <div className="flex w-full flex-1 flex-col gap-7">
              <Eyebrow tone="deep">Switch in an afternoon</Eyebrow>
              <SectionTitle className="text-dark">Bring your {c.name} tables with you.</SectionTitle>
              <ol className="flex flex-col gap-3.5">
                {[c.importNote, "Import it: unknown columns become Meerko columns.", "Ask your agent to enrich, write a sequence and start it."].map((t, i) => (
                  <li key={t} className="flex items-center gap-3.5 text-[17px]">
                    <span className="grid size-[30px] shrink-0 place-items-center rounded-full bg-dark font-mono text-[13px] font-bold text-sand">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <TerminalWindow title="zsh — import" className="w-full lg:w-[560px] lg:shrink-0">
              <pre className="overflow-x-auto px-6 py-[22px] font-mono text-[13.5px] leading-[1.65]">
                <div className="text-fg">$ meerko tables create &quot;Fintech CTOs&quot;</div>
                <div className="text-signal">✓ table tbl_8f2c created</div>
                <div className="text-fg">$ meerko tables import tbl_8f2c {c.name.toLowerCase()}-export.csv</div>
                <div className="text-signal">✓ 1,240 rows · 3 new columns: linkedin, title, funding</div>
                <div className="text-accent">› enrich them and draft a 3-step sequence</div>
              </pre>
            </TerminalWindow>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
