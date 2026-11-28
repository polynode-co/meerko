import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";
import type { Source } from "@/components/lookout/docs/guide";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";

// Targets "can chatgpt send emails" (polynode-co/meerko#63). The sending feature is from OpenAI's release notes (entry of
// 8 Jun 2026, checked 25 Nov 2026); the custom MCP steps reuse the source cited by /guides/chatgpt-for-sales.
export const metadata: Metadata = {
  title: "Can ChatGPT Send Emails? A Direct Answer and How-To | Meerko",
  description:
    "Can ChatGPT send emails? Yes, from Gmail or Outlook once connected, one email at a time in the chat. How it works, and how to send sequences with follow-ups from ChatGPT.",
  alternates: { canonical: "/guides/can-chatgpt-send-emails" },
};

const S = {
  releaseNotes: { label: "OpenAI Help Center: ChatGPT release notes", url: "https://help.openai.com/en/articles/6825453-chatgpt-release-notes" },
  connect: { label: "OpenAI Apps SDK: Connect from ChatGPT", url: "https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" },
  fullDocs: { label: "OpenAI developer docs: Plugins, full reference", url: "https://developers.openai.com/plugins/llms-full.txt" },
} satisfies Record<string, Source>;
const sources: Source[] = Object.values(S);
const Cite = citer(sources);

const link = "text-accent hover:underline";

export default function Page() {
  return (
    <GuideShell
      slug="can-chatgpt-send-emails"
      eyebrow="Guide · AI agents"
      h1="Can ChatGPT send emails? A direct answer and how-to"
      description={metadata.description as string}
      lead={
        <p>
          Can ChatGPT send emails? Yes, once you connect Gmail or Outlook: ChatGPT drafts the email in the chat and you choose to send it,
          on the web, on Plus, Pro, Business and Enterprise plans. Without a connected mailbox it only writes the email for you to send.
          It sends while you chat; for a sequence that follows up on its own and stops when someone replies, add an outbound tool such as
          Meerko.
        </p>
      }
      toc={[
        ["answer", "What ChatGPT can and can't do with email"],
        ["gmail-outlook", "Sending from Gmail or Outlook in ChatGPT"],
        ["how-to", "How to send sequences from ChatGPT or Claude with Meerko"],
        ["approval", "Confirming what gets sent"],
      ]}
      sources={sources}
      faq={[
        [
          "Can ChatGPT send emails without connecting a mailbox?",
          "No. Without Gmail, Outlook or another tool that reaches a mailbox, ChatGPT can write the email for you to copy, but it can't send it.",
        ],
        [
          "Which ChatGPT plans can send emails?",
          "OpenAI's release notes say sending is available on the web for Plus, Pro, Business and Enterprise users who have connected Gmail or Outlook.",
        ],
        [
          "Can ChatGPT send follow-up emails automatically?",
          "Not with the Gmail or Outlook connection alone: ChatGPT drafts an email and you choose to send it, in the conversation. Follow-ups that go out days later and stop when someone replies need a server that keeps running after the chat closes, which is what Meerko does.",
        ],
        [
          "Can Claude send emails too?",
          "Through a connector, yes. Our guide on whether Claude can send emails covers Claude's Gmail connector and the same Meerko setup in Claude.",
        ],
        [
          "Does ChatGPT send from my own address?",
          "With Gmail or Outlook connected, ChatGPT sends from that account. With Meerko, emails go out from the Gmail, Outlook or IMAP mailbox you connect to Meerko and sit in its Sent folder like any other email.",
        ],
      ]}
    >
      <H2 id="answer">What ChatGPT can and can&apos;t do with email</H2>
      <p>What ChatGPT can do with email depends on what you&apos;ve connected:</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          <strong className="text-fg">Nothing connected:</strong> ChatGPT writes the email, you copy and send it.
        </li>
        <li>
          <strong className="text-fg">Gmail or Outlook connected:</strong> ChatGPT drafts an email and you send it from the same
          conversation, one at a time (details below).<Cite s={S.releaseNotes} />
        </li>
        <li>
          <strong className="text-fg">An outbound MCP server such as Meerko:</strong> sequences from your own mailbox, with follow-ups sent
          days later, a daily limit, and replies that stop the sequence.
        </li>
      </ul>
      <p>
        The same question for Claude is answered in <a href="/guides/can-claude-send-emails" className={link}>Can Claude send emails?</a>,
        and every way to give an assistant Gmail access is in the <a href="/guides/gmail-mcp" className={link}>Gmail MCP guide</a>.
      </p>

      <H2 id="gmail-outlook">Sending from Gmail or Outlook in ChatGPT</H2>
      <p>
        OpenAI&apos;s release notes from June 2026 say that if you&apos;ve connected Gmail or Outlook, you can ask ChatGPT to draft and send
        emails from the same conversation: ChatGPT creates a draft, and you choose to send it without leaving ChatGPT. Sending is available
        on the web for users on Plus, Pro, Business and Enterprise plans.<Cite s={S.releaseNotes} />
      </p>
      <p>
        That covers a single email you ask for in a chat. It doesn&apos;t send the next step of a sequence three days later, and it
        doesn&apos;t notice that someone replied after you closed the conversation.
      </p>

      <H2 id="how-to">How to send sequences from ChatGPT or Claude with Meerko</H2>
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
          Add Meerko to your assistant. In ChatGPT, go to <strong className="text-fg">ChatGPT Plugins</strong>, select the plus button,
          then <strong className="text-fg">Add custom MCP server</strong>, paste the URL below and choose OAuth.
          <Cite s={S.connect} /> In Claude, add it as a custom connector. Full steps:{" "}
          <a href="/docs/chatgpt" className={link}>ChatGPT setup</a> and <a href="/docs/claude" className={link}>Claude setup</a>.
        </li>
        <li>
          Connect your mailbox. Gmail and Google Workspace connect with an app password, Outlook and Microsoft 365 with Sign in with
          Microsoft, and other providers over IMAP and SMTP. See <a href="/docs/mailboxes" className={link}>Mailboxes</a>.
        </li>
        <li>
          In a new conversation, type <code className="font-mono text-fg">@</code>, pick Meerko and ask in plain language, as in the
          prompts below.
        </li>
      </ol>
      <Sample title="Server URL">{mcpUrl()}</Sample>
      <Sample title="Send yourself a test first">
        {"› @Meerko connect my Gmail, then send me a test email so I can see how it looks."}
      </Sample>
      <Sample title="Then a sequence">
        {"› Write a 3-step sequence for my Fintech CTOs table: a short first email, a follow-up after 3 days and a last one after 7. Show me a preview and don't start it yet."}
      </Sample>
      <p>
        Once you start the sequence, Meerko sends each step within the daily limit of each mailbox (50 by default, with a ramp for new
        inboxes), checks for replies every minute on Meerko Cloud, and stops the sequence for anyone who replies or unsubscribes. How
        sequences work is in <a href="/docs/sequences" className={link}>Sequences</a>; for the setup on one page, see{" "}
        <a href="/chatgpt" className={link}>ChatGPT for sales</a> or <a href="/claude" className={link}>Claude for sales</a>. Writing the
        follow-ups themselves is covered in <a href="/guides/cold-email-follow-up" className={link}>how to follow up on a cold email</a>.
      </p>

      <H2 id="approval">Confirming what gets sent</H2>
      <p>
        MCP tools carry hints that tell ChatGPT what they do. OpenAI defines <code className="font-mono text-fg">destructiveHint</code> as
        true when a tool can cause outcomes that are hard to reverse, and ChatGPT uses these hints to decide when to ask for confirmation.
        <Cite s={S.fullDocs} />
      </p>
      <Callout>
        <p>
          Meerko marks the three tools that send real email (<code className="font-mono text-fg">send_test_email</code>,{" "}
          <code className="font-mono text-fg">start_sequence</code> and <code className="font-mono text-fg">approve_emails</code>) as
          destructive, so ChatGPT and Claude ask before running them. Reply drafts wait for your approval: nothing is answered on its own.
        </p>
      </Callout>
    </GuideShell>
  );
}
