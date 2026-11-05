import { MessageSquare } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, H2, L, Step } from "@/components/lookout/docs/ui";
import { mcp } from "@/lib/docs";
import { mcpUrl } from "@/lib/meerko";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("claude", "Connect Meerko to Claude (web, desktop and mobile) | Meerko docs");

export default function Page() {
  const url = mcpUrl();
  return (
    <DocsShell
      slug="claude"
      h1="Connect Meerko to Claude"
      lead={
        <p>
          Add Meerko to Claude as a connector and run your outbound from a normal Claude chat: find leads, write and send sequences from
          your own inbox, and answer replies. Works in Claude on the web and the desktop app, and the connection follows you to the mobile
          apps. No terminal, no API key.
        </p>
      }
      toc={[
        ["add", "Add the connector"],
        ["sign-in", "Sign in"],
        ["use", "Use it in a chat"],
        ["teams", "Team and Enterprise"],
        ["manage", "Disconnect"],
      ]}
    >
      <Step n={1} id="add" title="Add the connector">
        <ol className="flex list-decimal flex-col gap-1.5 pl-6">
          <li>
            In Claude, open <strong className="text-fg">Customize → Connectors</strong>.
          </li>
          <li>
            Click <strong className="text-fg">+ Add</strong>, then <strong className="text-fg">Add custom connector</strong>.
          </li>
          <li>
            Name it <C>Meerko</C> and paste this URL, then click <strong className="text-fg">Continue</strong>:
          </li>
        </ol>
        <CodeBlock title="Remote MCP server URL" code={url} lines={[{ text: url }]} />
        <p>
          Keep the detected sign-in settings (OAuth) and click <strong className="text-fg">Add</strong>. Free Claude plans can add one custom
          connector; paid plans can add more (<L href={docsSources.claudeConnectors.url}>Claude&apos;s help article</L>).
        </p>
      </Step>

      <Step n={2} id="sign-in" title="Sign in">
        <p>
          Claude sends you to Meerko&apos;s sign-in: continue with Google, check what Claude will be able to do, and click{" "}
          <strong className="text-fg">Allow</strong>. Claude keeps the sign-in and renews it on its own. The connection then shows up under{" "}
          <L href="/app/settings">Connections → Connected apps</L> in Meerko.
        </p>
      </Step>

      <Step n={3} id="use" title="Use it in a chat">
        <p>
          In a chat, click <strong className="text-fg">+</strong> at the bottom left, open <strong className="text-fg">Connectors</strong>{" "}
          and make sure Meerko is on. Then ask in plain language:
        </p>
        <CodeBlock
          title="Claude"
          lines={[
            { text: "› Find 20 heads of growth at Series A fintechs in Spain and verify their emails", tone: "accent" },
            { text: "● Meerko · Find people, then Find and verify emails", tone: "muted" },
          ]}
        />
        <Callout icon={MessageSquare}>
          <p>
            Claude asks before it runs anything that sends email or deletes data: starting a sequence, sending a test email, approving a
            reply draft. Nothing goes out until you say yes. Every tool and what it does is in the{" "}
            <L href="/docs/mcp-tools">MCP tools reference</L> ({mcp.tools.length} tools).
          </p>
        </Callout>
        <p>
          First time? Connect the inbox you send from: ask Claude to &quot;connect my Gmail to Meerko&quot; and open the link it gives you,
          or follow <L href="/docs/mailboxes">Mailboxes</L>.
        </p>
      </Step>

      <H2 id="teams">Team and Enterprise</H2>
      <p>
        On Team and Enterprise plans an owner adds the connector once, under <strong className="text-fg">Organization settings → Connectors</strong>{" "}
        with the same URL. Each member then finds it under <strong className="text-fg">Customize → Connectors</strong> and clicks{" "}
        <strong className="text-fg">Connect</strong> to sign in with their own Meerko account.
      </p>

      <H2 id="manage">Disconnect</H2>
      <p>
        Turn Meerko off for one chat from the <strong className="text-fg">+ → Connectors</strong> menu, remove it under{" "}
        <strong className="text-fg">Customize → Connectors</strong>, or revoke Claude&apos;s access in Meerko under{" "}
        <L href="/app/settings">Connections → Connected apps</L>. Using Claude Code instead? See <L href="/docs/claude-code">Claude Code</L>.
      </p>
    </DocsShell>
  );
}
