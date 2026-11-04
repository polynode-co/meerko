import type { Metadata } from "next";
import { citer, GuideShell, H2 } from "@/components/lookout/docs/guide";
import { googleSources as G } from "@/lib/sources";

// Targets "gmail sending limits" (720/mo, KD 14) and "google workspace sending limits" (DataForSEO, US, Oct 2026).
export const metadata: Metadata = {
  title: "Gmail Sending Limits (Gmail & Google Workspace, 2026) | Meerko",
  description: "Gmail and Google Workspace daily sending limits from Google's own help pages, what happens when you hit them, and how to stay under them for cold email.",
  alternates: { canonical: "/guides/gmail-sending-limits" },
};

const sources = [G.gmailLimits, G.workspaceLimits, G.senderGuidelines];
const Cite = citer(sources);

const workspace: [string, string][] = [
  ["Messages per day", "2,000 (1,500 for mail merge; 500 for trial accounts)"],
  ["Recipients per message", "2,000 total, of which at most 500 external"],
  ["Total recipients per day", "10,000 (1,500 for mail merge)"],
  ["External recipients per day", "3,000"],
  ["Unique recipients per day", "3,000, of which 2,000 external (500 external for trial accounts)"],
];

export default function Page() {
  return (
    <GuideShell
      slug="gmail-sending-limits"
      eyebrow="Guide · Deliverability"
      h1="Gmail sending limits"
      description={metadata.description as string}
      lead={
        <p>
          A personal Gmail account is limited at around 500 emails a day; a Google Workspace account at 2,000 messages a day.
          Go over and Gmail blocks sending for up to 24 hours. For cold email, stay far below both.
          <Cite s={G.gmailLimits} />
          <Cite s={G.workspaceLimits} />
        </p>
      }
      toc={[
        ["personal", "Personal Gmail"],
        ["workspace", "Google Workspace"],
        ["hit", "What happens when you hit a limit"],
        ["cold", "Limits for cold email"],
      ]}
      sources={sources}
      faq={[
        ["How many emails can I send per day with Gmail?", "Google's help page describes the limit as more than 500 recipients in a single email, or more than 500 emails sent in a day."],
        ["What is the Google Workspace daily sending limit?", "2,000 messages per day per user, 1,500 for mail merge and 500 for trial accounts, according to Google's Workspace help page."],
        ["How long does the Gmail sending limit last?", "Google says you should be able to send again within 1 to 24 hours; Workspace accounts can be suspended from sending for up to 24 hours."],
      ]}
    >
      <H2 id="personal">Personal Gmail (@gmail.com)</H2>
      <p>
        Google&apos;s help page says the sending limit kicks in when you send an email to a total of more than 500 recipients in a
        single email, or more than 500 emails in a day.<Cite s={G.gmailLimits} />
      </p>

      <H2 id="workspace">Google Workspace</H2>
      <p>Per user, from Google&apos;s Workspace help page:<Cite s={G.workspaceLimits} /></p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-normal">Limit</th>
              <th className="px-5 py-3 font-normal">Google Workspace</th>
            </tr>
          </thead>
          <tbody>
            {workspace.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <th scope="row" className="px-5 py-3.5 font-semibold text-fg">{k}</th>
                <td className="px-5 py-3.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="hit">What happens when you hit a limit</H2>
      <p>
        Gmail returns an error and stops sending. For personal accounts Google says you should be able to send again within 1 to
        24 hours;<Cite s={G.gmailLimits} /> Workspace users can be suspended from sending for up to 24 hours.
        <Cite s={G.workspaceLimits} />
      </p>

      <H2 id="cold">Limits for cold email</H2>
      <p>
        The limits above are ceilings, not targets. Cold email is judged by how recipients react: Google asks all senders to keep
        the spam rate reported in Postmaster Tools below 0.3%,<Cite s={G.senderGuidelines} /> and sending hundreds of cold emails
        a day from one mailbox is the quickest way to cross it.
      </p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>Keep cold volume per mailbox low and steady, and add mailboxes rather than pushing one harder.</li>
        <li>Send on weekdays, inside working hours, with gaps between emails rather than in one burst.</li>
        <li>Set up SPF, DKIM and DMARC first: see <a href="/guides/email-deliverability" className="text-accent hover:underline">email deliverability</a>.</li>
      </ul>
      <p>
        Meerko builds this in: each connected mailbox has a daily limit (50 by default), sends only inside the sequence&apos;s
        weekday window, and spaces emails out instead of sending them at once.
      </p>
    </GuideShell>
  );
}
