import { CodeBlock } from "@/components/lookout/docs/code-block";
import { DocsShell, docsMetadata } from "@/components/lookout/docs/shell";
import { C, Callout, Fields, H2, L } from "@/components/lookout/docs/ui";
import { mcpUrl, publicApiUrl } from "@/lib/meerko";

export const metadata = docsMetadata("api-keys");

export default function Page() {
  return (
    <DocsShell
      slug="api-keys"
      lead={
        <p>
          Agents and the CLI sign in with your browser, so most people never need a key. Keys are for scripts, CI and self-hosted servers
          without Google sign-in. Each key belongs to one workspace and can use everything in it.
        </p>
      }
      toc={[
        ["when", "When to use a key"],
        ["create", "Creating a key"],
        ["use", "Using a key"],
        ["revoke", "Revoking"],
        ["security", "How keys are stored"],
      ]}
    >
      <H2 id="when">When to use a key</H2>
      <Fields
        head={["Use", "Sign in with"]}
        rows={[
          ["Claude Code, Codex, Cursor…", <>The browser (OAuth). <L href="/docs/claude-code">Setup</L>.</>],
          ["The CLI on your machine", <>The browser: <C>pnpm meerko login</C>.</>],
          ["Scripts, CI, servers", "An API key."],
          ["Self-hosted, no Google sign-in", "An API key, for agents and the CLI too."],
        ]}
      />

      <H2 id="create">Creating a key</H2>
      <p>
        In the dashboard, open <L href="/app/settings">Settings → API keys</L>, name the key and create it. Keys start with <C>mk_</C>{" "}
        and are shown once, so copy it straight away. Creating and revoking keys needs you signed in to the dashboard with Google.
        Self-hosted installs also get a key from <C>pnpm db:seed</C>.
      </p>

      <H2 id="use">Using a key</H2>
      <Fields
        head={["Where", "How"]}
        rows={[
          ["HTTP", <>Send it as a bearer token: <C>Authorization: Bearer mk_…</C>. Every endpoint: <L href="/docs/api">REST API</L>.</>],
          ["MCP", <>The same header on <C>{mcpUrl()}</C>. <L href="/docs/claude-code#other-ways">Example</L>.</>],
          ["CLI", <><C>pnpm meerko login --key mk_… --url {publicApiUrl()}</C>, or set <C>MEERKO_API_KEY</C>.</>],
          ["Dashboard", <>Paste it at <C>/login?method=key</C>. Signed in with a key, you can&apos;t buy credits or manage keys.</>],
        ]}
      />
      <CodeBlock
        title="bash"
        code={`curl -H "Authorization: Bearer mk_…" ${publicApiUrl()}/v1/tables`}
        lines={[{ text: `$ curl -H "Authorization: Bearer mk_…" ${publicApiUrl()}/v1/tables` }]}
      />

      <H2 id="revoke">Revoking</H2>
      <p>
        Delete a key from the same list in Settings. Anything using it stops working straight away. The list shows when each key was last
        used, which helps spot the ones nobody needs. Apps that signed in with the browser are under Connected apps on the same page.
      </p>

      <H2 id="security">How keys are stored</H2>
      <Callout>
        <p>
          Meerko stores only a hash of each key and its first characters, to tell keys apart. Nobody, including us, can show you a key
          again, which is why you copy it on creation. Lost one? Revoke it and create another.
        </p>
      </Callout>
    </DocsShell>
  );
}
