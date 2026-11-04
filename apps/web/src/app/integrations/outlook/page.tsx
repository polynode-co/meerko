import type { Metadata } from "next";
import { H2, RampChart, Timeline, citer } from "@/components/lookout/marketing/ui";
import { IntegrationShell } from "@/components/integrations/integration-shell";
import { mailMergeSources } from "@/lib/sources";

// Targets "mail merge outlook" (2.9k/mo), "outlook mail merge" (1.3k, KD 8), "mail merge in outlook 365" (140, KD 4) and
// "mail merge new outlook" (140) (DataForSEO, US, Nov 2026). Word/Outlook facts cite Microsoft's own support page; Meerko
// facts match docs/mailboxes and packages/core/src/mail/outlook.ts (Microsoft Graph, delegated Mail.Send and Mail.Read).
const description =
  "A mail merge from Outlook or Microsoft 365 with follow-ups in the same thread, no Word or desktop app needed. Sign in with Microsoft and send from your own mailbox.";

export const metadata: Metadata = {
  title: "Outlook mail merge with follow-ups for Microsoft 365 | Meerko",
  description,
  alternates: { canonical: "/integrations/outlook" },
};

const sources = [mailMergeSources.word];
const Cite = citer(sources);

export default function OutlookIntegration() {
  return (
    <IntegrationShell
      slug="outlook"
      h1="Outlook mail merge, with follow-ups and no Word required"
      description={description}
      lead={
        <p>
          Meerko sends a personalized email to each lead from your Outlook or Microsoft 365 mailbox, filled in from their row in a table,
          then follows up in the same thread until they reply. It runs in the browser or from your coding agent, so there&apos;s no
          desktop app to keep open.
        </p>
      }
      steps={[
        ["Sign in with Microsoft", "Pick Outlook in Settings → Connect mailbox and approve Meerko. Work, school and personal accounts work."],
        ["Add your leads", "Import a CSV, search for people, or let your agent build the table. Each column becomes a variable."],
        ["Start the sequence", "Up to 10 steps, sent inside a send window. Nothing goes out until you start it."],
      ]}
      compare={{
        them: "Word and Outlook mail merge",
        rows: [
          { label: "What you need", meerko: "A browser, or your coding agent", them: "Word plus a MAPI-compatible email program such as Outlook", source: mailMergeSources.word },
          { label: "Follow-ups", meerko: "Up to 9, replying in the same thread, stopped when the lead answers", them: "One message per record each time you run the merge", source: mailMergeSources.word },
          { label: "Personalization", meerko: "Any column of the lead's row, in the subject and body", them: "Merge fields from your list, in a Word document", source: mailMergeSources.word },
          { label: "Format", meerko: "Plain text with an unsubscribe link", them: "HTML or plain text; no attachments on Windows", source: mailMergeSources.word },
        ],
      }}
      sources={sources}
      faq={[
        [
          "Can you mail merge in Outlook without Word?",
          "Not with Microsoft's own mail merge, which runs from Word with Outlook as the email program. Meerko sends the merge itself, through your Outlook mailbox, from the browser or your agent.",
        ],
        [
          "Does it work with Microsoft 365 and the new Outlook?",
          "Meerko connects to the mailbox through Microsoft's sign-in, not through an Outlook app, so it doesn't matter which Outlook you read mail in. Microsoft 365 work and school accounts and personal Outlook.com accounts connect the same way.",
        ],
        [
          "What does Meerko get access to?",
          "Permission to send email as you and to read your mail, which it uses to spot replies. It only fetches in full the messages in threads it started or from people in your sequences; other mail is never stored or marked read. Remove its access any time from your Microsoft account.",
        ],
        [
          "My company says an admin has to approve it.",
          "Some organizations only let IT approve apps. Ask your admin to approve Meerko once for everyone, then connect as usual.",
        ],
        [
          "Do follow-ups land in the same thread?",
          "Yes. Each follow-up replies to the first email, after the delay you set (0 to 60 days, 3 by default), and the sequence stops for anyone who answers.",
        ],
        [
          "Is it free?",
          "Sending doesn't cost credits. Meerko Cloud's Free plan connects one mailbox and starts with 200 credits for lead search and email finding; Pro is $49/month with unlimited mailboxes. Self-hosting is free.",
        ],
      ]}
    >
      <H2 id="how">How it works</H2>
      <p>
        Microsoft&apos;s mail merge starts in Word: you write the message as a document, pick a list, and Word sends one email per record
        through Outlook
        <Cite s={mailMergeSources.word} />. Meerko keeps the list in a table and the message in a sequence. Any{" "}
        <code className="font-plex text-[15px] text-lk-fg">{"{{column}}"}</code> is filled in from the lead&apos;s row, and each step after the
        first replies in the same thread a few days later.
      </p>
      <Timeline steps={[["Day 0", "First email"], ["Day 3", "Follow-up 1"], ["Day 7", "Follow-up 2"], ["Reply", "Sequence stops"]]} highlight={3} />
      <p>
        Emails go out through your own mailbox, so they show up in Sent Items and replies come back to your inbox, where Meerko picks them
        up and stops the sequence for that person. Bounces, out-of-office replies and unsubscribe requests are handled on their own.
      </p>

      <H2 id="safe">Sending safely</H2>
      <p>
        Each mailbox has a daily limit (50 by default, from 1 to 500) and waits 3 to 7 minutes between sends. A newly connected mailbox
        ramps up from 10 a day to its limit over 21 days. Emails go out during a send window (9:00 to 17:00, Monday to Friday by default,
        in the recipient&apos;s timezone), and Meerko checks SPF, DKIM and DMARC for your domain. See the{" "}
        <a href="/guides/email-deliverability" className="text-lk-lime hover:underline">deliverability guide</a> for the DNS records.
      </p>
      <RampChart />

      <H2 id="agent">Or let your agent run it</H2>
      <p>
        From Claude Code, Cursor or Codex, ask for a lead list and a sequence in plain language; your agent shows you a preview and starts
        it only after you approve. See <a href="/docs/claude-code" className="text-lk-lime hover:underline">Claude Code setup</a>.
      </p>
    </IntegrationShell>
  );
}
