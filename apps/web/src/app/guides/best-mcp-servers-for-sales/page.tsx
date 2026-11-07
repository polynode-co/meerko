import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2 } from "@/components/lookout/docs/guide";
import type { Source } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";
import { mcp } from "@/lib/docs";

// Targets "claude mcp" (5.4k/mo, KD 5), "claude mcp servers" (1.3k, KD 20), "best mcp servers" (720, KD 14),
// "hubspot mcp" (1k), "apollo mcp" (480) and "clay mcp" (320) (DataForSEO, US, Nov 2026).
export const metadata: Metadata = {
  title: "The Best MCP Servers for Sales: HubSpot, Apollo, Clay, Gmail, Slack | Meerko",
  description:
    "The best MCP servers for sales in Claude, ChatGPT and other assistants: HubSpot MCP, Apollo MCP, Clay MCP, Gmail, Slack and Meerko, compared from each vendor's docs.",
  alternates: { canonical: "/guides/best-mcp-servers-for-sales" },
};

const S = {
  hubspot: { label: "HubSpot Developers: HubSpot MCP server", url: "https://developers.hubspot.com/mcp" },
  apollo: { label: "Apollo docs: Apollo MCP", url: "https://docs.apollo.io/docs/apollo-mcp" },
  clay: { label: "Clay: Clay MCP guide", url: "https://www.clay.com/guides/clay-mcp" },
  gmailMcp: { label: "Google for Developers: Gmail MCP reference", url: "https://developers.google.com/workspace/gmail/api/reference/mcp" },
  gmailCommunity: { label: "GitHub: GongRzhe/Gmail-MCP-Server", url: "https://github.com/GongRzhe/Gmail-MCP-Server" },
  slack: { label: "Slack developer docs: Slack MCP server", url: "https://docs.slack.dev/ai/slack-mcp-server" },
  directory: { label: "Claude docs: Connectors directory", url: "https://claude.com/docs/connectors/directory" },
} satisfies Record<string, Source>;
const sources: Source[] = Object.values(S);
const Cite = citer(sources);

const rows: [server: string, official: string, where: string, auth: string, job: string, src: Source | null][] = [
  ["HubSpot", "Yes", "Hosted (mcp.hubspot.com)", "OAuth", "Read and write CRM records", S.hubspot],
  ["Apollo", "Yes", "Hosted (mcp.apollo.io/mcp)", "OAuth or master API key", "Search, enrichment, sequences, one-off emails", S.apollo],
  ["Clay", "Yes", "Connector in Claude, ChatGPT, Codex", "Sign-in", "Research, contacts, Clay Functions", S.clay],
  ["Gmail (Google)", "Yes, developer preview", "Hosted (gmailmcp.googleapis.com)", "Configure first", "Search, read, label, draft", S.gmailMcp],
  ["Gmail (community)", "No, archived", "Local (npx, Docker)", "Your own Google OAuth client", "Send, draft, search, labels, filters", S.gmailCommunity],
  ["Slack", "Yes", "Hosted (mcp.slack.com/mcp)", "OAuth", "Search, messages, canvases", S.slack],
  ["Meerko", "Yes (ours)", "Hosted (api.meerko.ai/mcp) or self-hosted", "OAuth (Google sign-in)", "Leads, emails, sequences, reply watching", null],
];

export default function Page() {
  return (
    <GuideShell
      slug="best-mcp-servers-for-sales"
      eyebrow="Guide · AI agents"
      h1="The best MCP servers for sales"
      description={metadata.description as string}
      lead={
        <p>
          For sales work in Claude or ChatGPT, the MCP servers worth knowing are HubSpot (CRM), Apollo (data and sequences), Clay
          (research and enrichment), Gmail, Slack and Meerko (sending and reply watching). Each one below is described from its vendor&apos;s
          own docs.
        </p>
      }
      toc={[
        ["compare", "Comparison"],
        ["hubspot", "HubSpot MCP"],
        ["apollo", "Apollo MCP"],
        ["clay", "Clay MCP"],
        ["gmail", "Gmail MCP servers"],
        ["slack", "Slack MCP"],
        ["meerko", "Meerko"],
        ["claude", "Adding MCP servers to Claude"],
      ]}
      sources={sources}
      faq={[
        [
          "What is a Claude MCP server?",
          "An MCP server is a program that gives an AI assistant tools. In Claude you add a remote one as a connector, either from the Connectors directory or as a custom connector by URL. Claude Code adds them with `claude mcp add`.",
        ],
        [
          "Which MCP server can send cold email?",
          "Apollo's can send one-off emails and enroll contacts in Apollo sequences. Meerko sends multi-step sequences from your own Gmail, Outlook or IMAP mailbox and watches for replies. Google's own Gmail MCP server lists a draft tool but no send tool.",
        ],
        [
          "Are community MCP servers safe?",
          "Treat them like any software you install. A local Gmail server holds a token to your mailbox. Anthropic notes that even the Verified label in Claude's directory isn't a security audit.",
        ],
        [
          "Can I use several of these at once?",
          "Yes. An assistant can have several servers connected, for example HubSpot for the CRM and Meerko for sending, and use the tools of each in one conversation.",
        ],
      ]}
    >
      <H2 id="compare">Comparison</H2>
      <p>From each vendor&apos;s documentation, checked today. &quot;Official&quot; means published by the company behind the product.</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-normal">Server</th>
              <th className="px-4 py-3 font-normal">Official</th>
              <th className="px-4 py-3 font-normal">Runs</th>
              <th className="px-4 py-3 font-normal">Auth</th>
              <th className="px-4 py-3 font-normal">For</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([server, official, where, auth, job, src]) => (
              <tr key={server} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3.5 font-semibold text-fg">
                  {server}
                  {src && <Cite s={src} />}
                </th>
                <td className="px-4 py-3.5">{official}</td>
                <td className="px-4 py-3.5">{where}</td>
                <td className="px-4 py-3.5">{auth}</td>
                <td className="px-4 py-3.5">{job}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="hubspot">HubSpot MCP</H2>
      <p>
        HubSpot&apos;s remote MCP server gives an AI tool read and write access to your CRM: contacts, companies, deals, tickets, carts and
        products, plus engagements such as calls, emails, meetings, notes and tasks. Users, teams, campaigns and website content are
        read-only. It connects to the mcp.hubspot.com endpoint with OAuth 2.0 and doesn&apos;t expose Sensitive Data Properties.
        <Cite s={S.hubspot} />
      </p>
      <p>
        HubSpot also has a separate developer MCP server that runs locally through the HubSpot CLI, for building on its developer platform
        rather than working the CRM.<Cite s={S.hubspot} />
      </p>

      <H2 id="apollo">Apollo MCP</H2>
      <p>
        Apollo hosts its server at <code className="font-mono text-fg">https://mcp.apollo.io/mcp</code>. You sign in with OAuth in the
        browser, or headless clients send an Apollo master API key. Its tools cover people and company search, enrichment, email and phone
        validation, contacts, accounts, deals and lists, sequences (enrolling contacts and writing steps), one-off emails, tasks and
        analytics.<Cite s={S.apollo} />
      </p>
      <p>
        Enrichment, search and validation use Apollo credits; contact, sequence and email actions don&apos;t. Free accounts registered with
        a personal email can&apos;t use search or enrichment through it. Apollo itself recommends requiring approval for tools that spend
        credits.<Cite s={S.apollo} />
      </p>

      <H2 id="clay">Clay MCP</H2>
      <p>
        Clay describes its MCP as the layer that brings Clay&apos;s data providers, research agents and team workflows into ChatGPT, Claude
        and Codex. In a conversation it can find and verify people at an account, research the company (hiring, tech stack, funding) and
        draft outreach. Admins can expose their own Clay Functions to it with &quot;Enable for MCP&quot; and set per-rep credit limits.
        <Cite s={S.clay} />
      </p>
      <p>
        In Claude you add it from the Connectors page; on Claude Enterprise an admin enables it first. Clay itself points bigger jobs, such
        as 20 or more contacts, complex automation and CRM syncs, to the Clay platform rather than MCP.<Cite s={S.clay} />
      </p>

      <H2 id="gmail">Gmail MCP servers</H2>
      <p>
        Google publishes a Gmail MCP server at <code className="font-mono text-fg">gmailmcp.googleapis.com/mcp/v1</code>, available through
        the Google Workspace Developer Preview Program. Its tools are create_draft, get_message, get_thread, list_drafts, list_labels,
        search_threads and label tools: it can draft, but it lists no tool that sends.<Cite s={S.gmailMcp} />
      </p>
      <p>
        Among community servers, GongRzhe&apos;s Gmail-MCP-Server, runs locally with your own Google Cloud OAuth client and can send
        email with attachments, manage labels and filters, and batch-modify messages. Its repository was archived on 3 March 2026 and is
        read-only.<Cite s={S.gmailCommunity} /> More options, including Claude&apos;s built-in Gmail connector, are in the{" "}
        <a href="/guides/gmail-mcp" className="text-accent hover:underline">Gmail MCP guide</a>.
      </p>

      <H2 id="slack">Slack MCP</H2>
      <p>
        Slack&apos;s server lives at <code className="font-mono text-fg">https://mcp.slack.com/mcp</code> and uses OAuth. Its tools search
        Slack, retrieve, send, schedule and draft messages, and create or update canvases. Workspace admins approve and manage MCP clients,
        and Slack lists Claude.ai, Claude Code, Perplexity and Cursor among the clients it works with.<Cite s={S.slack} /> For sales, it&apos;s
        where an assistant posts a reply alert or a deal summary for the team.
      </p>

      <H2 id="meerko">Meerko</H2>
      <p>
        Meerko is our server, so read this one with that in mind. It&apos;s open source (AGPL) and hosted at{" "}
        <code className="font-mono text-fg">{mcpUrl()}</code>, with Google sign-in over OAuth. Its niche is the part the others leave to
        you: sending multi-step sequences from your own Gmail, Outlook or IMAP mailbox within daily limits, then watching for replies around
        the clock, classifying them and drafting answers you approve. It also finds leads and finds and verifies work emails (through
        Icypeas), and tracks a pipeline: {mcp.tools.length} tools in all.
      </p>
      <p>
        It doesn&apos;t replace a CRM like HubSpot or Clay&apos;s data depth. The Free plan has 200 credits and one mailbox; Pro is $49 a
        month. Every tool is listed in the <a href="/docs/mcp-tools" className="text-accent hover:underline">MCP tools reference</a>.
      </p>

      <H2 id="claude">Adding MCP servers to Claude</H2>
      <p>
        In Claude, browse the Connectors directory under Customize → Connectors, which serves claude.ai, Claude Desktop, mobile, Claude
        Code and Cowork from one catalog.<Cite s={S.directory} /> A server that isn&apos;t listed can be added as a custom connector by URL
        (steps in <a href="/guides/claude-for-sales" className="text-accent hover:underline">Claude for sales</a>). In Claude Code, use{" "}
        <code className="font-mono text-fg">claude mcp add</code>; see the{" "}
        <a href="/docs/claude-code" className="text-accent hover:underline">Claude Code setup</a>.
      </p>
      <Callout>
        <p>
          Anthropic says the directory&apos;s verification isn&apos;t a security audit.<Cite s={S.directory} /> Before connecting any server
          that can send email or edit your CRM, check which of its tools write, and keep approvals on for those.
        </p>
      </Callout>
    </GuideShell>
  );
}
