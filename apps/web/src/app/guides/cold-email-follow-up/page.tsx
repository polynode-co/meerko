import type { Metadata } from "next";
import { citer, GuideShell, H2, Sample } from "@/components/content/guide-shell";
import { ftcCanSpam, googleSources } from "@/lib/sources";

// Targets "cold email follow up" (3.6k–18k/mo, KD 8) (DataForSEO, US, Oct 2026).
export const metadata: Metadata = {
  title: "How to Follow Up on a Cold Email (Timing + Templates) | Meerko",
  description: "When to send a cold email follow-up, how many to send, and copy-ready follow-up templates that stay in the same thread.",
  alternates: { canonical: "/guides/cold-email-follow-up" },
};

const sources = [ftcCanSpam, googleSources.senderGuidelines];
const Cite = citer(sources);

export default function Page() {
  return (
    <GuideShell
      slug="cold-email-follow-up"
      eyebrow="Guide · Cold email"
      h1="How to follow up on a cold email"
      description={metadata.description as string}
      lead={
        <p>
          Send your follow-ups as replies in the same thread, a few business days apart, and make each one add something new: a
          shorter ask, a proof point or a different angle. Stop the moment someone replies, and always honor an opt-out.
        </p>
      }
      toc={[
        ["why", "Why follow up"],
        ["timing", "When to follow up"],
        ["how-many", "How many follow-ups"],
        ["write", "What to write"],
        ["templates", "Follow-up templates"],
        ["rules", "Rules you must follow"],
      ]}
      sources={sources}
      faq={[
        ["How long should I wait before following up on a cold email?", "A few business days is a sensible default: long enough not to crowd the first email, short enough that the thread is still fresh."],
        ["How many follow-up emails should I send?", "Two or three after the first email is a reasonable ceiling for cold outreach. Each one should add something new, and the sequence should stop as soon as the person replies."],
        ["Should a follow-up be a new email or a reply?", "A reply in the same thread. It keeps the context visible and reads as a follow-up rather than a second cold email."],
        ["Do I need an unsubscribe link in cold follow-ups?", "In the US, CAN-SPAM requires a clear way to opt out of commercial email and that you honor opt-outs within 10 business days."],
      ]}
    >
      <H2 id="why">Why follow up</H2>
      <p>
        People rarely ignore a cold email on purpose. It arrived during a meeting, it got buried, or the timing was wrong. A
        polite follow-up gives the email a second chance without asking for more of their time than the first one did.
      </p>

      <H2 id="timing">When to follow up</H2>
      <p>A simple cadence that respects the reader&apos;s time:</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li><strong className="text-fg">Day 1:</strong> the first email.</li>
        <li><strong className="text-fg">Day 4:</strong> follow-up 1, a short bump with one new detail.</li>
        <li><strong className="text-fg">Day 8:</strong> follow-up 2, a different angle or a proof point.</li>
        <li><strong className="text-fg">Day 14:</strong> follow-up 3, the polite close.</li>
      </ul>
      <p>
        Send on weekdays, inside working hours in the recipient&apos;s time zone. This is a starting point, not a rule: test it
        against your own reply data.
      </p>

      <H2 id="how-many">How many follow-ups to send</H2>
      <p>
        Two or three follow-ups after the first email is plenty for cold outreach. Past that, you&apos;re more likely to earn a
        spam report than a reply. If a lead goes quiet after the last one, move them to a later sequence instead of adding more
        emails to this one.
      </p>

      <H2 id="write">What to write in a follow-up</H2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li><strong className="text-fg">Reply in the same thread</strong> so the first email is right below.</li>
        <li><strong className="text-fg">Add one new thing</strong> each time: a result, a question, a resource. Never just &quot;bumping this&quot;.</li>
        <li><strong className="text-fg">Make the ask smaller</strong> as you go: from a call, to a yes/no question, to &quot;who should I talk to?&quot;</li>
        <li><strong className="text-fg">Keep it short:</strong> two to four sentences.</li>
        <li><strong className="text-fg">Close politely</strong> on the last one, so the door stays open.</li>
      </ul>

      <H2 id="templates">Follow-up templates</H2>
      <p>
        These use <code className="font-mono text-fg">{"{{first_name}}"}</code>-style variables, the same format Meerko sequences
        use, so they work as-is in a sequence step.
      </p>
      <Sample title="Follow-up 1 · day 4 · a short bump with something new">
        {"Hi {{first_name}},\n\nOne thing I left out: teams like {{company}} usually start with a single list and one sequence, then grow from there.\n\nWorth a 15-minute look this week?"}
      </Sample>
      <Sample title="Follow-up 2 · day 8 · a different angle">
        {"Hi {{first_name}},\n\nDifferent angle: is outbound something you own at {{company}}, or is there someone better to ask?\n\nHappy to send a short summary they can forward."}
      </Sample>
      <Sample title="Follow-up 3 · day 14 · the polite close">
        {"Hi {{first_name}},\n\nI'll stop here so I don't crowd your inbox. If outbound becomes a priority later, just reply to this thread and I'll pick it up.\n\nThanks either way."}
      </Sample>
      <p>
        For first emails and more follow-ups, see the <a href="/guides/cold-email-templates" className="text-accent hover:underline">cold email templates</a>.
      </p>

      <H2 id="rules">Rules you must follow</H2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>
          In the US, CAN-SPAM requires a clear way to opt out, a valid physical postal address, and honoring opt-outs within 10
          business days. Each violating email can cost up to $53,088.<Cite s={ftcCanSpam} />
        </li>
        <li>
          Gmail asks every sender to keep the spam rate reported in Postmaster Tools below 0.3%.<Cite s={googleSources.senderGuidelines} /> Fewer,
          better follow-ups help: see <a href="/guides/email-deliverability" className="text-accent hover:underline">email deliverability</a>.
        </li>
        <li>
          Stop the sequence for anyone who replies or unsubscribes. Meerko does this automatically: a reply stops the sequence
          for that lead, and an unsubscribe stops every sequence in your workspace.
        </li>
      </ul>
    </GuideShell>
  );
}
