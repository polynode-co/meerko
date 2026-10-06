import { ChevronRight, CircleSlash, MailX, Reply, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { AskAgent, C, Callout, Cards, Facts, Fields, H2, IconList, L, Tool } from "@/components/docs/ui";

export const metadata = docsMetadata("sequences", "Cold email sequences from Gmail, run by your agent | Meerko docs");

const lifecycle: [string, string][] = [
  ["Draft", "create_sequence"],
  ["Preview", "preview_sequence"],
  ["Enroll", "enroll_rows"],
  ["Start", "start_sequence"],
  ["Pause", "pause_sequence"],
];

const steps = [
  "[",
  '  { "subject": "Quick question, {{first_name}}",',
  '    "body": "Hi {{first_name}}, ..." },',
  '  { "delay_days": 3, "body": "One thing I left out: ..." },',
  '  { "delay_days": 4, "body": "I\'ll stop here so I don\'t crowd your inbox." }',
  "]",
];

export default function Page() {
  return (
    <DocsShell
      slug="sequences"
      lead={
        <p>
          A sequence is a series of emails sent from one of your connected Gmail mailboxes to the rows of a table. Step 1 starts the
          thread; each follow-up replies in that same thread, a few days later.
        </p>
      }
      toc={[
        ["lifecycle", "Lifecycle"],
        ["steps", "Steps"],
        ["when", "When emails go out"],
        ["skipped", "Who gets skipped"],
        ["stops", "When it stops for a lead"],
        ["ask", "Ask your agent"],
      ]}
      tools={["create_sequence", "update_sequence", "preview_sequence", "enroll_rows", "start_sequence", "pause_sequence", "list_sequences", "sequence_stats"]}
    >
      <Callout icon={ShieldCheck}>
        <p>
          Nothing is sent until the sequence is started. Your agent shows you a preview and the enrollment counts first, and starts only
          after you approve.
        </p>
      </Callout>

      <H2 id="lifecycle">Lifecycle</H2>
      <p>
        Every sequence moves through the same five steps. Each one is a single MCP tool, so you can drive it by asking your agent or call
        the tools yourself.
      </p>
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {lifecycle.map(([stage, tool], i) => (
          <li key={stage} className="flex items-center gap-2 sm:flex-1">
            <a
              href={`/docs/mcp-tools#${tool}`}
              className={`flex flex-1 flex-col gap-1.5 rounded-[10px] border p-3.5 ${i === 3 ? "border-accent/35 bg-accent-soft" : "border-line bg-raised hover:border-muted"}`}
            >
              <span className={`font-mono text-[11px] ${i === 3 ? "text-accent" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
              <span className="font-semibold text-fg">{stage}</span>
              <span className={`font-mono text-[11.5px] ${i === 3 ? "text-accent" : ""}`}>{tool}</span>
            </a>
            {i < lifecycle.length - 1 && <ChevronRight className="hidden size-3.5 shrink-0 sm:block" />}
          </li>
        ))}
      </ol>
      <p>
        Once started, <Tool name="sequence_stats" /> shows emails sent, the reply rate and where every lead is. Pause before changing
        the steps of a running sequence.
      </p>

      <H2 id="steps">Steps</H2>
      <p>
        A sequence has 1 to 10 steps. Bodies are plain text, and any <C>{"{{column_key}}"}</C> is filled in from the lead&apos;s row (
        <L href="/docs/tables#variables">columns as variables</L>).
      </p>
      <Fields
        head={["Field", "What it does"]}
        rows={[
          ["subject", "Only on step 1, where it's required. Follow-ups reply in the same thread as “Re: ” plus that subject."],
          ["body", <>Plain text with variables, e.g. <C>{"{{first_name}}"}</C>. An unsubscribe line is added automatically.</>],
          ["delay_days", "Days after the previous step, 0 to 60. Defaults to 3."],
        ]}
      />
      <CodeBlock title="steps.json" lines={steps.map((text) => ({ text }))} code={steps.join("\n")} />

      <H2 id="when">When emails go out</H2>
      <Facts
        items={[
          ["Send window", "9:00–17:00", <>Monday to Friday, in the recipients&apos; timezone. Set window_start_hour and window_end_hour.</>],
          ["Timezone", "Europe/Madrid", "The default. Pass any IANA timezone, e.g. America/New_York."],
          ["Daily limit", "Per mailbox", <>Each mailbox&apos;s own limit and spacing apply. <L href="/docs/mailboxes#limits">Mailboxes</L>.</>],
        ]}
      />
      <p>
        Emails due outside the window wait for the next opening and go out spread over its first half hour. Every email carries an
        unsubscribe link and Gmail&apos;s one-click unsubscribe header.
      </p>

      <H2 id="skipped">Who gets skipped</H2>
      <p>Enrolling never sends anything. <Tool name="enroll_rows" /> skips, and counts, any row that has:</p>
      <IconList
        icon={CircleSlash}
        items={[
          "No email",
          <>An email marked <C>undeliverable</C> (<L href="/docs/emails#sending">what about probable ones?</L>)</>,
          "An address that unsubscribed or bounced before",
          "A variable the steps use but the row doesn't have",
          "Already been enrolled",
        ]}
      />

      <H2 id="stops">When it stops for a lead</H2>
      <Cards
        items={[
          [Reply, "They reply", <>Every sequence stops for that address, the reply lands in <L href="/docs/replies">Replies</L> and the lead moves to the replied stage.</>],
          [MailX, "They unsubscribe or bounce", "Every sequence in your workspace stops for that address, and it's skipped from then on."],
        ]}
      />
      <p>Out-of-office replies are recorded but don&apos;t stop the sequence.</p>

      <H2 id="ask">Ask your agent</H2>
      <AskAgent>
        Write a 3-step sequence for the Fintech CTOs table from my main mailbox, show me the preview for the first lead, then enroll everyone with a verified email.
      </AskAgent>
      <p>
        Or use <C>/mcp__meerko__write-sequence</C>, which drafts the steps and shows you previews without enrolling anyone.
      </p>
    </DocsShell>
  );
}
