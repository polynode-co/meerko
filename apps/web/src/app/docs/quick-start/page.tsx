import { Server } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { AskAgent, C, Callout, L, Step } from "@/components/lookout/docs/ui";
import { mcpUrl } from "@/lib/meerko";

export const metadata = docsMetadata("quick-start", "Meerko Cloud quick start | Meerko docs");

export default function Page() {
  const add = `claude mcp add --transport http --scope user meerko ${mcpUrl()}`;
  return (
    <DocsShell
      slug="quick-start"
      h1="Quick start on Meerko Cloud"
      lead={<p>From sign-in to your first lead list, run from your agent. Meerko Cloud hosts the API, the database, the MCP server and the sending for you.</p>}
      toc={[
        ["sign-in", "Sign in"],
        ["gmail", "Connect your mailbox"],
        ["agent", "Connect your agent"],
        ["first-list", "Build your first list"],
      ]}
    >
      <Callout icon={Server}>
        <p>
          Rather run it yourself? <L href="/docs/self-hosting">Self-host Meerko</L>: it&apos;s the same code, free under AGPL-3.0.
        </p>
      </Callout>

      <Step n={1} id="sign-in" title="Sign in">
        <p>
          Open <L href="/login">Sign in</L> and continue with Google, or get a sign-in link by email: the first sign-in creates your workspace. New
          workspaces start with 200 free credits: see <L href="/docs/credits">Credits</L> for what they pay for.
        </p>
      </Step>

      <Step n={2} id="gmail" title="Connect your mailbox">
        <p>
          In the dashboard, open <L href="/app/settings">Connections</L> and click <strong className="text-fg">Connect mailbox</strong>.
          Pick your provider (Gmail, Zoho, Fastmail or any IMAP/SMTP server), create an app password for the inbox you send from and
          paste it in: the form links to each step, and <L href="/docs/mailboxes#connect">Mailboxes</L> explains them. New mailboxes start at 10 emails a day and ramp up to their
          limit (50 by default) over 21 days; <L href="/docs/mailboxes#ramp">Mailboxes</L> explains how to change that.
        </p>
      </Step>

      <Step n={3} id="agent" title="Connect your agent">
        <p>Add Meerko to Claude Code with one command:</p>
        <CodeBlock title="bash" code={add} lines={[{ text: `$ ${add}` }]} />
        <p>
          Then run <C>/mcp</C> in Claude Code, pick <C>meerko</C> and sign in: your browser opens, you continue with Google and click{" "}
          <strong className="text-fg">Allow</strong>. Working in a chat app instead? See <L href="/docs/claude">Claude</L> and <L href="/docs/chatgpt">ChatGPT</L>. Another agent? See{" "}
          <L href="/docs/codex-cursor">Codex & Cursor</L> and{" "}
          <L href="/docs/mcp-clients">other clients</L>.
        </p>
      </Step>

      <Step n={4} id="first-list" title="Build your first list">
        <p>
          Ask in plain language, or use a Meerko command. Searching and finding emails use credits; your agent checks the balance first
          and asks before spending more than 500.
        </p>
        <AskAgent>/mcp__meerko__find-leads heads of growth at Series A fintechs in Spain</AskAgent>
        <p>
          Then write a sequence for that table with <C>/mcp__meerko__write-sequence</C>. Nothing is sent until you&apos;ve seen the
          preview and said yes: <L href="/docs/sequences">how sequences work</L>.
        </p>
      </Step>
    </DocsShell>
  );
}
