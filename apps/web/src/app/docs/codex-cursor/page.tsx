import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, H2, L } from "@/components/lookout/docs/ui";
import { mcpUrl } from "@/lib/meerko";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("codex-cursor", "Meerko MCP server for Codex and Cursor: setup | Meerko docs");

export default function Page() {
  const url = mcpUrl();
  const block = (title: string, lines: string[], prompt = false) => (
    <CodeBlock title={title} code={lines.join("\n")} lines={lines.map((t) => ({ text: prompt ? `$ ${t}` : t }))} />
  );
  return (
    <DocsShell
      slug="codex-cursor"
      h1="Add the Meerko MCP server to Codex or Cursor"
      lead={
        <p>
          Both connect to Meerko&apos;s hosted MCP server by its URL, then send you to your browser to sign in. Nothing to install and no
          API key to paste.
        </p>
      }
      toc={[
        ["codex", "Codex"],
        ["cursor", "Cursor"],
        ["api-key", "With an API key instead"],
      ]}
    >
      <H2 id="codex">Codex</H2>
      <p>
        Add the server, then sign in (<L href={docsSources.codexMcp.url}>Codex&apos;s MCP docs</L>):
      </p>
      {block("bash", [`codex mcp add meerko --url ${url}`, "codex mcp login meerko"], true)}
      <p>
        The login opens Meerko in your browser: continue with Google and click <strong className="text-fg">Allow</strong>. Or add it to{" "}
        <C>~/.codex/config.toml</C> by hand and run the login after:
      </p>
      {block("~/.codex/config.toml", ["[mcp_servers.meerko]", `url = "${url}"`])}

      <H2 id="cursor">Cursor</H2>
      <p>
        Add it to <C>~/.cursor/mcp.json</C> for every project, or <C>.cursor/mcp.json</C> in one project (
        <L href={docsSources.cursorMcp.url}>Cursor&apos;s MCP docs</L>). Cursor registers itself with Meerko and asks you to sign in from its
        MCP settings.
      </p>
      {block("~/.cursor/mcp.json", ["{", '  "mcpServers": {', `    "meerko": { "url": "${url}" }`, "  }", "}"])}
      <p>Then ask in the agent chat, e.g. &quot;find 20 heads of growth at fintechs in Spain and verify their emails&quot;.</p>
      <p>
        Every app you sign in shows up under <L href="/app/settings">Settings → Connected apps</L>, where you can disconnect it.
      </p>

      <H2 id="api-key">With an API key instead</H2>
      <p>
        On a <L href="/docs/self-hosting">self-hosted</L> server without Google sign-in, send an <L href="/docs/api-keys">API key</L> as a
        header. In Codex, set <C>bearer_token_env_var</C> to the name of an environment variable holding the key. In Cursor:
      </p>
      {block("~/.cursor/mcp.json", [
        "{",
        '  "mcpServers": {',
        '    "meerko": {',
        `      "url": "${url}",`,
        '      "headers": { "Authorization": "Bearer ${env:MEERKO_API_KEY}" }',
        "    }",
        "  }",
        "}",
      ])}
    </DocsShell>
  );
}
