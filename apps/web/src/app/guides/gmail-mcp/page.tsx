import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import type { Source } from "@/components/lookout/docs/guide";

// Targets "gmail mcp" (1.3k/mo, KD 13) (DataForSEO, US, Nov 2026).
export const metadata: Metadata = {
  title: "Gmail MCP: Every Way to Give Claude or ChatGPT Your Gmail | Meerko",
  description:
    "Gmail MCP options compared: Claude's Gmail connector, Google's Gmail MCP server, Grok's Gmail connector, community servers and Meerko. What each can read, draft and send.",
  alternates: { canonical: "/guides/gmail-mcp" },
};

const S = {
  claudeHelp: { label: "Claude Help: Use Google Workspace connectors", url: "https://support.claude.com/en/articles/10166901-use-google-workspace-connectors" },
  claudeDocs: { label: "Claude docs: Gmail connector", url: "https://claude.com/docs/connectors/google/gmail" },
  googleMcp: { label: "Google for Developers: Gmail MCP reference", url: "https://developers.google.com/workspace/gmail/api/reference/mcp" },
  grok: { label: "xAI docs: Grok connectors", url: "https://docs.x.ai/grok/connectors" },
  community: { label: "GitHub: GongRzhe/Gmail-MCP-Server", url: "https://github.com/GongRzhe/Gmail-MCP-Server" },
} satisfies Record<string, Source>;
const sources: Source[] = Object.values(S);
const Cite = citer(sources);

const rows: [option: string, read: string, draft: string, send: string, followUp: string][] = [
  ["Claude Gmail connector", "Yes", "Yes", "Yes, with approval by default (see below)", "No"],
  ["Google Gmail MCP (preview)", "Yes", "Yes", "No send tool listed", "No"],
  ["Community server (GongRzhe)", "Yes", "Yes", "Yes", "No"],
  ["Meerko", "Replies to your sequences", "Reply drafts you approve", "Sequences, within daily limits", "Yes, until someone replies"],
];

export default function Page() {
  return (
    <GuideShell
      slug="gmail-mcp"
      eyebrow="Guide · AI agents"
      h1="Gmail MCP: every way to give your assistant Gmail"
      description={metadata.description as string}
      lead={
        <p>
          A Gmail MCP server lets an AI assistant read, search or write your email. Claude and Grok have built-in Gmail connectors, Google
          has a Gmail MCP server in developer preview, and community servers run locally. None of them run follow-ups on a schedule; that
          takes a sending engine such as Meerko.
        </p>
      }
      toc={[
        ["compare", "What each option can do"],
        ["claude", "Claude's Gmail connector"],
        ["google", "Google's Gmail MCP server"],
        ["others", "Grok and community servers"],
        ["meerko", "Meerko: sequences and replies"],
      ]}
      sources={sources}
      faq={[
        [
          "Can Claude send emails from Gmail?",
          "Anthropic's help center says the Gmail connector can send, reply and forward, asking for approval before each by default. Its connector docs page still describes the connector as read-only, so check what your account shows.",
        ],
        [
          "Is there an official Gmail MCP server?",
          "Yes. Google lists one at gmailmcp.googleapis.com, available through the Google Workspace Developer Preview Program. You have to configure it before use, and its tools draft but don't send.",
        ],
        [
          "Can an assistant send a mail merge or follow-ups through Gmail MCP?",
          "Not with a plain Gmail connector: the assistant sends only while you're chatting with it. Follow-ups that go out days later, stop on a reply and respect a daily limit need a server that runs on its own, which is what Meerko does.",
        ],
        [
          "How does Meerko connect to Gmail?",
          "With a Google app password: it sends through Gmail's SMTP server and reads replies over IMAP, as a mail app would. Emails sit in your Sent folder like any other.",
        ],
      ]}
    >
      <H2 id="compare">What each option can do</H2>
      <p>&quot;Follow up&quot; means sending the next step days later on its own, without an open chat.</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[680px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-normal">Option</th>
              <th className="px-4 py-3 font-normal">Read and search</th>
              <th className="px-4 py-3 font-normal">Draft</th>
              <th className="px-4 py-3 font-normal">Send</th>
              <th className="px-4 py-3 font-normal">Follow up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([option, read, draft, send, followUp]) => (
              <tr key={option} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3.5 font-semibold text-fg">{option}</th>
                <td className="px-4 py-3.5">{read}</td>
                <td className="px-4 py-3.5">{draft}</td>
                <td className="px-4 py-3.5">{send}</td>
                <td className="px-4 py-3.5">{followUp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="claude">Claude&apos;s Gmail connector</H2>
      <p>
        Anthropic&apos;s help center lists what Claude can do with Gmail: search and read email, draft messages, send, reply and forward,
        manage labels and threads, and list your drafts. By default Claude asks for your approval before each send, reply or forward. It
        can&apos;t read attachment content, only metadata, and Google&apos;s API rate limits apply.<Cite s={S.claudeHelp} />
      </p>
      <p>
        Anthropic&apos;s separate connector docs page describes it more narrowly: it says Claude reads and searches email only and
        can&apos;t create, send or modify messages.<Cite s={S.claudeDocs} /> The two pages disagree as of today, so check the permissions
        Google shows when you connect. The help center notes that Google&apos;s consent screen mentions sending.<Cite s={S.claudeHelp} />
      </p>
      <p>
        On Team and Enterprise plans an Owner enables the connector first, and decides whether members may let sends run without asking
        each time.<Cite s={S.claudeHelp} />
      </p>

      <H2 id="google">Google&apos;s Gmail MCP server</H2>
      <p>
        Google publishes a Gmail MCP server at <code className="font-mono text-fg">https://gmailmcp.googleapis.com/mcp/v1</code> as part of
        the Google Workspace Developer Preview Program. You have to configure it before use. Its tools are create_draft, get_message,
        get_thread, list_drafts, list_labels, search_threads, and tools to add and remove labels.<Cite s={S.googleMcp} /> There&apos;s no
        send tool in that list: it suits an assistant that prepares drafts for you to send.
      </p>

      <H2 id="others">Grok and community servers</H2>
      <p>
        Grok lists Gmail and Google Calendar among its built-in connectors, which sign in with OAuth.<Cite s={S.grok} /> xAI&apos;s page
        doesn&apos;t say what the Gmail connector can do beyond that, so we won&apos;t guess. (We couldn&apos;t check OpenAI&apos;s help
        pages on ChatGPT&apos;s Gmail app for this guide either.)
      </p>
      <p>
        Community servers fill the gaps. GongRzhe&apos;s Gmail-MCP-Server runs locally (with npx or Docker) using your own Google Cloud
        OAuth client, and can send email with attachments, create drafts, search, and manage labels and filters. Its repository was
        archived on 3 March 2026, so it no longer gets updates.<Cite s={S.community} /> A local server keeps a token to your mailbox on your
        machine; treat it like any software with that access.
      </p>

      <H2 id="meerko">Meerko: sequences and replies</H2>
      <p>
        The options above give your assistant hands on your inbox while you chat. None of them keeps working after you close the chat. Meerko
        is built for that part of outbound:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          It sends multi-step sequences from your own Gmail, with a daily limit per mailbox (50 by default) and a ramp for new inboxes. See{" "}
          <a href="/guides/gmail-sending-limits" className="text-accent hover:underline">Gmail sending limits</a>.
        </li>
        <li>It checks your inbox for replies every minute on Meerko Cloud, labels them and stops the sequence for anyone who replied.</li>
        <li>It drafts answers to replies, and nothing goes out until you approve the draft.</li>
      </ul>
      <p>
        It connects to Gmail and Google Workspace with an app password, sending through Gmail&apos;s SMTP server and reading replies over
        IMAP. Outlook and Microsoft 365 connect with Sign in with Microsoft, and other providers over IMAP and SMTP. Details are in{" "}
        <a href="/docs/mailboxes" className="text-accent hover:underline">Mailboxes</a>. Once it&apos;s connected, ask your assistant:
      </p>
      <Sample title="Claude, ChatGPT or Claude Code">
        {"› Connect my Gmail to Meerko, then show me today's sending limit and any replies waiting on me."}
      </Sample>
      <Callout>
        <p>
          Sending tools are marked destructive, so your assistant asks before starting a sequence, sending a test email or approving a
          reply. You can run Meerko alongside Claude&apos;s Gmail connector: one reads your inbox in the chat, the other runs the sequence.
        </p>
      </Callout>
    </GuideShell>
  );
}
