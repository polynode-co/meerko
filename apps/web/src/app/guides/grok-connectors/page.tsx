import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";

// Targets "grok connectors" (170/mo, KD 9) (DataForSEO, US, Nov 2026).
export const metadata: Metadata = {
  title: "Grok Connectors: How to Add a Custom MCP Server to Grok | Meerko",
  description: "How Grok connectors work: built-in, catalog and custom MCP connectors, admin setup on Grok Business, and how to add a server URL such as Meerko's.",
  alternates: { canonical: "/guides/grok-connectors" },
};

const grok = { label: "xAI docs: Grok connectors", url: "https://docs.x.ai/grok/connectors" };
const sources = [grok];
const Cite = citer(sources);

export default function Page() {
  return (
    <GuideShell
      slug="grok-connectors"
      eyebrow="Guide · AI agents"
      h1="Grok connectors and custom MCP servers"
      description={metadata.description as string}
      lead={
        <p>
          Grok connectors let Grok use your outside tools inside a conversation. There are built-in ones, a catalog, and custom
          connectors: any remote MCP server you add by URL at grok.com/connectors.
        </p>
      }
      toc={[
        ["types", "Types of Grok connectors"],
        ["custom", "Adding a custom MCP connector"],
        ["business", "Grok Business and Enterprise"],
        ["meerko", "Adding Meerko"],
      ]}
      sources={sources}
      faq={[
        ["Are Grok connectors free?", "xAI says connectors are available to all Grok users. The service behind a connector may have its own pricing."],
        [
          "Can Grok connect to a local MCP server?",
          "Not directly. xAI says custom servers must be reachable from the public internet; a local server needs a tunnelling service.",
        ],
        [
          "Does Meerko work in Grok?",
          "Meerko is a standard remote MCP server with OAuth sign-in, which is what Grok's custom connectors take. We haven't published a tested Grok setup yet, so treat it as untested.",
        ],
      ]}
    >
      <H2 id="types">Types of Grok connectors</H2>
      <p>xAI describes three kinds, all available to every Grok user:<Cite s={grok} /></p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="text-fg">Built-in:</strong> Gmail and Google Calendar, Google Drive, OneDrive, Outlook Mail and Calendar,
          Microsoft Teams, SharePoint and Salesforce. Each signs in with OAuth.
        </li>
        <li>
          <strong className="text-fg">Catalog:</strong> pre-configured connectors for third-party services, browsable at grok.com/connectors,
          that need only a sign-in.
        </li>
        <li>
          <strong className="text-fg">Custom MCP:</strong> your own Model Context Protocol server, for services that aren&apos;t in the catalog.
        </li>
      </ul>

      <H2 id="custom">Adding a custom MCP connector</H2>
      <p>The steps from xAI&apos;s docs:<Cite s={grok} /></p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>Go to grok.com/connectors.</li>
        <li>
          Click <strong className="text-fg">New Connector</strong>, then select <strong className="text-fg">Custom</strong>.
        </li>
        <li>Enter the MCP server URL and complete any sign-in the server asks for.</li>
      </ol>
      <p>
        Grok then discovers the server&apos;s tools and makes them available in conversations. The server must be reachable from the public
        internet.<Cite s={grok} />
      </p>

      <H2 id="business">Grok Business and Enterprise</H2>
      <p>
        On Grok Business and Enterprise, a team admin first provisions the connector for the organization in xAI&apos;s cloud console, under
        connector management. Members can use it after that.<Cite s={grok} />
      </p>

      <H2 id="meerko">Adding Meerko</H2>
      <p>
        Meerko is an outbound engine for AI assistants: it finds B2B leads, finds and verifies work emails, sends sequences from your own
        Gmail or Outlook and watches for replies. To try it in Grok, use this URL in the custom connector steps above and sign in with Google
        when asked:
      </p>
      <Sample title="Server URL">{mcpUrl()}</Sample>
      <Callout>
        <p>
          We haven&apos;t published a tested Grok setup yet. For the general setup in any MCP client, see{" "}
          <a href="/docs/mcp-clients" className="text-accent hover:underline">other MCP clients</a> for the general setup. xAI&apos;s page
          doesn&apos;t describe tool approval prompts, so check before you let Grok run a tool that sends email.
        </p>
      </Callout>
      <p>
        Meerko marks the tools that send real email as destructive (<code className="font-mono text-fg">send_test_email</code>,{" "}
        <code className="font-mono text-fg">start_sequence</code>, <code className="font-mono text-fg">approve_emails</code>), which tells
        clients that support it to ask first.
      </p>
    </GuideShell>
  );
}
