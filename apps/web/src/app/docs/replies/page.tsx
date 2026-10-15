import { Inbox, PenLine, ShieldCheck } from "lucide-react";
import { DocsShell, docsMetadata } from "@/components/docs/shell";
import { AskAgent, C, Callout, Cards, Fields, H2, L, Tool } from "@/components/docs/ui";

export const metadata = docsMetadata("replies", "Triage cold email replies with your agent | Meerko docs");

export default function Page() {
  return (
    <DocsShell
      slug="replies"
      h1="Replies & drafts"
      lead={
        <p>
          Meerko watches your inbox for answers to your sequences. Your agent reads them, labels each one by intent and drafts answers;
          you approve what gets sent, from the dashboard or from your agent.
        </p>
      }
      toc={[
        ["detection", "How replies are found"],
        ["automatic", "Handled automatically"],
        ["intents", "Intents"],
        ["drafts", "Drafts and approval"],
        ["inbox", "The inbox"],
      ]}
      tools={["list_replies", "classify_reply", "draft_reply", "list_drafts", "approve_draft", "discard_draft"]}
    >
      <H2 id="detection">How replies are found</H2>
      <p>
        Meerko checks each connected mailbox every minute on Meerko Cloud and every 2 minutes when self-hosted, looking at threads
        with an email sent in the last 60 days. A reply stops every sequence for that address and moves the lead to the replied stage.
        Quoted history is cut from the reply text, so your agent reads only what they wrote.
      </p>

      <H2 id="automatic">Handled automatically</H2>
      <Fields
        head={["Reply", "What Meerko does"]}
        rows={[
          ["bounce", "Stops every sequence to that address and won't email it again."],
          ["unsubscribe", "A short reply asking to be removed counts as an unsubscribe: every sequence stops and the address is never emailed again."],
          ["out_of_office", "Recorded only; the sequence carries on."],
        ]}
      />
      <p>
        These are hidden from <Tool name="list_replies" /> unless you ask for them, so your agent only sees replies from people.
      </p>

      <H2 id="intents">Intents</H2>
      <p>
        Your agent sets one with <Tool name="classify_reply" /> after reading each reply:
      </p>
      <Fields
        head={["Intent", "Means"]}
        rows={[
          ["interested", "Wants to talk or asks for a meeting."],
          ["question", "Asks something before deciding."],
          ["not_now", "Bad timing."],
          ["not_interested", "No."],
          ["referral", "Points you to someone else."],
          ["wrong_person", "Not the right contact."],
          ["other", "Anything else."],
        ]}
      />

      <H2 id="drafts">Drafts and approval</H2>
      <Cards
        items={[
          [PenLine, "Your agent drafts", <>With <Tool name="draft_reply" />. Nothing is sent. Drafting again replaces the pending draft.</>],
          [ShieldCheck, "You approve", <>Approving sends it as a reply in the same Gmail thread, from the mailbox that got the reply. You can edit it first.</>],
        ]}
      />
      <Callout>
        <p>
          Your agent is told to call <Tool name="approve_draft" /> only after you&apos;ve read that specific draft and said to send it.
          Approval is refused for addresses that unsubscribed or bounced. Gmail doesn&apos;t add your signature to emails sent this way,
          so drafts sign off with your first name.
        </p>
      </Callout>
      <AskAgent>/mcp__meerko__triage-replies</AskAgent>
      <p>
        To have drafts ready without asking, let Meerko <L href="/docs/wake-your-agent">wake your agent</L> when replies arrive.
      </p>

      <H2 id="inbox">The inbox</H2>
      <Cards
        items={[
          [
            Inbox,
            "Dashboard inbox",
            <>
              <L href="/app/inbox">Inbox</L> shows each conversation with its draft: edit, approve and send, discard or change the intent. With
              no draft, write your answer there and send it.
            </>,
          ],
        ]}
      />
      <p>
        Answers you send count toward the mailbox&apos;s <L href="/docs/mailboxes#limits">daily limit</L>. They carry no unsubscribe line,
        since they&apos;re a conversation, not outreach. Use <C>list_drafts</C> to see every draft waiting on you.
      </p>
    </DocsShell>
  );
}
