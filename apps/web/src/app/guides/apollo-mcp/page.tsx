import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import type { Source } from "@/components/lookout/docs/guide";
import { mcp } from "@/lib/docs";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";

// Targets "apollo mcp" (480/mo) (DataForSEO, US, Nov 2026). Apollo's facts are from its MCP docs page, updated 4 Nov 2026 and
// checked 25 Nov 2026.
export const metadata: Metadata = {
  title: "Apollo MCP Server: What It Does, and an Open-Source Option That Also Sends | Meerko",
  description:
    "What the Apollo MCP server does in Claude, ChatGPT and other assistants, how to connect it, what uses credits, and Meerko as an open-source MCP server that also sends.",
  alternates: { canonical: "/guides/apollo-mcp" },
};

const S = {
  apollo: { label: "Apollo docs: Apollo MCP", url: "https://docs.apollo.io/docs/apollo-mcp" },
} satisfies Record<string, Source>;
const sources: Source[] = Object.values(S);
const Cite = citer(sources);

const link = "text-accent hover:underline";

const rows: [label: string, apollo: string, meerko: string][] = [
  ["Server", "Hosted at mcp.apollo.io/mcp", "Hosted at api.meerko.ai/mcp, or self-hosted"],
  ["Sign-in", "OAuth, or a master API key for headless clients", "OAuth (Google sign-in)"],
  ["Lead data", "Apollo's people and company data", "People and company search, with work emails found and verified"],
  ["Sending", "Apollo sequences and one-off emails, from mailboxes connected to Apollo", "Multi-step sequences from your own Gmail, Outlook or IMAP mailbox"],
  ["Replies", "Sequence analytics and engagement data", "Watches your inbox, labels replies, stops the sequence, drafts answers you approve"],
  ["Source code", "Closed", "Open source (AGPL-3.0)"],
];

export default function Page() {
  return (
    <GuideShell
      slug="apollo-mcp"
      eyebrow="Guide · AI agents"
      h1="Apollo MCP server: what it does, and an open-source option that also sends"
      description={metadata.description as string}
      lead={
        <p>
          The Apollo MCP server connects your Apollo account to an AI assistant such as Claude or ChatGPT, so it can search Apollo&apos;s
          data, enrich contacts, build sequences and send emails from a chat. Apollo hosts it at{" "}
          <code className="font-mono text-fg">mcp.apollo.io/mcp</code> and you sign in with OAuth. If you want the same kind of server
          without an Apollo account, Meerko is an open-source MCP server that finds leads and also sends the sequence from your own
          mailbox.
        </p>
      }
      toc={[
        ["what", "What the Apollo MCP server does"],
        ["connect", "How to connect Apollo MCP"],
        ["credits", "What uses credits"],
        ["compare", "Apollo MCP and Meerko side by side"],
        ["meerko", "How to do it with Meerko"],
      ]}
      sources={sources}
      faq={[
        [
          "Does Apollo have an MCP server?",
          "Yes. Apollo hosts one at https://mcp.apollo.io/mcp over Streamable HTTP with OAuth 2.0 sign-in, and also offers it as a built-in connector on platforms like ChatGPT, Claude, Perplexity, Replit and Cursor.",
        ],
        [
          "Can the Apollo MCP server send emails?",
          "Yes. Apollo's docs list sending one-off emails, creating and updating sequences, and adding or removing contacts from sequences, using the mailboxes connected to your Apollo account.",
        ],
        [
          "Is the Apollo MCP server free?",
          "Connecting it doesn't need an API key or a local install, but enrichment, company search, job postings and validation use Apollo credits. Free accounts registered with a personal email can't use search and enrichment through it.",
        ],
        [
          "Is there an open-source alternative to the Apollo MCP server?",
          "Meerko is an open-source MCP server (AGPL-3.0) for outbound: it finds leads, finds and verifies work emails, sends sequences from your own mailbox and watches for replies. Self-host it for free, or use Meerko Cloud, which starts free with 200 credits.",
        ],
        [
          "Can I use Apollo MCP and Meerko together?",
          "Yes. An assistant can have several MCP servers connected and use the tools of each in one conversation, though you'd normally send a given sequence from one of them.",
        ],
      ]}
    >
      <H2 id="what">What the Apollo MCP server does</H2>
      <p>
        Apollo describes its MCP server as a way to run prospecting, research and outreach from a single conversation in your AI tool. Its
        actions cover:<Cite s={S.apollo} />
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>People and company search, including handing a request to Apollo&apos;s own agent, Google Maps prospecting and web research.</li>
        <li>Enrichment of people and companies, company job postings, and email and phone validation.</li>
        <li>Contacts, accounts, deals, lists, labels, custom objects and tasks.</li>
        <li>Sequences: writing and improving steps, personalizing content per contact, and adding or removing contacts.</li>
        <li>One-off emails with custom To, Cc and Bcc recipients.</li>
        <li>Analytics on sequences and emails, recorded conversations, and checking a sending domain&apos;s SPF, DKIM and DMARC.</li>
      </ul>
      <p>
        Apollo asks you to turn off model training in your AI client before connecting, because it prohibits AI model training with Apollo
        MCP integrations.<Cite s={S.apollo} />
      </p>

      <H2 id="connect">How to connect Apollo MCP</H2>
      <p>
        On ChatGPT, Claude, Perplexity, Replit and Cursor you can add Apollo as a built-in connector, with no server setup. Elsewhere, add
        the standalone server as a remote MCP server:<Cite s={S.apollo} />
      </p>
      <Sample title="Apollo MCP server URL">https://mcp.apollo.io/mcp</Sample>
      <p>
        Choose Streamable HTTP as the transport and complete the OAuth sign-in in your browser. In Claude Code, Apollo&apos;s docs give{" "}
        <code className="font-mono text-fg">claude mcp add --transport http apollo https://mcp.apollo.io/mcp</code>, then{" "}
        <code className="font-mono text-fg">/mcp</code> to sign in.<Cite s={S.apollo} />
      </p>
      <p>
        Clients without a browser, such as a server or a CI job, send an Apollo master API key in the{" "}
        <code className="font-mono text-fg">X-Api-Key</code> header instead; scoped keys are rejected. Apollo notes that those requests act
        as your workspace&apos;s longest-standing active admin, so treat the key like a password.<Cite s={S.apollo} />
      </p>

      <H2 id="credits">What uses credits</H2>
      <p>
        In Apollo&apos;s list of actions, company search, enrichment, job postings, research and validation use credits. People search,
        contacts, sequences, one-off emails, tasks and analytics don&apos;t. Free accounts registered with a personal email address
        can&apos;t use people or company search and enrichment; Apollo says a work email address lifts that, and paid accounts aren&apos;t
        affected.<Cite s={S.apollo} />
      </p>
      <p>
        Most clients let you set each tool to always allow, require approval or block it. Apollo recommends requiring approval for any
        action that uses credits.<Cite s={S.apollo} /> Apollo&apos;s plans are on our{" "}
        <a href="/alternatives/apollo" className={link}>Apollo alternative</a> page.
      </p>

      <H2 id="compare">Apollo MCP and Meerko side by side</H2>
      <p>
        Both servers can find leads and send email from a chat; they differ in where the data and the sending live. Meerko is our product,
        so read its column with that in mind.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-normal" />
              <th className="px-4 py-3 font-normal">
                Apollo MCP
                <Cite s={S.apollo} />
              </th>
              <th className="px-4 py-3 font-normal">Meerko</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, apollo, meerko]) => (
              <tr key={label} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3.5 font-semibold text-fg">{label}</th>
                <td className="px-4 py-3.5">{apollo}</td>
                <td className="px-4 py-3.5">{meerko}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Apollo is the deeper data platform, with phone numbers, deals and call recordings in the same account. Meerko&apos;s case is the
        other end: the code is open, you can run it on your own infrastructure with every lead in your own Postgres, and it keeps sending
        and checking for replies after you close the chat.
      </p>

      <H2 id="meerko">How to do it with Meerko</H2>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          <a href={site.signupUrl} className={link}>Sign up</a> with Google. The Free plan has 200 credits and one mailbox.
        </li>
        <li>
          Add Meerko to your assistant as a custom connector with this URL. Step by step:{" "}
          <a href="/docs/claude" className={link}>Claude</a>, <a href="/docs/chatgpt" className={link}>ChatGPT</a> or{" "}
          <a href="/docs/claude-code" className={link}>Claude Code</a>.
        </li>
      </ol>
      <Sample title="Meerko MCP server URL">{mcpUrl()}</Sample>
      <ol start={3} className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          Connect the mailbox you send from: Gmail with an app password, Outlook with Sign in with Microsoft, or any IMAP and SMTP inbox (
          <a href="/docs/mailboxes" className={link}>Mailboxes</a>).
        </li>
        <li>Ask for the list, the sequence and the replies in plain language:</li>
      </ol>
      <Sample title="Claude or ChatGPT">
        {
          "› Find 30 heads of sales at B2B SaaS companies in Germany with 50 to 200 employees, and verify their work emails.\n› Write a 3-step sequence for them and show me a preview. Don't start it yet.\n› Go through this week's replies and draft answers for the interested ones."
        }
      </Sample>
      <p>
        Meerko gives the assistant {mcp.tools.length} tools, all listed in the{" "}
        <a href="/docs/mcp-tools" className={link}>MCP tools reference</a>. A found email costs 5 credits, a verification 1 and a search
        result 1; sending, replies and drafts don&apos;t use credits. Each mailbox sends up to 50 emails a day by default. For the
        assistant-specific pages, see <a href="/claude" className={link}>Claude for sales</a> and{" "}
        <a href="/chatgpt" className={link}>ChatGPT for sales</a>.
      </p>
      <Callout>
        <p>
          Meerko marks the tools that send real email (<code className="font-mono text-fg">send_test_email</code>,{" "}
          <code className="font-mono text-fg">start_sequence</code> and <code className="font-mono text-fg">approve_emails</code>) as
          destructive, so your assistant asks before running them, and reply drafts wait for your approval.
        </p>
      </Callout>
    </GuideShell>
  );
}
