import { MessageSquare } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, H2, L, Step } from "@/components/lookout/docs/ui";
import { mcp } from "@/lib/docs";
import { mcpUrl } from "@/lib/meerko";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("chatgpt", "Connect Meerko to ChatGPT | Meerko docs");

export default function Page() {
  const url = mcpUrl();
  return (
    <DocsShell
      slug="chatgpt"
      h1="Connect Meerko to ChatGPT"
      lead={
        <p>
          Add Meerko to ChatGPT as a custom MCP server and run your outbound from a ChatGPT conversation: find leads, send sequences from
          your own inbox and answer replies. No terminal, no API key.
        </p>
      }
      toc={[
        ["add", "Add Meerko"],
        ["sign-in", "Sign in"],
        ["use", "Use it in a conversation"],
        ["manage", "Refresh or disconnect"],
      ]}
    >
      <Step n={1} id="add" title="Add Meerko">
        <ol className="flex list-decimal flex-col gap-1.5 pl-6">
          <li>
            Open <L href="https://chatgpt.com/plugins">ChatGPT Plugins</L>, click <strong className="text-fg">+</strong> and choose{" "}
            <strong className="text-fg">Add custom MCP server</strong>.
          </li>
          <li>
            Name it <C>Meerko</C>, add a short description, and under <strong className="text-fg">Connection</strong> paste this URL:
          </li>
        </ol>
        <CodeBlock title="Server URL" code={url} lines={[{ text: url }]} />
        <ol start={3} className="flex list-decimal flex-col gap-1.5 pl-6">
          <li>Choose OAuth for authentication, read the warning and confirm.</li>
          <li>
            Click <strong className="text-fg">Create as a plugin</strong> and check the tools ChatGPT found ({mcp.tools.length}).
          </li>
        </ol>
        <p>
          Your plan and, on a work account, your workspace&apos;s policies decide whether you can add custom MCP servers; if the option is
          missing, ask your ChatGPT admin (<L href={docsSources.chatgptMcp.url}>OpenAI&apos;s guide</L>).
        </p>
      </Step>

      <Step n={2} id="sign-in" title="Sign in">
        <p>
          ChatGPT sends you to Meerko&apos;s sign-in: continue with Google, check what ChatGPT will be able to do, and click{" "}
          <strong className="text-fg">Allow</strong>. The connection then shows up under{" "}
          <L href="/app/settings">Connections → Connected apps</L> in Meerko.
        </p>
      </Step>

      <Step n={3} id="use" title="Use it in a conversation">
        <p>
          Start a new conversation, type <C>@</C> and pick Meerko, then ask in plain language:
        </p>
        <CodeBlock
          title="ChatGPT"
          lines={[
            { text: "› @Meerko find 20 heads of growth at Series A fintechs in Spain and verify their emails", tone: "accent" },
            { text: "● Meerko · Find people, then Find and verify emails", tone: "muted" },
          ]}
        />
        <Callout icon={MessageSquare}>
          <p>
            Tools that send email or delete data are marked as such, so ChatGPT asks before it runs them: starting a sequence, sending a
            test email, approving a reply draft. Nothing goes out until you confirm. See the{" "}
            <L href="/docs/mcp-tools">MCP tools reference</L>.
          </p>
        </Callout>
        <p>
          First time? Connect the inbox you send from: ask ChatGPT to &quot;connect my Gmail to Meerko&quot; and open the link it gives you,
          or follow <L href="/docs/mailboxes">Mailboxes</L>.
        </p>
      </Step>

      <H2 id="manage">Refresh or disconnect</H2>
      <p>
        When Meerko adds tools, open it in ChatGPT Plugins, click <strong className="text-fg">Refresh</strong> and start a new conversation.
        To disconnect, remove it in ChatGPT Plugins or revoke ChatGPT&apos;s access in Meerko under{" "}
        <L href="/app/settings">Connections → Connected apps</L>.
      </p>
    </DocsShell>
  );
}
