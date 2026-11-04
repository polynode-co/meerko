import type { Metadata } from "next";
import { citer, GuideShell, H2 } from "@/components/lookout/docs/guide";
import { ftcCanSpam } from "@/lib/sources";

// Targets "cold email subject lines" (1.6k/mo, KD 2, +171% YoY) (DataForSEO, US, Oct 2026).
export const metadata: Metadata = {
  title: "Cold Email Subject Lines: Examples That Get Opened | Meerko",
  description: "What makes a cold email subject line work, the mistakes to avoid, and 30 examples grouped by approach that you can adapt.",
  alternates: { canonical: "/guides/cold-email-subject-lines" },
};

const sources = [ftcCanSpam];
const Cite = citer(sources);

const examples: [string, string[]][] = [
  ["Short and specific", ["Question about {{company}}'s outbound", "{{company}} + Meerko", "Lists for {{company}}", "Quick question, {{first_name}}", "Your SDR hiring"]],
  ["About them, not you", ["{{company}}'s new office in Madrid", "Your post on cold email", "Congrats on the Series A", "Saw you're hiring SDRs", "{{first_name}}, about your talk"]],
  ["A clear reason to open", ["Idea for {{company}}'s pipeline", "3 leads for {{company}}", "A shorter way to build lists", "Cutting tool spend at {{company}}", "Replies without a new tool"]],
  ["A referral or shared context", ["{{referrer}} suggested I reach out", "Fellow {{school}} alum", "From the GTM engineers meetup", "We both use Clay", "Mutual: {{referrer}}"]],
  ["Plain questions", ["Who owns outbound at {{company}}?", "Worth a look?", "Right person?", "Still relevant for Q4?", "Open to a 15-minute call?"]],
  ["Follow-ups (same thread, or a fresh line)", ["Re: Question about {{company}}'s outbound", "One more idea", "Closing the loop", "Should I stop here?", "Last note from me"]],
];

export default function Page() {
  return (
    <GuideShell
      slug="cold-email-subject-lines"
      eyebrow="Guide · Cold email"
      h1="Cold email subject lines that get opened"
      description={metadata.description as string}
      lead={
        <p>
          The best cold email subject lines are short, specific to the reader and honest about what&apos;s inside. Three to six
          words, lowercase-friendly, no clickbait: the subject&apos;s only job is to make the right person open the email.
        </p>
      }
      toc={[
        ["principles", "What makes a subject line work"],
        ["mistakes", "Mistakes to avoid"],
        ["examples", "30 examples"],
        ["test", "How to test them"],
      ]}
      sources={sources}
      faq={[
        ["How long should a cold email subject line be?", "Short: three to six words is a good target, so it's readable at a glance on a phone."],
        ["Should I personalize the subject line?", "When you have a real reason: their company, a recent event or a mutual contact. A name alone isn't personalization."],
        ["Can a subject line be misleading to get opens?", "No. Under CAN-SPAM, the subject line must accurately reflect the content of the message, and misleading ones also cost you trust."],
      ]}
    >
      <H2 id="principles">What makes a subject line work</H2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li><strong className="text-fg">Short.</strong> Three to six words, readable at a glance on a phone.</li>
        <li><strong className="text-fg">Specific.</strong> Their company or situation beats a generic benefit.</li>
        <li><strong className="text-fg">Plain.</strong> It should look like an email from a colleague, not a newsletter.</li>
        <li><strong className="text-fg">Honest.</strong> The body has to deliver what the subject promises.</li>
      </ul>

      <H2 id="mistakes">Mistakes to avoid</H2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>Fake &quot;Re:&quot; or &quot;Fwd:&quot; on a first email. It&apos;s a trick, and readers notice.</li>
        <li>
          Misleading subjects. In the US, CAN-SPAM requires that the subject line accurately reflect the content of the message.
          <Cite s={ftcCanSpam} />
        </li>
        <li>ALL CAPS, piles of punctuation and spammy words like &quot;free!!!&quot;.</li>
        <li>Talking about yourself: &quot;Introducing our platform&quot; gives no reason to open.</li>
      </ul>

      <H2 id="examples">30 cold email subject line examples</H2>
      <p>
        Variables like <code className="font-mono text-fg">{"{{company}}"}</code> fill in from your lead list. Meerko sequences use
        the same format.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {examples.map(([group, lines]) => (
          <div key={group} className="flex flex-col gap-2 rounded-xl border border-line px-5 py-4">
            <p className="font-semibold text-fg">{group}</p>
            <ul className="flex flex-col gap-1 font-mono text-[15px]">
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <H2 id="test">How to test subject lines</H2>
      <p>
        Measure replies, not opens: a reply is the outcome you want. Change one thing at a time, send each version to a similar
        slice of your list, and keep the winner.
      </p>
      <p>
        Pair a strong subject with a good first line and a clear ask: see the{" "}
        <a href="/guides/cold-email-templates" className="text-accent hover:underline">cold email templates</a> and how to{" "}
        <a href="/guides/cold-email-follow-up" className="text-accent hover:underline">follow up</a>.
      </p>
    </GuideShell>
  );
}
