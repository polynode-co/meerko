import { MessageSquare } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, H2, L, Step } from "@/components/lookout/docs/ui";
import { CLAUDE_PLUGIN_SERVER, CLAUDE_PLUGIN_SLASH_COMMANDS } from "@/lib/claude-plugin";
import { mcp } from "@/lib/docs";
import { site } from "@/lib/site";
import { addToClaudeUrl, mcpUrl } from "@/lib/meerko";
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
        ["claude-code-plugin", "Claude Code plugin"],
        ["data", "Data sources and opt-out"],
      ]}
    >
      <Step n={1} id="add" title="Add the connector">
        <p>
          <L href={addToClaudeUrl()}>Connect Claude to Meerko</L>: Claude&apos;s <strong className="text-fg">Add custom connector</strong>{" "}
          form opens with the name and URL filled in. Keep the detected sign-in settings (OAuth) and click{" "}
          <strong className="text-fg">Add</strong>. Or add it by hand:
        </p>
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

      <H2 id="claude-code-plugin">Claude Code plugin</H2>
      <p>
        In Claude Code, Meerko also installs as a plugin: the same server plus its workflows as skills (<C>/meerko:find-leads</C> and the
        others). Type these in Claude Code, then sign in to <C>{CLAUDE_PLUGIN_SERVER}</C> from <C>/mcp</C>:
      </p>
      <CodeBlock
        title="claude"
        code={CLAUDE_PLUGIN_SLASH_COMMANDS.join("\n")}
        lines={CLAUDE_PLUGIN_SLASH_COMMANDS.map((text) => ({ text: `› ${text}`, tone: "accent" as const }))}
      />
      <p>
        Prefer one command? <C>claude mcp add --transport http --scope user meerko {url}</C> adds just the server. Both are in the{" "}
        <L href="/docs/claude-code#plugin">Claude Code setup</L>.
      </p>

      {/* The Claude Directory's policy check asks for this (polynode-co/meerko#92); the plugin README and /privacy#recipients say the same. */}
      <H2 id="data">Data sources, legal basis and opt-out</H2>
      <p>
        Meerko returns named people&apos;s work emails and, when asked, phone numbers, so here is where they come from and how a person
        opts out. The same facts are in the <L href="/privacy#recipients">privacy policy</L>.
      </p>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        <li>
          <strong className="text-fg">Sources.</strong> Lead search and email finding run on{" "}
          <L href={docsSources.icypeas.url}>Icypeas</L>, a B2B data provider. Emails it misses, and phone numbers, come from{" "}
          <L href={docsSources.generectPrivacy.url}>Generect</L>, which draws on public professional profiles, company websites and
          licensed data providers. A workspace can add its own Firecrawl key for one more email search. Users can also import their own
          leads (a CSV, say). Meerko keeps no database of people of its own: it stores only the leads a user&apos;s searches and imports
          put into their workspace, until they delete them or close their account.
        </li>
        <li>
          <strong className="text-fg">Legal basis.</strong> The Meerko user who holds the leads, and sends the emails, is the controller
          of that data; on Meerko Cloud, Polynode Technologies, S.L. processes it on their instructions. B2B prospecting relies on the
          sender&apos;s legitimate interest (GDPR Art. 6(1)(f)), and a person can object to it at any time (Art. 21).
        </li>
        <li>
          <strong className="text-fg">If you&apos;re listed.</strong> To be removed at the source, use{" "}
          <L href={docsSources.icypeasOptOut.url}>Icypeas&apos;s opt-out form</L> and email Generect as its{" "}
          <L href={docsSources.generectPrivacy.url}>privacy policy</L> says (subject &quot;Remove my data&quot;). To ask a Meerko user
          about the data they hold on you, contact them, or write to <L href={`mailto:${site.contactEmail}`}>{site.contactEmail}</L> and
          we&apos;ll pass your request on.
        </li>
        <li>
          <strong className="text-fg">If you got an email sent through Meerko.</strong> Every sequence email ends with an unsubscribe
          link and carries a one-click <C>List-Unsubscribe</C> header. Either one puts your address on the sending workspace&apos;s
          do-not-email list: its sequences to you stop at once, and from any of its mailboxes it can&apos;t put you in another sequence or
          send you a reply. Replying stops that workspace&apos;s sequences to you, and a short opt-out reply (&quot;unsubscribe&quot;,
          &quot;remove me&quot;, in English, Spanish, French or German) also puts you on the list.
        </li>
      </ul>
    </DocsShell>
  );
}
