import type { Metadata } from "next";
import { H2, RampChart, Timeline, citer } from "@/components/lookout/marketing/ui";
import { IntegrationShell } from "@/components/integrations/integration-shell";
import { mailMergeSources } from "@/lib/sources";

// Targets "gmail mail merge" / "mail merge for gmail" (5.4k/mo, KD 58), "free mail merge for gmail" (140) and
// "google workspace mail merge" (390, +129% YoY) (DataForSEO, US, Nov 2026). Gmail facts cite Google's own help page;
// Meerko facts match docs/mailboxes, docs/sequences and the code behind them.
const description =
  "Send a personalized mail merge from your own Gmail or Google Workspace account, with follow-ups in the same thread that stop when someone replies. Free to start.";

export const metadata: Metadata = {
  title: "Gmail mail merge with follow-ups, from your own inbox | Meerko",
  description,
  alternates: { canonical: "/integrations/gmail" },
};

const sources = [mailMergeSources.gmail];
const Cite = citer(sources);

export default function GmailIntegration() {
  return (
    <IntegrationShell
      slug="gmail"
      h1="Gmail mail merge, with follow-ups that stop on a reply"
      description={description}
      lead={
        <p>
          Meerko sends each lead their own email from your Gmail or Google Workspace inbox, filled in from their row in a table. Follow-ups
          go out days later in the same thread, and the sequence stops for anyone who answers. Every email sits in your Sent folder and every
          reply lands in your inbox.
        </p>
      }
      steps={[
        ["Make an app password", "Turn on 2-Step Verification, then create an app password named Meerko in your Google account."],
        ["Connect the mailbox", "Paste it in Connections → Connect mailbox. Meerko checks it with Gmail before saving it, encrypted."],
        ["Write the sequence", "Up to 10 steps with {{first_name}}-style variables, or ask your coding agent to draft it from a table."],
      ]}
      compare={{
        them: "Gmail's built-in mail merge",
        rows: [
          { label: "Accounts", meerko: "Personal Gmail and any Google Workspace account with app passwords", them: "Eligible Workspace plans only, such as Business Standard and Plus", source: mailMergeSources.gmail },
          { label: "Follow-ups", meerko: "Up to 9, each replying in the same thread", them: "One send; it can't be used for replies or scheduled sends", source: mailMergeSources.gmail },
          { label: "Personalization", meerko: "Any column of the lead's row, e.g. {{company}}", them: "Merge tags like @firstname, with a sheet as the recipient list", source: mailMergeSources.gmail },
          { label: "Volume", meerko: "Your own daily limit per mailbox (50 by default), spaced 3–7 minutes apart", them: "Up to 1,500 recipients a day, shared with your other email", source: mailMergeSources.gmail },
        ],
      }}
      sources={sources}
      faq={[
        [
          "Does Gmail have a built-in mail merge?",
          "Yes, on eligible Google Workspace plans: Google lists Workspace Individual, Business Standard and Plus, Enterprise and Education Standard and Plus. Each recipient gets their own copy, but it sends once and can't be used for replies or scheduled sends.",
        ],
        [
          "Can I mail merge from a personal Gmail account?",
          "With Meerko, yes: personal Gmail connects with an app password, which needs 2-Step Verification turned on. Gmail's own mail merge isn't offered on personal accounts.",
        ],
        [
          "Do follow-ups stay in the same thread?",
          "Yes. Step 1 starts the thread and each follow-up replies in it as “Re: ” plus the first subject, after the delay you set (0 to 60 days, 3 by default).",
        ],
        [
          "What happens when someone replies?",
          "Meerko spots the reply in your inbox, stops the sequence for that person and puts the reply in your Meerko inbox. Bounces, out-of-office replies and unsubscribe requests are handled on their own.",
        ],
        [
          "Is it free?",
          "Sending doesn't cost credits. Meerko Cloud's Free plan connects one mailbox and starts with 200 credits for lead search and email finding; Pro is $49/month with unlimited mailboxes. Self-hosting is free.",
        ],
        ["Can I attach files?", "No. Sequence emails are plain text, which also tends to read more like a personal email. Link to a file instead."],
      ]}
    >
      <H2 id="how">How it works</H2>
      <p>
        Your leads live in a table, one row each. A sequence is a list of steps: step 1 has a subject, and any{" "}
        <code className="font-plex text-[15px] text-lk-fg">{"{{column}}"}</code> in a subject or body is filled in from the lead&apos;s row.
        Meerko sends during a window you choose (9:00 to 17:00, Monday to Friday by default, in the recipient&apos;s timezone) and adds an
        unsubscribe link and Gmail&apos;s one-click unsubscribe header to every email.
      </p>
      <Timeline steps={[["Day 0", "First email"], ["Day 3", "Follow-up 1"], ["Day 7", "Follow-up 2"], ["Reply", "Sequence stops"]]} highlight={3} />
      <p>
        Gmail&apos;s own mail merge, where your plan has it, sends one personalized message per recipient and keeps replies in separate
        threads
        <Cite s={mailMergeSources.gmail} />. Meerko adds what a cold email needs around that: the follow-ups, the stop on reply and a
        reply inbox.
      </p>

      <H2 id="safe">Sending safely from Gmail</H2>
      <p>
        Each mailbox has a daily limit (50 by default, from 1 to 500) and waits 3 to 7 minutes between sends, so nothing goes out in a
        burst. A newly connected mailbox ramps up from 10 a day to its limit over 21 days, and Meerko checks SPF, DKIM and DMARC for your
        domain. Several mailboxes can share one sequence. More in the{" "}
        <a href="/guides/gmail-sending-limits" className="text-lk-lime hover:underline">Gmail sending limits</a> and{" "}
        <a href="/guides/email-deliverability" className="text-lk-lime hover:underline">deliverability</a> guides.
      </p>
      <RampChart />
      <p>
        Meerko only reads the threads it started and mail from people in your sequences. The rest of your inbox is never stored or marked
        read.
      </p>

      <H2 id="agent">Or let your agent run it</H2>
      <p>
        Everything above also works from Claude Code, Cursor or Codex: ask for a lead list, have your agent write the sequence, and approve
        it before anything is sent. See <a href="/docs/claude-code" className="text-lk-lime hover:underline">Claude Code setup</a>.
      </p>
    </IntegrationShell>
  );
}
