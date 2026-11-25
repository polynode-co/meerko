import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import type { Source } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";

// Targets "claude crm" (110/mo, 260 in Oct) (DataForSEO, US, Nov 2026). /claude, the landing page, also mentions it; this guide
// is the long answer and links there. HubSpot's and Attio's facts are from their own MCP pages, checked 25 Nov 2026.
export const metadata: Metadata = {
  title: "Claude CRM: Use Claude as a CRM for Outbound, with HubSpot and Attio Sync | Meerko",
  description:
    "Can Claude be your CRM? How Claude works with HubSpot's and Attio's MCP servers, and how to run an outbound pipeline from Claude that syncs contacts to HubSpot or Attio.",
  alternates: { canonical: "/guides/claude-crm" },
};

const S = {
  hubspot: { label: "HubSpot Developers: HubSpot MCP server", url: "https://developers.hubspot.com/mcp" },
  attio: { label: "Attio docs: Attio MCP", url: "https://docs.attio.com/mcp/overview" },
} satisfies Record<string, Source>;
const sources: Source[] = Object.values(S);
const Cite = citer(sources);

const link = "text-accent hover:underline";

const stages: [stage: string, how: string][] = [
  ["new", "Every lead starts here."],
  ["contacted", "Set when the first sequence email goes out."],
  ["replied", "Set when they reply."],
  ["meeting", "You or Claude, when a call is booked."],
  ["won / lost", "You or Claude."],
];

const prompts: [title: string, prompt: string][] = [
  ["Check the pipeline", "Show my pipeline: who replied this week, who booked a meeting, and what's waiting on me?"],
  ["Move a lead", "Lucía booked a call for Thursday. Move her to meeting."],
  ["Sync to the CRM", "Push the leads in my \"First customers\" table that fit 70+ to my CRM."],
];

export default function Page() {
  return (
    <GuideShell
      slug="claude-crm"
      eyebrow="Guide · AI agents"
      h1="Claude CRM: use Claude as a CRM for outbound, with HubSpot and Attio sync"
      description={metadata.description as string}
      lead={
        <p>
          Claude isn&apos;t a CRM on its own: it doesn&apos;t keep a database of contacts and deals between chats. It becomes one through
          connectors. Connect your CRM&apos;s MCP server (HubSpot and Attio both host one) and Claude reads and updates your records, or
          connect an outbound tool such as Meerko and Claude runs the pipeline for the people you email, syncing them to HubSpot or Attio
          as contacts.
        </p>
      }
      toc={[
        ["ways", "Two ways to use Claude as a CRM"],
        ["hubspot", "Claude with HubSpot"],
        ["attio", "Claude with Attio"],
        ["outbound", "An outbound pipeline in Claude"],
        ["sync", "Syncing to HubSpot or Attio"],
        ["setup", "How to set it up"],
      ]}
      sources={sources}
      faq={[
        [
          "Can Claude be used as a CRM?",
          "Not by itself: Claude doesn't store contacts, deals or stages between chats. Through a connector it can read and update a real CRM such as HubSpot or Attio, or run a pipeline kept in an outbound tool like Meerko.",
        ],
        [
          "Does Claude integrate with HubSpot?",
          "HubSpot hosts a remote MCP server at mcp.hubspot.com that MCP clients connect to with OAuth. HubSpot says it reads and writes contacts, companies, deals, tickets and more, plus engagements like calls, emails, meetings, notes and tasks.",
        ],
        [
          "Does Claude integrate with Attio?",
          "Yes. Attio hosts an MCP server at mcp.attio.com/mcp and lists Attio in Claude's connectors. Attio says it can search, create and update records, log notes and tasks, and that write operations ask for confirmation.",
        ],
        [
          "Does Meerko read my HubSpot or Attio data?",
          "No. Meerko's sync is one way: it writes contacts, matched by email, and never reads or deletes what's in your CRM. To have Claude read your CRM too, connect HubSpot's or Attio's own server alongside Meerko.",
        ],
        [
          "Do I need a CRM at all?",
          "Not to start outbound. Meerko keeps a stage for every lead (new, contacted, replied, meeting, won, lost) that Claude can read and move. If you connect HubSpot or Attio later, a table sync sends the leads you've already worked on there.",
        ],
      ]}
    >
      <H2 id="ways">Two ways to use Claude as a CRM</H2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="text-fg">Connect the CRM you have.</strong> HubSpot&apos;s and Attio&apos;s MCP servers let Claude look up,
          create and update records in that CRM from a chat. The CRM stays the place where the data lives.
        </li>
        <li>
          <strong className="text-fg">Run outbound from Claude.</strong> An outbound tool connected to Claude finds the leads, sends the
          sequence and moves each lead through stages as replies come in. Meerko does that, and pushes the leads it has emailed to HubSpot
          or Attio so the CRM stays up to date.
        </li>
      </ul>
      <p>The two work together: Claude can have several connectors on at once and use the tools of each in one conversation.</p>

      <H2 id="hubspot">Claude with HubSpot</H2>
      <p>
        HubSpot&apos;s remote MCP server connects at the <code className="font-mono text-fg">mcp.hubspot.com</code> endpoint with OAuth
        2.0. HubSpot lists read and write access to CRM objects (contacts, companies, deals, tickets, carts, products, orders, line items,
        invoices, quotes, subscriptions and lists) and engagements (calls, emails, meetings, notes and tasks). Users, teams, owners,
        campaigns and website content are read-only.<Cite s={S.hubspot} />
      </p>
      <p>
        The account&apos;s admin connects first, then other users can. The server doesn&apos;t give access to custom Sensitive Data
        Properties. HubSpot also has a separate, local developer MCP server for building on its platform rather than working the CRM.
        <Cite s={S.hubspot} />
      </p>

      <H2 id="attio">Claude with Attio</H2>
      <p>
        Attio hosts its MCP server at <code className="font-mono text-fg">https://mcp.attio.com/mcp</code>. In Claude.ai or Claude
        Desktop, Attio&apos;s steps are to open Settings → Connectors → Browse connectors, search for Attio and install it; you sign in
        with your Attio account over OAuth, with no API key.<Cite s={S.attio} />
      </p>
      <p>
        Its tools search, list, create, update and merge records, manage lists, views, notes, tasks and comments, search emails, meetings
        and call recordings, and run reports. Claude acts with your Attio user&apos;s permissions; read operations are approved
        automatically and write operations ask for your confirmation first.<Cite s={S.attio} />
      </p>

      <H2 id="outbound">An outbound pipeline in Claude</H2>
      <p>
        A CRM&apos;s server gives Claude your records, but it doesn&apos;t send the emails or notice the replies. With Meerko connected,
        every lead has a stage, and the first three move on their own:
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-normal">Stage</th>
              <th className="px-4 py-3 font-normal">How it&apos;s set</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(([stage, how]) => (
              <tr key={stage} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3.5 font-mono font-semibold text-fg">{stage}</th>
                <td className="px-4 py-3.5">{how}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Automatic moves only go forward, so a late reply never pulls a won lead back. Meerko checks your inbox for replies every minute on
        Meerko Cloud, even with Claude closed, and stops the sequence for anyone who replies. Claude reads the pipeline and moves leads
        when you ask. More in <a href="/docs/pipeline" className={link}>Pipeline</a>.
      </p>
      {prompts.map(([title, prompt]) => (
        <Sample key={title} title={title}>
          {`› ${prompt}`}
        </Sample>
      ))}

      <H2 id="sync">Syncing to HubSpot or Attio</H2>
      <p>Connect one CRM per workspace, and Meerko keeps it updated with the people you email:</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>A lead goes to your CRM within a minute or two of Meerko emailing it, and again whenever its stage changes.</li>
        <li>Contacts are matched by email, so an existing contact is updated, not duplicated. Empty cells never overwrite your CRM.</li>
        <li>
          HubSpot gets the stage as Lead status. Attio has no standard field for it, so stages stay in Meerko; Attio gets the company record
          for the lead&apos;s domain, created if missing.
        </li>
        <li>It&apos;s one way: Meerko writes contacts and never reads or deletes your CRM data.</li>
      </ul>
      <p>
        To push leads you haven&apos;t emailed yet, ask Claude to sync a table. HubSpot connects with a service key and Attio with an API
        key; the scopes and the full field list are in <a href="/docs/crm" className={link}>HubSpot and Attio sync</a>.
      </p>
      <Callout>
        <p>
          Add the CRM token in the dashboard&apos;s Connections, or with{" "}
          <code className="font-mono text-fg">pnpm meerko crm connect hubspot</code> (or <code className="font-mono text-fg">attio</code>
          ), never in a chat. Meerko stores it encrypted, so it doesn&apos;t pass through Claude.
        </p>
      </Callout>

      <H2 id="setup">How to set it up</H2>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          <a href={site.signupUrl} className={link}>Sign up</a> with Google. The Free plan has 200 credits and one mailbox.
        </li>
        <li>
          Add Meerko to Claude as a custom connector with the URL below (<a href="/docs/claude" className={link}>Claude setup</a>). In
          ChatGPT, follow the <a href="/docs/chatgpt" className={link}>ChatGPT setup</a> instead.
        </li>
        <li>
          Connect your mailbox (<a href="/docs/mailboxes" className={link}>Mailboxes</a>) and, if you use one, HubSpot or Attio in
          Connections → CRM.
        </li>
        <li>Ask Claude for a list, a sequence and, later, the pipeline.</li>
      </ol>
      <Sample title="Meerko MCP server URL">{mcpUrl()}</Sample>
      <p>
        The short version, with what Claude can do once it&apos;s connected, is on <a href="/claude" className={link}>Claude for sales</a>{" "}
        and <a href="/chatgpt" className={link}>ChatGPT for sales</a>. For connectors in general, see{" "}
        <a href="/guides/claude-for-sales" className={link}>Claude connectors</a>.
      </p>
    </GuideShell>
  );
}
