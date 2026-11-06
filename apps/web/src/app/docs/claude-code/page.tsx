import { Sparkles } from "lucide-react";
import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, H2, H3, L, Step } from "@/components/lookout/docs/ui";
import { mcp } from "@/lib/docs";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";
import { docsSources } from "@/lib/sources";

// Targets "mcp servers for claude code" (140/mo) and the long tail around it (DataForSEO, Oct 2026).
export const metadata = docsMetadata("claude-code", "Meerko MCP server for Claude Code: setup guide");

const sh = (title: string, cmds: string[]) => (
  <CodeBlock title={title} code={cmds.join("\n")} lines={cmds.map((t, i) => ({ text: i === 0 ? `$ ${t}` : t }))} />
);

export default function Page() {
  const url = mcpUrl();
  return (
    <DocsShell
      slug="claude-code"
      h1="Add the Meerko MCP server to Claude Code"
      lead={
        <p>
          Meerko runs as a hosted MCP server, so Claude Code gets the same tools you do: search and enrich leads, run sequences from your
          Gmail and work the replies. One command, then you sign in with your browser. No API key, nothing to install.
        </p>
      }
      toc={[
        ["add", "Add the server"],
        ["sign-in", "Sign in"],
        ["commands", "Try a command"],
        ["manage", "Check, sign out, remove"],
        ["other-ways", "Other ways to connect"],
      ]}
    >
      <Callout icon={Sparkles}>
        <p>
          Fastest way: click <strong>Copy setup prompt</strong> on the <L href="/#product">homepage</L> and paste it into Claude Code. It
          runs these steps for you.
        </p>
      </Callout>

      <Step n={1} id="add" title="Add the server">
        {sh("bash", [`claude mcp add --transport http --scope user meerko ${url}`])}
        <p>
          <C>--scope user</C> makes Meerko available in every project, not just this one (
          <L href={docsSources.claudeCodeMcp.url}>Claude Code&apos;s MCP docs</L>).
        </p>
      </Step>

      <Step n={2} id="sign-in" title="Sign in">
        <p>
          In Claude Code, run <C>/mcp</C>, pick <C>meerko</C> and choose to authenticate. Your browser opens Meerko&apos;s sign-in: continue
          with Google, check what Claude Code will be able to do, and click <strong className="text-fg">Allow</strong>. Claude Code stores
          the sign-in and renews it on its own.
        </p>
        <p>
          The app then shows up under <L href="/app/settings">Connections → Connected apps</L>, where you can disconnect it at any time.
        </p>
      </Step>

      <Step n={3} id="commands" title="Try a command">
        <p>
          Ask in plain language, or use a Meerko command. Claude Code lists MCP prompts as <C>/mcp__meerko__…</C>. Anything that emails
          someone waits for your OK.
        </p>
        <CodeBlock
          title="claude"
          lines={[
            { text: "› /mcp__meerko__find-leads heads of growth at Series A fintechs in Spain", tone: "accent" },
            { text: "● meerko · find_people, then enrich_rows", tone: "muted" },
          ]}
        />
        <dl className="flex flex-col">
          {mcp.prompts.map((p) => (
            <div key={p.name} className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:gap-6">
              <dt className="font-mono text-sm text-accent sm:w-56 sm:shrink-0">/mcp__meerko__{p.name}</dt>
              <dd className="text-[15px]">{p.description}</dd>
            </div>
          ))}
        </dl>
      </Step>

      <H2 id="manage">Check, sign out, remove</H2>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        <li>
          <C>/mcp</C> shows whether <C>meerko</C> is connected, with its {mcp.tools.length} tools. Every tool is described in the{" "}
          <L href="/docs/mcp-tools">MCP tools reference</L>.
        </li>
        <li>
          To sign out, choose <strong className="text-fg">Clear authentication</strong> for <C>meerko</C> in <C>/mcp</C>, or disconnect
          Claude Code in Connections.
        </li>
        <li>
          To remove it: <C>claude mcp remove meerko</C>.
        </li>
      </ul>

      <H2 id="other-ways">Other ways to connect</H2>
      <H3>With an API key</H3>
      <p>
        On a <L href="/docs/self-hosting">self-hosted</L> server without Google or email sign-in, send an{" "}
        <L href="/docs/api-keys">API key</L> instead of signing in:
      </p>
      {sh("bash", [`claude mcp add --transport http --scope user meerko ${url} \\`, '    --header "Authorization: Bearer mk_…"'])}
      <H3>As a local server</H3>
      <p>
        The MCP server also runs on your machine from a clone of the repo (Node 20+ and pnpm). It uses the sign-in or key the{" "}
        <L href="/docs/cli">CLI</L> saved, so log in once with <C>pnpm meerko login</C>, then:
      </p>
      {sh("bash", [`git clone ${site.githubUrl} ~/meerko && cd ~/meerko && pnpm install`, "claude mcp add --scope user meerko -- npx tsx ~/meerko/packages/mcp/src/index.ts"])}
    </DocsShell>
  );
}
