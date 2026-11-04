import type { Metadata } from "next";
import { citer, GuideShell, H2 } from "@/components/lookout/docs/guide";
import { ftcCanSpam, googleSources as G } from "@/lib/sources";

// Targets "spf dkim dmarc" (1.6k/mo, KD 25), "email warmup" (880, KD 29) and "email deliverability" (1k, KD 44)
// (DataForSEO, US, Oct 2026).
export const metadata: Metadata = {
  title: "Email Deliverability: SPF, DKIM & DMARC Guide | Meerko",
  description: "What Gmail requires from every sender and from bulk senders, how SPF, DKIM and DMARC fit together, warming up a mailbox, and the unsubscribe rules.",
  alternates: { canonical: "/guides/email-deliverability" },
};

const sources = [G.senderGuidelines, ftcCanSpam];
const Cite = citer(sources);

export default function Page() {
  return (
    <GuideShell
      slug="email-deliverability"
      eyebrow="Guide · Deliverability"
      h1="Email deliverability: SPF, DKIM, DMARC and Gmail's rules"
      description={metadata.description as string}
      lead={
        <p>
          To land in the inbox, authenticate your domain (SPF, DKIM and, for bulk senders, DMARC), keep spam complaints low, and
          make unsubscribing easy. Gmail spells these out in its sender guidelines, and they apply to cold email too.
          <Cite s={G.senderGuidelines} />
        </p>
      }
      toc={[
        ["auth", "SPF, DKIM and DMARC"],
        ["all", "Gmail's rules for all senders"],
        ["bulk", "Extra rules for bulk senders"],
        ["warmup", "Warming up a mailbox"],
        ["unsub", "Unsubscribes"],
      ]}
      sources={sources}
      faq={[
        ["Do I need SPF, DKIM and DMARC for cold email?", "Gmail requires SPF or DKIM from every sender, and SPF, DKIM and DMARC from anyone sending 5,000 or more messages a day to Gmail. Setting up all three is the safe default."],
        ["What spam rate does Gmail allow?", "Gmail's sender guidelines ask senders to keep the spam rate reported in Postmaster Tools below 0.3%."],
        ["Do cold emails need an unsubscribe link?", "In the US, CAN-SPAM requires a clear way to opt out of commercial email, honored within 10 business days. Gmail also requires one-click unsubscribe for marketing messages from bulk senders."],
      ]}
    >
      <H2 id="auth">SPF, DKIM and DMARC in one minute</H2>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li><strong className="text-fg">SPF</strong> is a DNS record listing the servers allowed to send email for your domain.</li>
        <li><strong className="text-fg">DKIM</strong> signs each email with a key published in your DNS, so receivers can check it wasn&apos;t forged or changed.</li>
        <li><strong className="text-fg">DMARC</strong> tells receivers what to do when SPF or DKIM fail, and where to send reports.</li>
      </ul>
      <p>
        Gmail sets a minimum DKIM key length of 1024 bits and recommends 2048.<Cite s={G.senderGuidelines} />
      </p>

      <H2 id="all">Gmail&apos;s rules for all senders</H2>
      <p>From Gmail&apos;s email sender guidelines:<Cite s={G.senderGuidelines} /></p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>Set up SPF or DKIM for your sending domain.</li>
        <li>Have valid forward and reverse DNS (PTR) records for your sending IPs.</li>
        <li>Use a TLS connection to send.</li>
        <li>Keep the spam rate reported in Postmaster Tools below 0.3%.</li>
        <li>Format messages to the RFC 5322 standard, and don&apos;t impersonate Gmail From: headers.</li>
      </ul>

      <H2 id="bulk">Extra rules for bulk senders</H2>
      <p>If you send 5,000 or more messages a day to Gmail accounts, Gmail also requires:<Cite s={G.senderGuidelines} /></p>
      <ul className="flex list-disc flex-col gap-1.5 pl-6">
        <li>Both SPF and DKIM, plus DMARC for your sending domain.</li>
        <li>A From: domain aligned with your SPF or DKIM domain.</li>
        <li>One-click unsubscribe for marketing and subscribed messages, with a clearly visible unsubscribe link in the body.</li>
      </ul>

      <H2 id="warmup">Warming up a mailbox</H2>
      <p>
        A new mailbox or domain has no sending history, so start small. Send a handful of emails a day, mostly to people likely to
        reply, and increase volume gradually over a few weeks while you watch replies and bounces. If complaints rise, slow down.
        Keep cold volume per mailbox well under Gmail&apos;s caps: see{" "}
        <a href="/guides/gmail-sending-limits" className="text-accent hover:underline">Gmail sending limits</a>.
      </p>

      <H2 id="unsub">Unsubscribes</H2>
      <p>
        In the US, CAN-SPAM requires a clear way to opt out of commercial email and that you honor opt-outs within 10 business
        days.<Cite s={ftcCanSpam} /> Make it one click, and stop every sequence for that person.
      </p>
      <p>
        Meerko adds a visible unsubscribe link and one-click unsubscribe headers to every sequence email, and an unsubscribe stops
        every sequence in your workspace for that address. What you send still matters most: short, relevant emails and{" "}
        <a href="/guides/cold-email-follow-up" className="text-accent hover:underline">a few well-spaced follow-ups</a>.
      </p>
    </GuideShell>
  );
}
