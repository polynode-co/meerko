import type { Metadata } from "next";
import { citer, GuideShell, H2 } from "@/components/lookout/docs/guide";
import { gtmSources as S } from "@/lib/sources";

// Targets "gtm engineer" (3.6k/mo, +86% YoY), "what is a gtm engineer" (480, KD 4), "gtm engineer salary" (260, KD 1)
// and "gtm engineer meaning" (210) (DataForSEO, US, Oct 2026). Every fact cites a source in lib/sources.ts.
export const metadata: Metadata = {
  title: "What Is a GTM Engineer? Role, Skills, Tools & Salary (2026)",
  description:
    "A GTM engineer builds the automated systems that find, enrich and reach customers. What the role does, skills, tools, salary and how to become one.",
  alternates: { canonical: "/guides/gtm-engineer" },
};

const sources = [S.clay, S.apollo, S.cargo];
const Cite = citer(sources);

// Answers are plain text so they can feed FAQPage markup too.
const faq: [string, string][] = [
  ["What does GTM stand for?", "Go-to-market: everything a company does to reach and win customers, from finding leads to closing deals."],
  [
    "How much does a GTM engineer make?",
    "Cargo's analysis of 509 US job postings that disclosed pay (April to July 2026) put the median at $159,000, with the middle half between $135,000 and $190,000.",
  ],
  [
    "Do GTM engineers need to code?",
    "Usually some. Apollo lists APIs, SQL and Python or JavaScript as core skills, and Clay looks for familiarity with tools like n8n and Zapier or languages like TypeScript, Python and SQL.",
  ],
  [
    "How is a GTM engineer different from RevOps?",
    "In Apollo's words: a GTM engineer builds the system; RevOps maintains and governs it.",
  ],
];

export default function Page() {
  return (
    <GuideShell
      slug="gtm-engineer"
      eyebrow="Guide · GTM engineering"
      h1="What is a GTM engineer?"
      description={metadata.description as string}
      lead={
            <p>
              A GTM engineer builds the automated systems that find, enrich and reach a company&apos;s customers: lead data
              pipelines, enrichment, outbound sequences and the routing that gets replies to the right person. Clay describes the
              role as building &quot;automated revenue systems using AI, data enrichment, and workflow automation.&quot;
              <Cite s={S.clay} />
            </p>
      }
      toc={[
        ["what", "What does GTM stand for?"],
        ["does", "What does a GTM engineer do?"],
        ["vs", "GTM engineer vs RevOps vs SDR"],
        ["skills", "Skills"],
        ["tools", "Tools"],
        ["salary", "Salary"],
        ["become", "How to become one"],
        ["origin", "Where the term came from"],
      ]}
      sources={sources}
      faq={faq}
    >
            <H2 id="what">What does GTM stand for?</H2>
            <p>
              GTM means <strong className="text-fg">go-to-market</strong>: everything a company does to reach and win customers. A
              GTM engineer is the person who turns that work into software instead of manual effort.
            </p>

            <H2 id="does">What does a GTM engineer do?</H2>
            <p>The work spans sales, marketing and operations. Examples from Clay&apos;s guide:<Cite s={S.clay} /></p>
            <ul className="flex list-disc flex-col gap-1.5 pl-6">
              <li>Automate manual seller work, such as account research.</li>
              <li>Update the CRM automatically from call transcripts.</li>
              <li>Monitor complaints against competitors.</li>
              <li>Analyze support tickets to predict churn.</li>
            </ul>
            <p>
              In outbound, that usually means a pipeline: build a lead list from an ideal customer profile, enrich it with verified
              emails, send personalized sequences, and route replies.
            </p>

            <H2 id="vs">GTM engineer vs RevOps vs SDR</H2>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-normal">Role</th>
                    <th className="px-5 py-3 font-normal">Focus</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["GTM engineer", "Designs and builds the system (project-based, weeks).", S.apollo],
                    ["RevOps", "Maintains and governs it (ongoing, monthly or quarterly).", S.apollo],
                    ["SDR", "Works the leads the system produces: outreach, follow-up, booking meetings.", null],
                  ].map(([role, focus, src]) => (
                    <tr key={role as string} className="border-t border-line">
                      <th scope="row" className="px-5 py-3.5 font-semibold text-fg">{role as string}</th>
                      <td className="px-5 py-3.5">
                        {focus as string}
                        {src && <Cite s={src as typeof S.apollo} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Apollo puts it in one line: &quot;A GTM Engineer builds the system; RevOps maintains and governs it.&quot;
              <Cite s={S.apollo} />
            </p>

            <H2 id="skills">Skills</H2>
            <p>Apollo lists these as core technical skills:<Cite s={S.apollo} /></p>
            <ul className="flex list-disc flex-col gap-1.5 pl-6">
              <li>APIs and webhooks, plus SQL and Python or JavaScript for light applications.</li>
              <li>Workflow automation and prompt engineering.</li>
              <li>Email deliverability.</li>
              <li>ICP and TAM design, scoring models and signal-based selling.</li>
            </ul>
            <p>
              Clay looks for technical fluency, commercial bias, curiosity and an experimental mindset.<Cite s={S.clay} />
            </p>

            <H2 id="tools">Tools GTM engineers use</H2>
            <p>
              Clay names tools like Clay, n8n, Zapier, Lovable and Bolt, and languages like TypeScript, Python and SQL.
              <Cite s={S.clay} /> A typical outbound stack covers four jobs:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-6">
              <li><strong className="text-fg">Data and enrichment:</strong> lead search and verified emails.</li>
              <li><strong className="text-fg">Sending:</strong> sequences from real mailboxes, with deliverability controls.</li>
              <li><strong className="text-fg">CRM or pipeline:</strong> where replies and deals are tracked.</li>
              <li><strong className="text-fg">Glue:</strong> automation tools, scripts, and increasingly coding agents like Claude Code and Cursor.</li>
            </ul>

            <H2 id="salary">GTM engineer salary</H2>
            <p>
              Cargo analyzed 509 US job postings that disclosed pay, from April to July 2026. The median was{" "}
              <strong className="text-fg">$159,000</strong>; the middle half earned between $135,000 and $190,000, and the full range
              ran from about $65,000 to $410,000.<Cite s={S.cargo} /> Only about a quarter of the postings stated pay at all.
              <Cite s={S.cargo} />
            </p>

            <H2 id="become">How to become a GTM engineer</H2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-6">
              <li>Learn enough SQL and HTTP APIs to move data between tools.</li>
              <li>
                Build one outbound pipeline end to end: a lead list, enrichment, a sequence with{" "}
                <a href="/guides/cold-email-follow-up" className="text-accent hover:underline">follow-ups</a> and reply handling.
              </li>
              <li>Learn email deliverability: mailbox limits, send windows and unsubscribes.</li>
              <li>
                Use a coding agent to build and run the pieces faster (see{" "}
                <a href="/guides/claude-code-for-sales" className="text-accent hover:underline">Claude Code for sales</a>), and show
                the result as a portfolio.
              </li>
            </ol>

            <H2 id="origin">Where the term came from</H2>
            <p>
              Clay says it coined the role in 2023, and that about 100 GTM engineer job listings now go live every month.
              <Cite s={S.clay} />
            </p>

    </GuideShell>
  );
}
