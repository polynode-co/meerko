import { CodeBlock } from "@/components/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { C, Fields, H2, L } from "@/components/docs/ui";
import { mcpUrl } from "@/lib/meerko";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("mcp-clients", "Connect Meerko to Gemini CLI and other MCP clients | Meerko docs");

export default function Page() {
  const url = mcpUrl();
  return (
    <DocsShell
      slug="mcp-clients"
      h1="Connect any MCP client"
      lead={
        <p>
          Meerko&apos;s MCP server is a remote server that signs you in with OAuth, the way the MCP spec describes. Any client that supports
          remote servers and OAuth can connect with just the URL.
        </p>
      }
      toc={[
        ["values", "What every client needs"],
        ["gemini", "Gemini CLI"],
        ["config", "Clients with a JSON config"],
      ]}
    >
      <H2 id="values">What every client needs</H2>
      <Fields
        head={["Setting", "Value"]}
        rows={[
          ["transport", "Streamable HTTP (often just called http)"],
          ["url", url],
          [
            "auth",
            <>
              OAuth, discovered from the server. Clients register themselves and open your browser to sign in. Without OAuth support, send{" "}
              <C>Authorization: Bearer mk_…</C> with an <L href="/docs/api-keys">API key</L>.
            </>,
          ],
        ]}
      />

      <H2 id="gemini">Gemini CLI</H2>
      <p>
        Add the server, then sign in from inside Gemini CLI with <C>/mcp auth meerko</C> (
        <L href={docsSources.geminiMcp.url}>Gemini CLI&apos;s MCP docs</L>):
      </p>
      <CodeBlock
        title="bash"
        code={`gemini mcp add --scope user --transport http meerko ${url}`}
        lines={[{ text: `$ gemini mcp add --scope user --transport http meerko ${url}` }]}
      />

      <H2 id="config">Clients with a JSON config</H2>
      <p>
        Most clients read an <C>mcpServers</C> object. The key for the URL varies: Cursor uses <C>url</C>, Gemini CLI uses{" "}
        <C>httpUrl</C>. Check your client&apos;s docs for the file and the key.
      </p>
      <CodeBlock
        title="mcp.json"
        lines={[{ text: "{" }, { text: '  "mcpServers": {' }, { text: `    "meerko": { "url": "${url}" }` }, { text: "  }" }, { text: "}" }]}
      />
    </DocsShell>
  );
}
