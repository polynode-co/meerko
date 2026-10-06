import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { AskAgent, C, Facts, Fields, H2, L, Tool } from "@/components/docs/ui";

export const metadata = docsMetadata("tables");

export default function Page() {
  return (
    <DocsShell
      slug="tables"
      h1="Tables & AI columns"
      lead={
        <p>
          A table is a list of leads: one row per person or company, one column per field. Columns appear as you add data, and an AI
          column is a question your agent answers for every row.
        </p>
      }
      toc={[
        ["rows-columns", "Rows and columns"],
        ["import", "Importing"],
        ["ai-columns", "AI columns"],
        ["variables", "Columns as variables"],
        ["querying", "Reading rows"],
      ]}
      tools={["list_tables", "create_table", "add_column", "get_pending_cells", "update_rows", "import_rows", "query_rows"]}
    >
      <H2 id="rows-columns">Rows and columns</H2>
      <p>
        Rows are stored as they come: any field you send becomes a column. Column keys are lowercase snake_case, so a CSV header
        &quot;First Name&quot; becomes the key <C>first_name</C> and keeps &quot;First Name&quot; as its label. Each column has a type, inferred
        from the values when it&apos;s created:
      </p>
      <Fields
        head={["Type", "Values"]}
        rows={[
          ["text", "Anything. Also the type of a column that's empty so far."],
          ["number", "Numbers, e.g. headcount."],
          ["email", "Email addresses."],
          ["url", "Links, e.g. LinkedIn profiles."],
          ["boolean", "true or false."],
          ["json", "Objects and lists."],
        ]}
      />
      <p>
        Every row also has a pipeline stage, starting at <C>new</C>: see <L href="/docs/pipeline">Pipeline</L>.
      </p>

      <H2 id="import">Importing</H2>
      <p>
        <Tool name="import_rows" /> takes up to 10,000 rows per call; unknown keys become new columns. From the terminal, the CLI reads
        a CSV with a header row or a JSON array:
      </p>
      <CodeBlock title="bash" code={'pnpm meerko tables create "Fintech CTOs Spain"\npnpm meerko tables import <tableId> leads.csv'} lines={[{ text: '$ pnpm meerko tables create "Fintech CTOs Spain"' }, { text: "$ pnpm meerko tables import <tableId> leads.csv" }]} />
      <p>
        Or skip the CSV and <L href="/docs/finding-leads">search for leads</L> straight into a table.
      </p>

      <H2 id="ai-columns">AI columns</H2>
      <p>
        An AI column has a prompt: an instruction with <C>{"{{column_key}}"}</C> placeholders, like <C>{"Score ICP fit 1-5 for {{company}}: {{description}}"}</C>.
        Meerko doesn&apos;t run the prompt itself. Your agent does, with its own model and reasoning, so there are no AI credits to buy:
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          <Tool name="add_column" /> creates the column with its prompt.
        </li>
        <li>
          <Tool name="get_pending_cells" /> returns rows where that column is still empty (25 by default, up to 200), each with the
          prompt already filled in from the row.
        </li>
        <li>
          Your agent answers each one and writes the answers back with <Tool name="update_rows" /> (up to 1,000 rows per call). It
          writes <C>N/A</C> when it can&apos;t answer, so the row isn&apos;t returned again.
        </li>
      </ol>
      <AskAgent>Add a column &quot;opener&quot; to the Fintech CTOs table: a one-line, specific opener for each lead. Fill it for every row.</AskAgent>

      <H2 id="variables">Columns as variables</H2>
      <p>
        Any column can be used in a sequence as <C>{"{{column_key}}"}</C>, e.g. <C>{"{{first_name}}"}</C> or the <C>{"{{opener}}"}</C>{" "}
        your agent just wrote. Use the key, not the label. A lead whose row is missing a variable the sequence uses is skipped when
        you enroll, so nobody gets an email with a gap in it.
      </p>

      <H2 id="querying">Reading rows</H2>
      <Facts
        items={[
          ["Filter", "Exact match", <>e.g. <C>{'{"country": "ES"}'}</C>, plus a pipeline stage.</>],
          ["Page size", "50", "By default, up to 1,000 per call, with an offset to page through."],
          ["Order", "As added", "Rows come back in the order they were inserted."],
        ]}
      />
    </DocsShell>
  );
}
