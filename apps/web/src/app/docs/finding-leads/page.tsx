import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { AskAgent, C, Facts, Fields, H2, L, Tool } from "@/components/lookout/docs/ui";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("finding-leads", "Find B2B leads from your coding agent | Meerko docs");

export default function Page() {
  return (
    <DocsShell
      slug="finding-leads"
      h1="Finding leads"
      lead={
        <p>
          Describe who you sell to and your agent turns it into a search: people by title, company, location and more, or companies by
          industry, size and growth. Results land in a table, ready for <L href="/docs/emails">email finding</L>.
        </p>
      }
      toc={[
        ["first-customers", "Start from your website"],
        ["fit", "Fit scores"],
        ["people-companies", "People and companies"],
        ["dashboard", "In the dashboard"],
        ["filters", "Filters"],
        ["saved", "What gets saved"],
        ["limits", "Limits and cost"],
      ]}
      tools={["read_website", "get_icp", "set_icp", "review_icp_fit", "find_people", "find_companies", "enrich_rows"]}
    >
      <H2 id="first-customers">Start from your website</H2>
      <p>
        Not sure how to describe who you sell to? Give your agent your website. <Tool name="read_website" /> reads your home page (Meerko
        runs no AI of its own), your agent works out your customers from it and tells you, and once you agree it saves 10 matching
        companies and a decision-maker at each. That costs about 20 credits; emails come later, for the ones you pick. In agents that
        support prompts, it&apos;s the <C>first-customers</C> prompt; in the dashboard, <L href="/app/welcome">Welcome</L> walks you
        through it.
      </p>
      <AskAgent>Use Meerko to find my first customers. My website is acme.com.</AskAgent>

      <H2 id="fit">Fit scores</H2>
      <p>
        Tell Meerko who you sell to, your ideal customer profile (ICP), and every lead in every table gets a fit score from 0 to 100. Set
        it in <L href="/app/settings#icp">Settings → Ideal customer</L>, or let your agent save it with <Tool name="set_icp" /> after
        reading your website. The score is plain rules, so it&apos;s instant and free: industry 30, job title 25, company size 20,
        country 15 and keywords 10, counting only what your ICP sets and the lead has; anything you rule out caps a lead at 10. Hover a
        score to see why.
      </p>
      <p>
        Rules can&apos;t tell a denim factory from a fashion brand, so your agent can move a score by up to 30 points with a one-line
        reason (<Tool name="review_icp_fit" />). Then spend credits where they count: Find &amp; verify emails offers <strong className="text-fg">Fit 70+ only</strong>,
        and agents pass <C>min_icp_score</C> to <Tool name="enrich_rows" />.
      </p>
      <AskAgent>Score the leads in my &quot;First customers&quot; table against my ICP, fix any score that looks wrong, then find emails for the ones at 70 or more.</AskAgent>

      <H2 id="people-companies">People and companies</H2>
      <p>
        <Tool name="find_people" /> searches for people, <Tool name="find_companies" /> for companies. Both run on{" "}
        <L href={docsSources.icypeas.url}>Icypeas</L>&apos;s database and save each result as a row, in an existing table or a new one.
        When the description is mostly about the company (&quot;Series A fintechs in Spain&quot;), search companies first, then pass their{" "}
        <C>company_urn</C> values to <Tool name="find_people" /> to get the people who work there.
      </p>
      <AskAgent>Find heads of growth at fintechs in Spain with 50 to 200 employees. Count them first.</AskAgent>

      <H2 id="dashboard">In the dashboard</H2>
      <p>
        The same search is on <L href="/app/leads/find">Leads → Find leads</L>. Pick People or Companies, fill in the filters (job titles
        and titles to exclude, location, industry, keywords and headcount), then press <strong className="text-fg">Count matches</strong> to
        see how many there are, for free. When the count looks right, set how many to save (up to 1,000), choose a table or name a new
        one, and press <strong className="text-fg">Find and add</strong>. The rows land in the table, ready for{" "}
        <strong className="text-fg">Find &amp; verify emails</strong>.
      </p>

      <H2 id="filters">Filters</H2>
      <p>
        Text filters take a list to include and a list to exclude; numbers take a range. Countries are two-letter codes, like{" "}
        <C>ES</C>.
      </p>
      <Fields
        head={["Search", "Filters"]}
        rows={[
          [
            "people",
            "Current and past job title, name, location, keyword, skills, languages, school; current company name, website, industry, location and keyword; company headcount and revenue ranges; years of experience; headcount growth over 6, 12 or 24 months.",
          ],
          ["companies", "Name, industry, location, keyword, domain, type; headcount and revenue (USD) ranges; headcount growth."],
        ]}
      />

      <H2 id="saved">What gets saved</H2>
      <Fields
        head={["Search", "Columns"]}
        rows={[
          ["people", "first_name, last_name, title, company, domain, company_size, industry, location, linkedin_url, company_linkedin_url"],
          ["companies", "company, domain, industry, employees, location, founded_year, description, linkedin_url, company_urn"],
        ]}
      />
      <p>Domains are saved bare (no https:// or www.), ready for email finding.</p>

      <H2 id="limits">Limits and cost</H2>
      <Facts
        items={[
          ["Per call", "Up to 1,000", "Results per search. 25 if you don't say."],
          ["Count first", "Free", <>Pass <C>count_only</C> to see how many match before saving any.</>],
          ["Meerko Cloud", "1 credit", <>Per result saved. With fewer credits, the search saves as many as you can pay for. <L href="/docs/credits">Credits</L>.</>],
        ]}
      />
      <p>
        Self-hosted, searches run on your own Icypeas key, and Meerko charges nothing: see{" "}
        <L href="/docs/self-hosting#search">Turn on lead search</L>.
      </p>
    </DocsShell>
  );
}
