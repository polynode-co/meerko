import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";

// Targets "ai lead generation" (1.6k/mo, KD 30), "ai lead gen" (1.6k), "lead generation software" (720, KD 10),
// "outbound lead generation" (260, KD 3) and "ai prospecting tool" (DataForSEO, US, Nov 2026).
export const metadata: Metadata = {
  title: "AI Lead Generation: A Step-by-Step Outbound Guide with Prompts | Meerko",
  description:
    "AI lead generation for B2B outbound, step by step: define your ICP, find people and companies, verify emails, write the sequence, send within limits and handle replies, with prompts to copy.",
  alternates: { canonical: "/guides/ai-lead-generation" },
};

const senderGuidelines = { label: "Google Workspace Admin Help: Email sender guidelines", url: "https://support.google.com/a/answer/81126" };
const gmailLimits = { label: "Gmail Help: Limits for sending & getting mail", url: "https://support.google.com/mail/answer/22839" };
const sources = [senderGuidelines, gmailLimits];
const Cite = citer(sources);

const link = "text-accent hover:underline";

export default function Page() {
  return (
    <GuideShell
      slug="ai-lead-generation"
      eyebrow="Guide · AI agents"
      h1="AI lead generation for B2B outbound, step by step"
      description={metadata.description as string}
      lead={
        <p>
          AI lead generation means letting an AI assistant do the slow parts of outbound: turning a description of your ideal
          customer into a list of real people, finding and verifying their work emails, drafting the sequence and sorting the
          replies. You decide who to target and approve what gets sent.
        </p>
      }
      toc={[
        ["icp", "1. Define your ICP"],
        ["search", "2. Search people and companies"],
        ["emails", "3. Find and verify emails"],
        ["sequence", "4. Write the sequence"],
        ["send", "5. Send within limits"],
        ["replies", "6. Handle replies"],
      ]}
      sources={sources}
      faq={[
        [
          "What is the best AI lead generation software?",
          "The one that covers the whole loop you need. A lead database alone leaves you exporting CSVs; an AI writer alone has no one to send to. Look for search, email verification, sending from your own mailbox and reply handling in one place, with an approval step before anything goes out.",
        ],
        [
          "Is AI lead generation the same as buying a list?",
          "No. A bought list is someone else's guess at your market. With AI lead generation you search for people who match criteria you set, and verify each address before you write. Google also advises senders not to buy email addresses from other companies.",
        ],
        [
          "Do I need a separate AI prospecting tool if I use ChatGPT or Claude?",
          "The assistant can research and write, but on its own it has no lead data, can't send from your mailbox on a schedule and can't watch for replies while the chat is closed. A tool connected over MCP, like Meerko, adds those parts.",
        ],
        [
          "How many leads should I contact per day?",
          "Start small, around a few dozen per mailbox, and grow as replies come in and bounces stay low. Gmail's own limits are far higher, but staying well under them protects your reputation.",
        ],
      ]}
    >
      <p>
        The steps below use Meerko from Claude or ChatGPT (setup: <a href="/docs/claude" className={link}>Claude</a>,{" "}
        <a href="/docs/chatgpt" className={link}>ChatGPT</a>), but the workflow is the same whatever lead generation software
        you use. Each step has a prompt you can paste.
      </p>

      <H2 id="icp">1. Define your ICP</H2>
      <p>
        An ideal customer profile is the filter everything else runs through: industry, company size, location, and the job
        titles of the people who feel the problem you solve. Write it down in a sentence or two. Be specific: &quot;heads of
        RevOps at 50–500 person B2B SaaS companies in Germany&quot; finds better leads than &quot;sales leaders&quot;.
      </p>
      <Sample title="Prompt · ICP">
        {"› Here's what we sell: [one paragraph]. Our best three customers are [names]. Propose an ICP: industries, company size, countries and 3–5 job titles. Then tell me how many people match before we pull any."}
      </Sample>

      <H2 id="search">2. Search people and companies</H2>
      <p>
        Outbound lead generation starts with a search, not a database export. Ask for companies first when the account
        matters more than the person (a specific tech stack, a recent hire), or for people directly when the title is the
        filter. Pull a small batch first and check it by eye. See <a href="/docs/finding-leads" className={link}>finding leads</a>.
      </p>
      <Sample title="Prompt · Search">
        {"› Find 50 people matching that ICP and save them to a table called \"RevOps DE\". Show me 10 so I can check the fit before you find emails."}
      </Sample>

      <H2 id="emails">3. Find and verify emails</H2>
      <p>
        A found email is a guess until it is verified. Every address that bounces tells mailbox providers your list is
        poor. Google&apos;s sender guidelines tell senders to slow down when messages start bouncing and to unsubscribe
        recipients after repeated bounces, and they advise against buying addresses from other companies.
        <Cite s={senderGuidelines} /> Verify before the first send, and drop anything that comes back invalid.
      </p>
      <Sample title="Prompt · Emails">
        {"› Find and verify work emails for everyone in \"RevOps DE\". Skip anyone whose email can't be verified and tell me how many credits that used."}
      </Sample>
      <p>
        In Meerko a found email costs 5 credits and a verification 1; lookups that find nothing are free. More in{" "}
        <a href="/docs/emails" className={link}>emails</a> and <a href="/pricing" className={link}>pricing</a>.
      </p>

      <H2 id="sequence">4. Write the sequence</H2>
      <p>
        A sequence is a first email and two or three short follow-ups, each sent only if there is no reply. Your assistant is
        good at the first draft; you are better at judging whether it sounds like you. Keep the first email short, about the
        reader, with one clear ask. Start from the <a href="/guides/cold-email-templates" className={link}>cold email templates</a>{" "}
        and the <a href="/guides/cold-email-follow-up" className={link}>follow-up guide</a>.
      </p>
      <Sample title="Prompt · Sequence">
        {"› Write a 3-step sequence for \"RevOps DE\": first email under 90 words, follow-ups after 3 and 7 days. Use {{firstName}} and {{company}}. Show a preview for two people. Don't start it yet."}
      </Sample>

      <H2 id="send">5. Send within limits</H2>
      <p>
        Send from your own mailbox, at a human pace. Gmail caps sending per day and per message,<Cite s={gmailLimits} /> and
        Google asks senders to keep the spam rate reported in Postmaster Tools below 0.3%, aiming for under 0.1%.
        <Cite s={senderGuidelines} /> Cold email reaches the people most likely to hit &quot;report spam&quot;, so stay well under
        the caps and set up SPF, DKIM and DMARC first. Details in{" "}
        <a href="/guides/gmail-sending-limits" className={link}>Gmail sending limits</a> and{" "}
        <a href="/guides/email-deliverability" className={link}>email deliverability</a>.
      </p>
      <Sample title="Prompt · Send">
        {"› Check my mailbox's daily limit, then start the \"RevOps DE\" sequence from my Gmail. Spread the first emails across this week."}
      </Sample>
      <Callout>
        <p>
          Meerko sends only after you say so, from your own Gmail, Outlook or IMAP mailbox, within the mailbox's daily limit (50 by default, adjustable).
          Sending is free. See <a href="/docs/sequences" className={link}>sequences</a>.
        </p>
      </Callout>

      <H2 id="replies">6. Handle replies</H2>
      <p>
        The point of outbound is the reply. Meerko watches the inbox around the clock; when someone replies or unsubscribes,
        their sequence stops. Your assistant labels each reply by intent (interested, not now, not interested and so on) and
        drafts answers, which wait for your approval. See <a href="/docs/replies" className={link}>replies</a>.
      </p>
      <Sample title="Prompt · Replies">
        {"› Go through new replies to \"RevOps DE\". Label each one, draft answers for the interested ones, and move anyone who booked a call to the meeting stage. I'll approve before anything is sent."}
      </Sample>
      <p>
        Run that once a day, or whenever you open your assistant, and the loop is complete: search, verify, write, send,
        reply. The parts that need judgment stay with you.
      </p>
    </GuideShell>
  );
}
