import type { Metadata } from "next";
import { GuideShell, H2, Sample } from "@/components/lookout/docs/guide";

// Targets "cold email templates" (1.6k/mo, KD 9, +60% YoY) (DataForSEO, US, Oct 2026).
export const metadata: Metadata = {
  title: "Cold Email Templates You Can Copy (with Variables) | Meerko",
  description: "Six copy-ready cold email templates for different situations, the anatomy of a good cold email, and how to personalize at scale.",
  alternates: { canonical: "/guides/cold-email-templates" },
};

const templates: [string, string, string][] = [
  [
    "The direct ask",
    "Quick question, {{first_name}}",
    "Hi {{first_name}},\n\nI help teams like {{company}} book meetings from outbound without adding headcount.\n\nIs that something you're working on this quarter? If not, no worries.\n\n{{sender_name}}",
  ],
  [
    "The trigger event",
    "Congrats on the {{event}}",
    "Hi {{first_name}},\n\nSaw the news about {{event}} at {{company}}. Growth like that usually means more pipeline to build, fast.\n\nWe help teams set up outbound in a week. Worth a 15-minute call?\n\n{{sender_name}}",
  ],
  [
    "The problem-first",
    "{{company}}'s outbound stack",
    "Hi {{first_name}},\n\nMost teams we talk to pay for four or five tools just to send cold email and track replies.\n\nWe replace that with one, run from your coding agent. Open to seeing how?\n\n{{sender_name}}",
  ],
  [
    "The referral",
    "{{referrer}} suggested I reach out",
    "Hi {{first_name}},\n\n{{referrer}} mentioned you're rebuilding outbound at {{company}} and thought we should talk.\n\nWould a short call next week work?\n\n{{sender_name}}",
  ],
  [
    "The right-person question",
    "Who owns outbound at {{company}}?",
    "Hi {{first_name}},\n\nI'm trying to find the right person at {{company}} to talk about outbound tooling. Is that you, or could you point me to them?\n\nThanks,\n{{sender_name}}",
  ],
  [
    "The resource offer",
    "A playbook for {{company}}",
    "Hi {{first_name}},\n\nWe wrote up how teams like {{company}} run outbound from a coding agent: lists, sequences and replies in one loop.\n\nWant me to send it over?\n\n{{sender_name}}",
  ],
];

export default function Page() {
  return (
    <GuideShell
      slug="cold-email-templates"
      eyebrow="Guide · Cold email"
      h1="Cold email templates you can copy"
      description={metadata.description as string}
      lead={
        <p>
          A good cold email is short, about the reader and ends with one easy ask. Below are six templates for different
          situations, written with <code className="font-mono">{"{{variables}}"}</code> so you can personalize them from a lead
          list.
        </p>
      }
      toc={[
        ["anatomy", "Anatomy of a cold email"],
        ["templates", "6 templates"],
        ["personalize", "Personalizing at scale"],
        ["sequence", "Turning them into a sequence"],
      ]}
      sources={[]}
      cta="docs"
      faq={[
        ["How long should a cold email be?", "Short enough to read on a phone without scrolling: roughly 50 to 125 words is a good target for a first email."],
        ["Should cold emails include links or attachments?", "Keep the first email plain: no attachments, and at most one link. Offer the resource and send it when they say yes."],
        ["What are template variables?", "Placeholders like {{first_name}} or {{company}} that are filled in from your lead list when the email is sent."],
      ]}
    >
      <H2 id="anatomy">Anatomy of a cold email</H2>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6">
        <li><strong className="text-fg">Subject:</strong> three to six words, specific to them (see <a href="/guides/cold-email-subject-lines" className="text-accent hover:underline">subject lines</a>).</li>
        <li><strong className="text-fg">First line:</strong> about them, not you. A reason you&apos;re writing to this person.</li>
        <li><strong className="text-fg">The point:</strong> one sentence on the problem you solve.</li>
        <li><strong className="text-fg">The ask:</strong> one small, easy-to-answer question.</li>
        <li><strong className="text-fg">Sign-off:</strong> your name. No long signature, no banner.</li>
      </ol>

      <H2 id="templates">6 cold email templates</H2>
      {templates.map(([name, subject, body]) => (
        <Sample key={name} title={`${name} · Subject: ${subject}`}>
          {body}
        </Sample>
      ))}

      <H2 id="personalize">Personalizing at scale</H2>
      <p>
        Variables only work if the data behind them is right. Before you send, check that every row has the columns your template
        uses: a missing <code className="font-mono text-fg">{"{{company}}"}</code> turns a personal email into an obviously broken
        one. Meerko previews each email per lead and skips rows with missing variables when you enroll them.
      </p>

      <H2 id="sequence">Turning templates into a sequence</H2>
      <p>
        A first email rarely gets the reply on its own. Pair one of these with two or three short follow-ups in the same thread:
        see <a href="/guides/cold-email-follow-up" className="text-accent hover:underline">how to follow up on a cold email</a>. Then
        keep the volume where your mailbox can handle it: <a href="/guides/gmail-sending-limits" className="text-accent hover:underline">Gmail sending limits</a>.
      </p>
    </GuideShell>
  );
}
