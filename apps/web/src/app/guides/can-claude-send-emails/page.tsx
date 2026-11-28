import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import type { Source } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";

// Targets "can claude send emails" (polynode-co/meerko#62). Claims about Claude and ChatGPT reuse the sources already cited
// by /guides/gmail-mcp, /guides/claude-for-sales and /guides/chatgpt-for-sales.
export const metadata: Metadata = {
  title: "Can Claude Send Emails? A Direct Answer and How-To | Meerko",
  description:
    "Can Claude send emails? Not on its own: it sends through a connector you add. What Claude's Gmail connector can do, and how to send and follow up from Claude or ChatGPT.",
  alternates: { canonical: "/guides/can-claude-send-emails" },
};

const S = {
  claudeHelp: { label: "Claude Help: Use Google Workspace connectors", url: "https://support.claude.com/en/articles/10166901-use-google-workspace-connectors" },
  claudeDocs: { label: "Claude docs: Gmail connector", url: "https://claude.com/docs/connectors/google/gmail" },
  customConnectors: {
    label: "Claude Help: Getting started with custom connectors using remote MCP",
    url: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp",
  },
  chatgptConnect: { label: "OpenAI Apps SDK: Connect from ChatGPT", url: "https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" },
} satisfies Record<string, Source>;
const sources: Source[] = Object.values(S);
const Cite = citer(sources);

const link = "text-accent hover:underline";

export default function Page() {
  return (
    <GuideShell
      slug="can-claude-send-emails"
      eyebrow="Guide · AI agents"
      h1="Can Claude send emails? A direct answer and how-to"
      description={metadata.description as string}
      lead={
        <p>
          Can Claude send emails? Not on its own: in a plain chat Claude writes the email, and you send it. It can send once you add a
          connector that has a sending tool, such as Claude&apos;s Gmail connector, which asks for your approval before each send by
          default. To send a sequence that follows up on its own and stops when someone replies, connect an outbound tool such as Meerko
          to Claude or ChatGPT.
        </p>
      }
      toc={[
        ["answer", "What Claude can and can't do with email"],
        ["gmail", "Claude's Gmail connector"],
        ["how-to", "How to send email from Claude or ChatGPT with Meerko"],
        ["approval", "Approving what gets sent"],
      ]}
      sources={sources}
      faq={[
        [
          "Can Claude send emails without a connector?",
          "No. Without a connector Claude has no tool that reaches a mailbox, so it can draft the email for you to copy, but it can't send it.",
        ],
        [
          "Can Claude send emails from Gmail?",
          "Anthropic's help center says the Gmail connector can send, reply and forward, asking for approval before each by default. Its connector docs page still describes the connector as read-only, so check what your account shows when you connect.",
        ],
        [
          "Can Claude send follow-up emails automatically?",
          "Not with a plain Gmail connector: Claude sends only while you're chatting with it. Follow-ups that go out days later and stop when someone replies need a server that keeps running after the chat closes, which is what Meerko does.",
        ],
        [
          "Can ChatGPT send emails the same way?",
          "Yes. ChatGPT can send single emails from a connected Gmail or Outlook, and runs Meerko sequences through a custom MCP server added in ChatGPT Plugins. Our guide on whether ChatGPT can send emails has the details.",
        ],
        [
          "Does Claude send from my own address?",
          "With Meerko, yes. Emails go out from the Gmail, Outlook or IMAP mailbox you connect and sit in its Sent folder like any other email.",
        ],
      ]}
    >
      <H2 id="answer">What Claude can and can&apos;t do with email</H2>
      <p>
        Claude uses the tools of the connectors you add: remote MCP servers that give it actions such as &quot;search email&quot; or
        &quot;send a sequence&quot;.<Cite s={S.customConnectors} /> Without one, it can write a subject line, a first email or a reply,
        but sending is up to you. With a connector, what it can do depends on that connector&apos;s tools:
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="text-fg">No connector:</strong> Claude drafts, you copy and send.
        </li>
        <li>
          <strong className="text-fg">Claude&apos;s Gmail connector:</strong> one email at a time from your Gmail, while you&apos;re in
          the chat (details below).
        </li>
        <li>
          <strong className="text-fg">An outbound connector such as Meerko:</strong> sequences from your own mailbox, with follow-ups
          sent days later, a daily limit, and replies that stop the sequence.
        </li>
      </ul>
      <p>
        For every way to give an assistant Gmail access, including Google&apos;s own Gmail MCP server, see the{" "}
        <a href="/guides/gmail-mcp" className={link}>Gmail MCP guide</a>.
      </p>

      <H2 id="gmail">Claude&apos;s Gmail connector</H2>
      <p>
        Anthropic&apos;s help center lists what Claude can do with Gmail: search and read email, draft messages, send, reply and forward,
        manage labels and threads, and list your drafts. By default Claude asks for your approval before each send, reply or forward.
        <Cite s={S.claudeHelp} />
      </p>
      <p>
        Anthropic&apos;s separate connector docs page describes it more narrowly: it says Claude reads and searches email only and
        can&apos;t create, send or modify messages.<Cite s={S.claudeDocs} /> The two pages disagree as of today, so check the permissions
        Google shows when you connect. On Team and Enterprise plans an Owner enables the connector first.<Cite s={S.claudeHelp} />
      </p>
      <p>
        Either way, the Gmail connector works while you chat. It doesn&apos;t send the next step of a sequence three days later, and it
        doesn&apos;t notice that someone replied after you closed the conversation.
      </p>

      <H2 id="how-to">How to send email from Claude or ChatGPT with Meerko</H2>
      <p>
        Meerko is an open-source outbound agent that runs as an MCP server. It sends from your own mailbox and keeps working when the chat
        is closed. The setup takes four steps:
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li>
          <a href={site.signupUrl} className={link}>Create a Meerko account</a> (Meerko Cloud starts with 200 free credits), or{" "}
          <a href="/docs/self-hosting" className={link}>self-host it</a>.
        </li>
        <li>
          Add Meerko to your assistant. In Claude, go to <strong className="text-fg">Customize → Connectors</strong>, click{" "}
          <strong className="text-fg">+ Add</strong>, then <strong className="text-fg">Add custom connector</strong>, and paste the URL
          below.<Cite s={S.customConnectors} /> In ChatGPT, go to <strong className="text-fg">ChatGPT Plugins</strong>, select the plus
          button, then <strong className="text-fg">Add custom MCP server</strong>, and choose OAuth.<Cite s={S.chatgptConnect} /> Full
          steps: <a href="/docs/claude" className={link}>Claude setup</a> and <a href="/docs/chatgpt" className={link}>ChatGPT setup</a>.
          For what ChatGPT sends without Meerko, see <a href="/guides/can-chatgpt-send-emails" className={link}>Can ChatGPT send emails?</a>
        </li>
        <li>
          Connect your mailbox. Gmail and Google Workspace connect with an app password, Outlook and Microsoft 365 with Sign in with
          Microsoft, and other providers over IMAP and SMTP. See <a href="/docs/mailboxes" className={link}>Mailboxes</a>.
        </li>
        <li>Ask in plain language, as in the prompts below.</li>
      </ol>
      <Sample title="Server URL">{mcpUrl()}</Sample>
      <Sample title="Send yourself a test first">
        {"› Connect my Gmail to Meerko, then send me a test email so I can see how it looks."}
      </Sample>
      <Sample title="Then a sequence">
        {"› Write a 3-step sequence for my Fintech CTOs table: a short first email, a follow-up after 3 days and a last one after 7. Show me a preview and don't start it yet."}
      </Sample>
      <p>
        Once you start the sequence, Meerko sends each step within the daily limit of each mailbox (50 by default, with a ramp for new
        inboxes), checks for replies every minute on Meerko Cloud, and stops the sequence for anyone who replies or unsubscribes. How
        sequences work is in <a href="/docs/sequences" className={link}>Sequences</a>; for the setup in Claude on one page, see{" "}
        <a href="/claude" className={link}>Claude for sales</a> or <a href="/chatgpt" className={link}>ChatGPT for sales</a>. Writing the
        follow-ups themselves is covered in <a href="/guides/cold-email-follow-up" className={link}>how to follow up on a cold email</a>.
      </p>

      <H2 id="approval">Approving what gets sent</H2>
      <p>
        Anthropic advises reading tool approval requests carefully and choosing &quot;Allow always&quot; only for tools you trust to run
        unsupervised.<Cite s={S.customConnectors} />
      </p>
      <Callout>
        <p>
          Meerko marks the three tools that send real email (<code className="font-mono text-fg">send_test_email</code>,{" "}
          <code className="font-mono text-fg">start_sequence</code> and <code className="font-mono text-fg">approve_emails</code>) as
          destructive, so Claude and ChatGPT ask before running them. Reply drafts wait for your approval: nothing is answered on its own.
        </p>
      </Callout>
    </GuideShell>
  );
}
