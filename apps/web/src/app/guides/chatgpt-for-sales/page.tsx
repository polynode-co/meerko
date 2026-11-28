import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";
import { mcp } from "@/lib/docs";

// Targets "chatgpt connectors" (720/mo, KD 6) and "chatgpt mcp" (720, KD 6) (DataForSEO, US, Nov 2026). "chatgpt for sales"
// belongs to /chatgpt, the landing page, so this guide's title leads with connectors and links there; the URL stays.
export const metadata: Metadata = {
  title: "ChatGPT Connectors and Custom MCP Servers, for Sales Tools | Meerko",
  description:
    "How ChatGPT connectors and custom MCP servers work, how to add one, and what a sales MCP server does in ChatGPT: lead lists, sequences and replies.",
  alternates: { canonical: "/guides/chatgpt-for-sales" },
};

const connect = { label: "OpenAI Apps SDK: Connect from ChatGPT", url: "https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" };
const plugins = { label: "OpenAI developer docs: Plugins", url: "https://developers.openai.com/apps-sdk" };
const fullDocs = { label: "OpenAI developer docs: Plugins, full reference", url: "https://developers.openai.com/plugins/llms-full.txt" };
const sources = [connect, plugins, fullDocs];
const Cite = citer(sources);

const useCases: [string, string][] = [
  ["Build a lead list", "@Meerko find 20 heads of growth at Series A fintechs in Spain and verify their emails."],
  ["Write a sequence", "Write a 3-step sequence for that list and show me a preview. Don't start it yet."],
  ["Triage replies", "Go through new replies, label each one and draft answers for the interested ones."],
  ["Check the pipeline", "Who replied this week, who booked a meeting, and what's waiting on me?"],
];

export default function Page() {
  return (
    <GuideShell
      slug="chatgpt-for-sales"
      eyebrow="Guide · AI agents"
      h1="ChatGPT connectors and custom MCP servers, for sales"
      description={metadata.description as string}
      lead={
        <p>
          ChatGPT connects to outside tools through MCP servers, which it now packages as plugins. Add a custom MCP server with sales
          tools and ChatGPT can search for leads, write a sequence and draft reply answers, asking before it runs anything that sends
          email. For the short version with the Meerko plugin, see{" "}
          <a href="/chatgpt" className="text-accent hover:underline">ChatGPT for sales</a>.
        </p>
      }
      toc={[
        ["how", "How ChatGPT connectors and MCP work"],
        ["add", "Adding a custom MCP server"],
        ["plans", "Which plans can use it"],
        ["use-cases", "ChatGPT for sales: use cases"],
        ["safety", "Confirmations and write actions"],
      ]}
      sources={sources}
      faq={[
        [
          "Is a ChatGPT connector the same as an MCP server?",
          "Under the hood, yes. OpenAI's docs describe an MCP server as the part of a ChatGPT plugin that gives it tools and access to outside systems. Adding a custom MCP server in ChatGPT creates a plugin from it.",
        ],
        [
          "Can ChatGPT connect to a server running on my laptop?",
          "Not directly. OpenAI's steps ask for a public MCP server URL, or a Secure MCP Tunnel for servers that aren't public. Meerko is hosted, so you paste its URL.",
        ],
        [
          "Has Meerko been tested in ChatGPT?",
          "Not yet. Meerko is a standard remote MCP server with OAuth sign-in, and the setup guide follows OpenAI's documented steps, but we haven't published a tested ChatGPT walkthrough. If something doesn't work, tell us.",
        ],
        [
          "Why don't I see the option to add a custom MCP server?",
          "OpenAI says account and workspace policies apply. On a work account, your ChatGPT admin may need to allow custom MCP servers.",
        ],
      ]}
    >
      <H2 id="how">How ChatGPT connectors and MCP work</H2>
      <p>
        OpenAI&apos;s developer docs describe plugins as bundles of skills, MCP servers and optional UI. The MCP server is the part that
        gives a plugin tools and access to external systems.<Cite s={plugins} /> What people call ChatGPT connectors or apps sits on the
        same idea: ChatGPT talks to an MCP server and uses the tools it lists.
      </p>
      <p>
        You can install published plugins, or add your own: a custom MCP server you connect directly by URL. Published plugins go through
        OpenAI&apos;s review; a custom server you add yourself is refreshed by you when its tools change.<Cite s={connect} />
      </p>

      <H2 id="add">Adding a custom MCP server</H2>
      <p>OpenAI&apos;s steps:<Cite s={connect} /></p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Go to <strong className="text-fg">ChatGPT Plugins</strong> (chatgpt.com/plugins).
        </li>
        <li>
          Select the plus button, then <strong className="text-fg">Add custom MCP server</strong>.
        </li>
        <li>Enter a name and description.</li>
        <li>
          Under <strong className="text-fg">Connection</strong>, enter the MCP server URL, including the{" "}
          <code className="font-mono text-fg">/mcp</code> path.
        </li>
        <li>
          Configure authentication, review the risk warning and select{" "}
          <strong className="text-fg">I understand and want to continue</strong>.
        </li>
        <li>
          Select <strong className="text-fg">Create as a plugin</strong>, then review the tools ChatGPT found.
        </li>
      </ol>
      <p>For Meerko, the URL is below. Choose OAuth for authentication; you sign in with Google or an email link, with no API key to paste.</p>
      <Sample title="Server URL">{mcpUrl()}</Sample>
      <p>
        When a server adds tools, open it in ChatGPT Plugins, select <strong className="text-fg">Refresh</strong> and start a new
        conversation.<Cite s={connect} /> The full Meerko walkthrough is in the{" "}
        <a href="/docs/chatgpt" className="text-accent hover:underline">ChatGPT setup guide</a>.
      </p>

      <H2 id="plans">Which plans can use it</H2>
      <p>
        OpenAI&apos;s developer guide says only that account and workspace policies apply to adding and using custom MCP servers.
        <Cite s={connect} /> It doesn&apos;t list plans, and we couldn&apos;t check OpenAI&apos;s help center for this guide, so we
        won&apos;t repeat the plan tables you&apos;ll find elsewhere: they disagree with each other. If you don&apos;t see{" "}
        <strong className="text-fg">Add custom MCP server</strong>, your plan or your workspace admin is the reason.
      </p>

      <H2 id="use-cases">ChatGPT for sales: use cases</H2>
      <p>
        Meerko gives ChatGPT {mcp.tools.length} tools for outbound: people and company search, work emails found and verified through Icypeas, sequences
        sent from your own Gmail, Outlook or IMAP mailbox, reply detection, reply drafts and a pipeline. In a new conversation, type{" "}
        <code className="font-mono text-fg">@</code>, pick Meerko and ask:
      </p>
      {useCases.map(([title, prompt]) => (
        <Sample key={title} title={title}>
          {`› ${prompt}`}
        </Sample>
      ))}
      <p>
        Meerko watches your inbox when ChatGPT is closed, so replies are waiting, labelled, the next time you ask. Replies and unsubscribes
        stop the sequence for that person. What ChatGPT can send with and without an MCP server is in{" "}
        <a href="/guides/can-chatgpt-send-emails" className="text-accent hover:underline">Can ChatGPT send emails?</a>
      </p>

      <H2 id="safety">Confirmations and write actions</H2>
      <p>
        MCP tools carry hints that tell ChatGPT what they do. OpenAI defines <code className="font-mono text-fg">readOnlyHint</code> as
        true only when a tool can&apos;t change anything, and <code className="font-mono text-fg">destructiveHint</code> as true when a
        tool can cause outcomes that are hard to reverse. ChatGPT uses these to decide when to ask for confirmation, and OpenAI tells
        server builders to require confirmation for consequential write actions.<Cite s={fullDocs} />
      </p>
      <Callout>
        <p>
          Meerko marks <code className="font-mono text-fg">send_test_email</code>,{" "}
          <code className="font-mono text-fg">start_sequence</code> and <code className="font-mono text-fg">approve_emails</code> as
          destructive, because each one sends real email. Sending also stays within the daily limit you set for each mailbox.
        </p>
      </Callout>
    </GuideShell>
  );
}
