import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Fields, H2, L } from "@/components/lookout/docs/ui";
import { addToClaudeUrl, mcpUrl } from "@/lib/meerko";
import { docsSources } from "@/lib/sources";

export const metadata = docsMetadata("mcp-clients", "Connect Meerko to Perplexity, Muse, Mistral Vibe and Gemini CLI");

export default function Page() {
  const url = mcpUrl();
  return (
    <DocsShell
      slug="mcp-clients"
      h1="Connect any MCP client"
      lead={
        <p>
          Meerko&apos;s MCP server is a remote server that signs you in with OAuth, the way the MCP spec describes. Any client that supports
          remote servers and OAuth can connect with just the URL. Using Claude? <L href={addToClaudeUrl()}>Connect Claude to Meerko</L>{" "}
          opens Claude&apos;s add-connector form already filled in. More in <L href="/claude">Claude for sales</L> and{" "}
          <L href="/chatgpt">ChatGPT for sales</L>.
        </p>
      }
      toc={[
        ["values", "What every client needs"],
        ["gemini", "Gemini CLI"],
        ["perplexity", "Perplexity"],
        ["muse", "Muse (Meta)"],
        ["mistral", "Mistral Vibe"],
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

      <H2 id="perplexity">Perplexity</H2>
      <p>
        On a plan with Perplexity Computer, upload the <L href="/perplexity">Meerko plugin for Perplexity</L> instead: it adds the connector
        and Meerko&apos;s skills in one go. Otherwise, add Meerko as a custom remote connector (
        <L href={docsSources.perplexityConnectors.url}>Perplexity&apos;s help page</L>):
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Open <strong className="text-fg">Plugins</strong> in the sidebar, click <strong className="text-fg">Add custom</strong>, then{" "}
          <strong className="text-fg">Add MCP connector</strong>, and choose <strong className="text-fg">Remote</strong>.
        </li>
        <li>
          Name it <C>Meerko</C> and paste this as the <strong className="text-fg">MCP server URL</strong>:
        </li>
      </ol>
      <CodeBlock title="MCP server URL" code={url} lines={[{ text: url }]} />
      <ol start={3} className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Under <strong className="text-fg">Advanced</strong>, set <strong className="text-fg">Authentication</strong> to OAuth and{" "}
          <strong className="text-fg">Transport</strong> to Streamable HTTP. Tick the acknowledgement and click{" "}
          <strong className="text-fg">Add</strong>.
        </li>
        <li>
          Select the Meerko card to sign in: continue with Google on Meerko&apos;s page, check what Perplexity will be able to do, and click{" "}
          <strong className="text-fg">Allow</strong>.
        </li>
        <li>
          Name the connector in your request: <C>Using Meerko, find 5 CTOs at fintechs in Spain</C>.
        </li>
      </ol>
      <p>
        On an organization account, members only see <strong className="text-fg">Add custom</strong> once an admin turns on{" "}
        <strong className="text-fg">Allow members to add custom connectors</strong>. Admins can also add Meerko for everyone under{" "}
        <strong className="text-fg">Organization settings → Connectors</strong>.
      </p>

      <H2 id="muse">Muse (Meta)</H2>
      <p>
        Muse is available in the US and Canada (<L href={docsSources.museAvailability.url}>Meta&apos;s announcement</L>). Add Meerko as a
        custom connector either way (<L href={docsSources.museConnectors.url}>Meta&apos;s help page</L>):
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          Send Muse: <C>Add my Meerko connector: {url}</C>
        </li>
        <li>
          Or open <strong className="text-fg">Settings</strong>, then <strong className="text-fg">Connectors</strong>, then{" "}
          <strong className="text-fg">Add custom connector</strong>, and paste the URL.
        </li>
      </ul>
      <p>
        Then open the sign-in link Muse gives you, continue with Google and click <strong className="text-fg">Allow</strong>. Meta doesn&apos;t
        review custom connectors, and asks you to grant access to them with caution.
      </p>

      <H2 id="mistral">Mistral Vibe</H2>
      <p>Mistral Vibe was called Le Chat.</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          At <L href="https://chat.mistral.ai">chat.mistral.ai</L>, open <strong className="text-fg">Connectors</strong>, then{" "}
          <strong className="text-fg">Marketplace</strong>, then <strong className="text-fg">Add a custom connector</strong>.
        </li>
        <li>
          Name it <C>Meerko</C>, with this server URL. Sign-in switches to OAuth 2.1 by itself. Add the connector, then continue with Google
          on Meerko&apos;s page and click <strong className="text-fg">Allow</strong>.
        </li>
      </ol>
      <CodeBlock title="Server URL" code={url} lines={[{ text: url }]} />
      <ol start={3} className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Ask Vibe: <C>find 5 CTOs at fintechs in Spain</C>.
        </li>
      </ol>
      <p>
        Mistral&apos;s docs name a different path: <strong className="text-fg">+ Add Connector</strong>, then the{" "}
        <strong className="text-fg">Custom MCP Connector</strong> tab. Adding a connector needs an admin; on the Free, Pro and Student plans
        the account owner is the admin (<L href={docsSources.mistralConnectors.url}>Mistral&apos;s docs</L>).
      </p>

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
