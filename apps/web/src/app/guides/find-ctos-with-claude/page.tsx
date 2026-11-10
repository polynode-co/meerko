import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import { docsSources } from "@/lib/sources";

// Agent how-to #1 (docs/CONTENT.md, "Agent how-tos"). Every step is a real Meerko tool call: find_people (count_only,
// then save), enrich_rows, query_rows, create_sequence. Credit prices are linked, not quoted, so they can't go stale.
export const metadata: Metadata = {
  title: "How to Find 30 CTOs from Claude, with Verified Emails | Meerko",
  description:
    "Ask Claude for 30 CTOs at software companies in your market and get a table of names, companies and verified work emails, in one chat. The exact prompts, what each step costs and how to check the list.",
  alternates: { canonical: "/guides/find-ctos-with-claude" },
};

const connectors = docsSources.claudeConnectors;
const sources = [connectors];
const Cite = citer(sources);

export default function Page() {
  return (
    <GuideShell
      slug="find-ctos-with-claude"
      eyebrow="Agent how-to · Week 1"
      h1="Find 30 CTOs from Claude"
      description={metadata.description as string}
      lead={
        <p>
          A list of 30 CTOs with verified work emails, built in one Claude chat. You describe who you want; Claude counts them, saves the
          best 30 to a table and finds their emails. About ten minutes, most of it Claude working.
        </p>
      }
      toc={[
        ["before", "Before you start"],
        ["count", "1. Count before you spend"],
        ["save", "2. Save 30"],
        ["emails", "3. Find and verify their emails"],
        ["check", "4. Check the list"],
        ["next", "What to do with it"],
      ]}
      sources={sources}
      cta="docs"
      faq={[
        [
          "How much does it cost?",
          "Counting is free. Each person saved costs 1 credit. Email finding costs credits only when an email is found, plus a small charge to verify the less certain ones; misses are free. The Free plan's 200 credits cover the 30 people and a good share of their emails. Current prices are on the Credits page in the docs.",
        ],
        [
          "Can I do it in ChatGPT instead?",
          "Yes. Meerko is the same connector in ChatGPT, and the prompts work as they are. Connect it from the ChatGPT docs page first.",
        ],
        [
          "What if Claude finds fewer than 30?",
          "That's the count telling you the filters are too narrow. Ask Claude to widen one: more countries, a bigger company size range, or more title variants.",
        ],
      ]}
    >
      <H2 id="before">Before you start</H2>
      <p>
        Add Meerko to Claude as a custom connector and sign in (Claude&apos;s own steps are in its help centre<Cite s={connectors} />;
        ours are in <a href="/docs/claude" className="text-lk-lime hover:underline">Connect Meerko to Claude</a>). A Free Meerko account is
        enough. Then open a new chat.
      </p>

      <H2 id="count">1. Count before you spend</H2>
      <p>
        Say who you want, and ask for a count first. Counting is free, and it tells you whether the filters are too wide or too narrow
        before anything is saved:
      </p>
      <Sample title="Prompt">
        {`Use Meerko to count CTOs at software companies with 11 to 200 employees in Spain and Portugal. Include title variants like "Chief Technology Officer", "Head of Engineering" and "Director de Tecnología". Just the count for now.`}
      </Sample>
      <p>
        Claude turns that into a lead search with the titles, the company size range and the countries, and answers with a number. If it&apos;s
        in the thousands, narrow it (an industry, or one country). If it&apos;s under 30, widen it.
      </p>

      <H2 id="save">2. Save 30</H2>
      <Sample title="Prompt">{`Good. Save the 30 best matches to a new table called "CTOs Iberia".`}</Sample>
      <p>
        Each person becomes a row: first and last name, title, company, company website, size, industry, location and LinkedIn URL. If you
        set your ideal customer profile in Meerko, each row also gets a fit score from 0 to 100, which the next step can use.
      </p>

      <H2 id="emails">3. Find and verify their emails</H2>
      <Sample title="Prompt">{`Find and verify work emails for everyone in "CTOs Iberia". Keep going until every row has been tried.`}</Sample>
      <p>
        Meerko looks up each person&apos;s work email from their name and company domain, then verifies it. Rows come back with the email,
        how certain it is, and whether it&apos;s deliverable. Not every CTO has a findable address; the ones that don&apos;t cost nothing.
      </p>
      <Callout>
        <p>
          Short on credits? Ask Claude to find emails only for the leads with a fit score of 70 or more, so the credits go to the best
          matches first.
        </p>
      </Callout>

      <H2 id="check">4. Check the list</H2>
      <Sample title="Prompt">{`Show me the CTOs in "CTOs Iberia" with a deliverable email, as a short table: name, company, email.`}</Sample>
      <p>
        Skim it before you email anyone: a wrong company match or an outdated title is quicker to drop now than after a bounce. The same
        table is in the Meerko dashboard under Leads, where you can sort it by fit.
      </p>

      <H2 id="next">What to do with it</H2>
      <p>
        From here it&apos;s one more prompt to write a three-step sequence and send it from your own Gmail or Outlook, with replies coming
        back into the same chat. That&apos;s next week&apos;s how-to; the{" "}
        <a href="/guides/cold-email-follow-up" className="text-lk-lime hover:underline">follow-up guide</a> covers the cadence in the
        meantime.
      </p>
    </GuideShell>
  );
}
