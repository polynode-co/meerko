import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";
import { mcp } from "@/lib/docs";

// Targets "claude connectors" (3.6k/mo, KD 13) (DataForSEO, US, Nov 2026). "claude for sales" and "claude sales" belong to
// /claude, the landing page, so this guide's title leads with connectors and links there; the URL stays.
export const metadata: Metadata = {
  title: "Claude Connectors: What They Are and How to Add One for Sales | Meerko",
  description:
    "What Claude connectors are, how to add a custom connector, and how a sales connector works in Claude: lead lists, sequences and replies, with prompts you can copy.",
  alternates: { canonical: "/guides/claude-for-sales" },
};

const customConnectors = {
  label: "Claude Help: Getting started with custom connectors using remote MCP",
  url: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp",
};
const directory = { label: "Claude docs: Connectors directory", url: "https://claude.com/docs/connectors/directory" };
const sources = [customConnectors, directory];
const Cite = citer(sources);

const useCases: [string, string][] = [
  ["Build a lead list", "Find 30 heads of sales at B2B SaaS companies in Germany with 50 to 200 employees, and verify their work emails."],
  ["Write a sequence", "Write a 3-step sequence for that list: a short first email, a follow-up after 3 days and a last one after 7. Show me a preview and don't start it."],
  ["Triage replies", "Go through this week's replies. Label each one, and draft answers for the people who are interested."],
  ["Check the pipeline", "Who replied this week, who booked a meeting, and what's waiting on me?"],
];

export default function Page() {
  return (
    <GuideShell
      slug="claude-for-sales"
      eyebrow="Guide · AI agents"
      h1="Claude connectors: what they are and how to use one for sales"
      description={metadata.description as string}
      lead={
        <p>
          Claude connectors link Claude to outside tools through remote MCP servers. Add a sales connector and Claude can build a lead
          list, write a sequence and work through replies in a normal chat, while you approve anything that emails a real person. For the
          short version with the setup on one page, see <a href="/claude" className="text-accent hover:underline">Claude for sales</a>.
        </p>
      }
      toc={[
        ["what", "What Claude connectors are"],
        ["add", "How to add a custom connector"],
        ["use-cases", "Claude for sales: use cases"],
        ["safety", "Keeping a human in the loop"],
      ]}
      sources={sources}
      faq={[
        [
          "Are Claude connectors free?",
          "Custom connectors are available on Free, Pro, Max, Ultra, Team and Enterprise plans, but Free users can add only one. The service you connect may charge separately; Meerko's Free plan includes 200 credits.",
        ],
        [
          "What's the difference between a directory connector and a custom connector?",
          "Directory connectors are listed in Claude's Connectors directory, which holds verified and community entries. A custom connector is any remote MCP server you add by URL yourself. Anthropic says the two run on the same infrastructure.",
        ],
        [
          "Can Claude send cold emails?",
          "Not on its own. It uses the tools of the connectors you add. With Meerko connected, Claude can start a sequence that sends from your own Gmail or Outlook within the daily limit you set, and it asks before running any tool that sends email.",
        ],
        [
          "Do I need Claude Code for this?",
          "No. Custom connectors work in Claude on the web and in Claude Desktop. If you prefer the terminal, the Claude Code guide covers the same workflow there.",
        ],
      ]}
    >
      <H2 id="what">What Claude connectors are</H2>
      <p>
        Connectors let Claude use the tools and data you work with. They run through remote MCP servers: programs hosted on the internet
        that give Claude a set of tools, such as &quot;search people&quot; or &quot;send a sequence&quot;.<Cite s={customConnectors} />
      </p>
      <p>
        There are two ways to get one. The Connectors directory is a catalog of MCP servers that work across claude.ai, Claude Desktop,
        mobile, Claude Code and Cowork, with both verified and community entries. Anthropic notes that verification isn&apos;t a security
        audit.<Cite s={directory} /> Or you add any remote MCP server yourself as a custom connector, by pasting its URL.
      </p>
      <p>
        Custom connectors are available on Free, Pro, Max, Ultra, Team and Enterprise plans. Free users can add one.
        <Cite s={customConnectors} />
      </p>

      <H2 id="add">How to add a custom connector</H2>
      <p>On Pro and Max plans, Anthropic&apos;s steps are:<Cite s={customConnectors} /></p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Go to <strong className="text-fg">Customize → Connectors</strong>.
        </li>
        <li>
          Click <strong className="text-fg">+ Add</strong>, then <strong className="text-fg">Add custom connector</strong>.
        </li>
        <li>Enter a name and the remote MCP server URL, then click Continue.</li>
        <li>Review the detected sign-in settings, then click Add.</li>
      </ol>
      <p>For Meerko, the URL is:</p>
      <Sample title="Server URL">{mcpUrl()}</Sample>
      <p>
        Meerko signs you in with Google over OAuth, so there&apos;s no API key to paste. To use it in a chat, click{" "}
        <strong className="text-fg">+</strong> at the lower left, open <strong className="text-fg">Connectors</strong> and turn it on for
        that conversation.<Cite s={customConnectors} /> The full walkthrough is in the{" "}
        <a href="/docs/claude" className="text-accent hover:underline">Claude setup guide</a>.
      </p>
      <p>
        On Team and Enterprise plans an Owner adds the connector under <strong className="text-fg">Organization settings → Connectors</strong>,
        and each member then clicks Connect to sign in with their own account.<Cite s={customConnectors} />
      </p>

      <H2 id="use-cases">Claude for sales: use cases</H2>
      <p>
        With Meerko connected, Claude gets {mcp.tools.length} tools for outbound: people and company search, finding and verifying work emails,
        sequences that send from your own mailbox, reply detection, reply drafts and a pipeline. You ask in plain language:
      </p>
      {useCases.map(([title, prompt]) => (
        <Sample key={title} title={title}>
          {`› ${prompt}`}
        </Sample>
      ))}
      <p>
        Meerko checks your inbox for replies every minute on Meerko Cloud, even when Claude is closed. Replies and unsubscribes stop the
        sequence for that person. For the emails themselves, start from the{" "}
        <a href="/guides/cold-email-templates" className="text-accent hover:underline">cold email templates</a>. What Claude can send with
        and without a connector is in <a href="/guides/can-claude-send-emails" className="text-accent hover:underline">Can Claude send
        emails?</a>
      </p>
      <p>
        Search results and email lookups use credits: a found email costs 5, a verification 1 and a search result 1. Sending, replies and
        drafts are free, and so are misses. See <a href="/docs/credits" className="text-accent hover:underline">credits</a>.
      </p>

      <H2 id="safety">Keeping a human in the loop</H2>
      <p>
        Anthropic&apos;s own advice for custom connectors: connect only servers you trust, review the permissions asked for at sign-in, and
        read tool approval requests carefully. Choose &quot;Allow always&quot; only for tools you trust to run unsupervised. You can
        switch off tools you don&apos;t want Claude to use from the &quot;Search and tools&quot; menu.<Cite s={customConnectors} />
      </p>
      <Callout>
        <p>
          Meerko marks the tools that send real email (<code className="font-mono text-fg">send_test_email</code>,{" "}
          <code className="font-mono text-fg">start_sequence</code> and <code className="font-mono text-fg">approve_draft</code>) as
          destructive, so Claude asks before running them. Reply drafts wait for your approval; nothing is answered on its own.
        </p>
      </Callout>
      <p>
        Anthropic also notes that Claude can call connector tools during Research without asking again, and suggests switching off tools
        that write.<Cite s={customConnectors} /> For an outbound connector, that means turning off the sending tools before a Research run.
      </p>
    </GuideShell>
  );
}
