import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { AskAgent, C, Callout, Facts, Fields, H2, L, Tool } from "@/components/docs/ui";

export const metadata = docsMetadata("emails", "Find and verify work emails | Meerko docs");

export default function Page() {
  return (
    <DocsShell
      slug="emails"
      h1="Emails & verification"
      lead={
        <p>
          <Tool name="enrich_rows" /> finds a work email for each lead and checks it&apos;s deliverable, writing the results back into the
          table. You only pay for what it finds.
        </p>
      }
      toc={[
        ["needs", "What a row needs"],
        ["results", "Reading the results"],
        ["sending", "What gets sent to"],
        ["batches", "Batches and cost"],
      ]}
      tools={["enrich_rows"]}
    >
      <H2 id="needs">What a row needs</H2>
      <p>
        A first or last name (<C>first_name</C>, <C>last_name</C>) and the company&apos;s <C>domain</C>, <C>website</C> or, failing
        those, its <C>company</C> name. Rows from <L href="/docs/finding-leads">people search</L> already have all of it. To only verify
        emails you already have, the row needs an <C>email</C>.
      </p>

      <H2 id="results">Reading the results</H2>
      <p>Three columns are added to the table:</p>
      <Fields
        head={["Column", "Holds"]}
        rows={[
          ["email", "The work email found."],
          [
            "email_certainty",
            <>
              How sure the match is: <C>ultra_sure</C>, <C>very_sure</C>, <C>probable</C> (deliverability unconfirmed), or{" "}
              <C>not_found</C> and <C>missing_input</C> when there was nothing to find or not enough to search with.
            </>,
          ],
          ["email_verification", <>The verification result, e.g. <C>ultra_sure</C> or <C>undeliverable</C>.</>],
        ]}
      />
      <p>
        Emails found as <C>ultra_sure</C> or <C>very_sure</C> count as verified already, so they aren&apos;t verified again or charged
        twice.
      </p>

      <H2 id="sending">What gets sent to</H2>
      <Callout>
        <p>
          Enrolling a lead in a sequence skips emails marked <C>undeliverable</C>, but not <C>probable</C> ones. To send only to
          verified addresses, enroll with a filter, e.g. <C>{'{"email_certainty": "ultra_sure"}'}</C>.
        </p>
      </Callout>
      <AskAgent>Find and verify emails for the Fintech CTOs table, then enroll only the very_sure and ultra_sure ones.</AskAgent>

      <H2 id="batches">Batches and cost</H2>
      <Facts
        items={[
          ["Per call", "Up to 50 rows", "25 by default, about 3 seconds a row. It returns how many remain; your agent calls again until 0. The dashboard's Find & verify emails button runs one batch of 25 per click."],
          ["Email found", "8 credits", <>On Meerko Cloud. Misses are free. <L href="/docs/credits">Credits</L>.</>],
          ["Verification", "1 credit", "Only for emails that aren't verified already."],
        ]}
      />
      <p>
        Rows already marked <C>not_found</C> or <C>missing_input</C> are skipped next time unless you ask to overwrite them. A row that hit
        an error is left as it was and retried on the next call. The CLI loops until done with <C>pnpm meerko enrich &lt;tableId&gt; --all</C>.
      </p>
      <p>
        Add your own Firecrawl key (<C>pnpm meerko keys set firecrawl &lt;key&gt;</C>) and email finding tries it when Icypeas misses, at no Meerko credits: see{" "}
        <L href="/docs/credits#firecrawl">Find more emails with Firecrawl</L>.
      </p>
    </DocsShell>
  );
}
