import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { AskAgent, C, Facts, Fields, H2, L, Tool } from "@/components/docs/ui";
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
        ["people-companies", "People and companies"],
        ["filters", "Filters"],
        ["saved", "What gets saved"],
        ["limits", "Limits and cost"],
      ]}
      tools={["find_people", "find_companies", "enrich_rows"]}
    >
      <H2 id="people-companies">People and companies</H2>
      <p>
        <Tool name="find_people" /> searches for people, <Tool name="find_companies" /> for companies. Both run on{" "}
        <L href={docsSources.icypeas.url}>Icypeas</L>&apos;s database and save each result as a row, in an existing table or a new one.
        When the description is mostly about the company (&quot;Series A fintechs in Spain&quot;), search companies first, then pass their{" "}
        <C>company_urn</C> values to <Tool name="find_people" /> to get the people who work there.
      </p>
      <AskAgent>Find heads of growth at fintechs in Spain with 50 to 200 employees. Count them first.</AskAgent>

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
