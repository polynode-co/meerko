import type { Metadata } from "next";
import { Callout, citer, GuideShell, H2, Sample } from "@/components/lookout/docs/guide";

// Targets "ai sdr" (1.6k/mo, KD 27), "ai sales agent(s)" (1.3k, KD 15), "ai bdr" (720, KD 4), "ai sales assistant" (480),
// "ai agent for sales" (390), "ai sdr software" (320) and "ai sdr tools" (260), KD 7–12 (DataForSEO, US, Nov 2026).
// Vendor facts checked on each vendor's own page, 5 Nov 2026.
export const metadata: Metadata = {
  title: "AI SDR: What It Does, the Main Tools, and How to Run Your Own | Meerko",
  description:
    "What an AI SDR (AI sales agent or AI BDR) does, how 11x, Artisan, AiSDR and Instantly describe theirs, what to check before buying, and how to run the SDR work in Claude or ChatGPT.",
  alternates: { canonical: "/guides/ai-sdr" },
};

const elevenX = { label: "11x: Outbound (Alice)", url: "https://www.11x.ai/outbound" };
const elevenXHome = { label: "11x: Home", url: "https://www.11x.ai/" };
const artisan = { label: "Artisan: AI sales agent (Ava)", url: "https://www.artisan.co/ai-sales-agent" };
const artisanFull = { label: "Artisan: llms-full.txt (product and pricing summary)", url: "https://www.artisan.co/llms-full.txt" };
const aisdr = { label: "AiSDR: Pricing", url: "https://aisdr.com/pricing/" };
const instantlySdr = { label: "Instantly: AI SDR", url: "https://instantly.ai/ai-sdr" };
const senderGuidelines = { label: "Google Workspace Admin Help: Email sender guidelines", url: "https://support.google.com/a/answer/81126" };
const sources = [elevenX, elevenXHome, artisan, artisanFull, aisdr, instantlySdr, senderGuidelines];
const Cite = citer(sources);

const jobs: [string, string][] = [
  ["Research", "Read a prospect's company, role and recent news to find a reason to write."],
  ["List building", "Search people and companies that match your ideal customer profile (ICP)."],
  ["Contact data", "Find each person's work email and check that it exists before sending."],
  ["Writing", "Draft a first email and two or three follow-ups, personalised per person."],
  ["Sending", "Send the steps on a schedule, within the daily limits of the mailbox."],
  ["Replies", "Notice replies, sort them (interested, not now, unsubscribe), stop the sequence and answer."],
  ["Booking", "Turn an interested reply into a meeting on someone's calendar."],
];

const th = "px-4 py-3 font-normal";
const td = "px-4 py-3.5 align-top";

export default function Page() {
  return (
    <GuideShell
      slug="ai-sdr"
      eyebrow="Guide · AI agents"
      h1="AI SDR: what it does and how to choose one"
      description={metadata.description as string}
      lead={
        <p>
          An AI SDR is software that does a sales development rep&apos;s outbound work: finding prospects, writing to them,
          following up and handling replies. You can buy it as a hosted product that runs on its own, or run the same work in
          your own AI assistant with tools that do the sending and watch the inbox. The second keeps you in control of the
          copy and every email that goes out.
        </p>
      }
      toc={[
        ["what", "What an AI SDR does"],
        ["models", "Two ways to run one"],
        ["tools", "AI SDR tools compared"],
        ["checklist", "What to check before buying"],
        ["meerko", "Run it in Claude or ChatGPT"],
      ]}
      sources={sources}
      faq={[
        [
          "What is the difference between an AI SDR and an AI BDR?",
          "Mostly the name. SDR (sales development rep) and BDR (business development rep) are both early-funnel outbound roles, and vendors use the terms interchangeably: Artisan calls Ava an AI BDR, others say AI SDR or AI sales agent.",
        ],
        [
          "Can an AI SDR replace a human SDR?",
          "It can take over the repetitive parts: list building, finding emails, sending follow-ups and sorting replies. Choosing who to target, judging what a good message is and having the sales conversation still benefit from a person, which is why approval steps matter.",
        ],
        [
          "Is it safe to let an AI send cold email?",
          "Only with limits. Send from a warmed-up mailbox within its daily limits, verify addresses so you don't bounce, honour unsubscribes and keep spam complaints low; Google asks bulk senders to stay below a 0.3% spam rate. With Meerko, nothing goes to a real person until you approve it.",
        ],
        [
          "How much does an AI SDR cost?",
          "It varies by vendor and many don't publish prices. AiSDR lists $1.50 per person prospected on its pay-as-you-go plan. Meerko has a free plan with 200 credits and a $49/month Pro plan; your AI assistant subscription is separate.",
        ],
      ]}
    >
      <H2 id="what">What an AI SDR does</H2>
      <p>
        A human SDR spends most of the day on the same seven jobs. An AI SDR, AI BDR or AI sales agent is any setup where
        software does some or all of them:
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[520px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className={th}>Job</th>
              <th className={th}>What it involves</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(([k, v]) => (
              <tr key={k} className="border-t border-line">
                <th scope="row" className={`${td} font-semibold text-fg`}>{k}</th>
                <td className={td}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Some of these are thinking (research, targeting, writing) and some are plumbing (data lookups, scheduled sends, an
        inbox watched around the clock). Large language models are good at the first kind. The second kind needs a service
        that keeps running when your chat window is closed.
      </p>

      <H2 id="models">Two ways to run one</H2>
      <p>
        <strong className="text-fg">1. A hosted, autonomous AI SDR.</strong> You describe your offer and audience, connect a
        domain or mailboxes, and the vendor&apos;s agent finds leads, writes, sends and replies. Instantly, for example,
        describes its AI SDR as &quot;fully autonomous&quot;, managing &quot;the entire sequence so reps focus on
        closing.&quot;<Cite s={instantlySdr} /> The appeal is that it runs without you. The cost is that the vendor&apos;s
        model writes in your name, often from infrastructure it manages, with whatever guardrails it chose.
      </p>
      <p>
        <strong className="text-fg">2. Your own assistant, with outbound tools.</strong> You keep using Claude, ChatGPT or a
        coding agent for the thinking, and connect it to a server that does the plumbing: lead search, email finding, sending
        from your mailbox, reply detection. This is how Meerko works. Your assistant proposes the list and the copy; you
        approve; Meerko sends and watches for replies.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[600px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className={th}>Trade-off</th>
              <th className={th}>Hosted autonomous AI SDR</th>
              <th className={th}>Your assistant + tools</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Control", "The vendor's agent decides wording and timing within settings you choose.", "You see and approve the list, the copy and each reply before it goes out."],
              ["Cost", "A platform price on top of what you already pay for AI.", "Your existing assistant plus usage-priced data and sending."],
              ["Deliverability", "Often sent from domains or mailboxes the vendor sets up.", "Sent from your own mailbox, within its limits."],
              ["Brand risk", "An unattended model can send an off-tone or wrong email to a real buyer.", "Nothing reaches a real person without your OK."],
              ["Effort", "Low once set up.", "You spend a few minutes approving; the waiting and sending run on their own."],
            ].map(([k, a, b]) => (
              <tr key={k} className="border-t border-line">
                <th scope="row" className={`${td} font-semibold text-fg`}>{k}</th>
                <td className={td}>{a}</td>
                <td className={td}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2 id="tools">AI SDR tools compared</H2>
      <p>
        Here is how four well-known AI SDR products describe themselves on their own sites, checked on 5 November 2026. We
        only list a price where the vendor publishes one; &quot;not stated&quot; means we couldn&apos;t find it on the page,
        not that the feature is missing.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-[15px]">
          <thead className="bg-raised font-mono text-xs tracking-[0.08em] text-muted uppercase">
            <tr>
              <th className={th}>Product</th>
              <th className={th}>What the vendor says it does</th>
              <th className={th}>Human approval</th>
              <th className={th}>Pricing on the vendor&apos;s site</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <th scope="row" className={`${td} font-semibold text-fg`}>11x (Alice)</th>
              <td className={td}>
                Researches each contact and company, writes &quot;for that one contact&quot; and sequences across email, social
                and rep-led calls. Uses your CRM or its database of 400M contacts. Agents answer replies and escalate sensitive
                ones to your team.<Cite s={elevenX} />
              </td>
              <td className={td}>Not stated for outbound messages; sensitive replies are escalated.<Cite s={elevenX} /></td>
              <td className={td}>Not published; the site offers a demo call.<Cite s={elevenXHome} /></td>
            </tr>
            <tr className="border-t border-line">
              <th scope="row" className={`${td} font-semibold text-fg`}>Artisan (Ava)</th>
              <td className={td}>
                &quot;An autonomous AI BDR&quot; that runs outbound end to end: finds and enriches leads from 250M+ contacts,
                runs email campaigns sent from your own domains in your reps&apos; names, and handles replies.
                <Cite s={artisanFull} />
              </td>
              <td className={td}>Says it works &quot;with human-in-the-loop controls&quot;.<Cite s={artisan} /></td>
              <td className={td}>Credit-based plans, scoped to lead volume, mailboxes and dialer seats.<Cite s={artisanFull} /></td>
            </tr>
            <tr className="border-t border-line">
              <th scope="row" className={`${td} font-semibold text-fg`}>AiSDR</th>
              <td className={td}>
                Email and LinkedIn sequences, 2B+ profiles with live signals, bounce checks and warm-up, a unified inbox with AI
                reply classification.<Cite s={aisdr} />
              </td>
              <td className={td}>Not stated.</td>
              <td className={td}>
                Pay as you go: $1.50 per person prospected, no monthly fee. Team plans: volume-based, billed monthly with
                quarterly contracts.<Cite s={aisdr} />
              </td>
            </tr>
            <tr className="border-t border-line">
              <th scope="row" className={`${td} font-semibold text-fg`}>Instantly (AI SDR)</th>
              <td className={td}>
                Pulls prospects from a verified B2B database, writes emails per prospect, sends &quot;across rotating inboxes at
                scale&quot;, qualifies replies and routes meetings to your calendar.<Cite s={instantlySdr} />
              </td>
              <td className={td}>Not stated; the page stresses autonomy.<Cite s={instantlySdr} /></td>
              <td className={td}>Not listed: the AI SDR page links to the general pricing page, which doesn&apos;t name the agent.<Cite s={instantlySdr} /></td>
            </tr>
            <tr className="border-t border-line">
              <th scope="row" className={`${td} font-semibold text-fg`}>Meerko</th>
              <td className={td}>
                Tools for your own assistant: people and company search, email finding and verification, sequences from your
                Gmail, Outlook or IMAP mailbox, 24/7 reply detection, reply drafts and a pipeline. Your assistant writes.
              </td>
              <td className={td}>Always: sequences start and replies go out only when you approve.</td>
              <td className={td}>
                Free: $0, 200 credits. Pro: $49/month, 4,900 credits. <a href="/pricing" className="text-accent hover:underline">Pricing</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2 id="checklist">What to check before buying</H2>
      <ul className="flex list-disc flex-col gap-2 pl-6">
        <li>
          <strong className="text-fg">Whose domain sends.</strong> If the emails come from your domain, its reputation is on
          the line; if from the vendor&apos;s lookalike domains, ask who owns them when you leave. Either way, Google asks
          senders to keep the spam rate in Postmaster Tools below 0.3%, and bulk senders to authenticate with SPF, DKIM and
          DMARC.<Cite s={senderGuidelines} /> Our <a href="/guides/email-deliverability" className="text-accent hover:underline">deliverability guide</a> and{" "}
          <a href="/guides/gmail-sending-limits" className="text-accent hover:underline">Gmail sending limits</a> cover the details.
        </li>
        <li>
          <strong className="text-fg">An approval step.</strong> Can you review the first emails, or every email? Can you turn
          off fully automatic replies? &quot;Human in the loop&quot; can mean anything from a weekly report to a per-email
          approval.
        </li>
        <li>
          <strong className="text-fg">The data source.</strong> Where do contacts come from, and are emails verified before
          sending? Bounces hurt your sender reputation; Google suggests cutting volume when messages start bouncing.
          <Cite s={senderGuidelines} />
        </li>
        <li>
          <strong className="text-fg">Contract length and pricing model.</strong> Per contact, per credit, per seat or a flat
          fee; monthly or a quarterly or annual commitment. AiSDR, for example, bills team plans monthly on quarterly
          contracts.<Cite s={aisdr} />
        </li>
        <li>
          <strong className="text-fg">Who owns the data.</strong> Can you export leads, sequences and replies if you switch?
        </li>
      </ul>

      <H2 id="meerko">Run it in Claude or ChatGPT</H2>
      <p>
        If you already pay for Claude or ChatGPT, you can run the SDR work there. Connect Meerko once (
        <a href="/docs/claude" className="text-accent hover:underline">Claude setup</a>,{" "}
        <a href="/docs/chatgpt" className="text-accent hover:underline">ChatGPT setup</a>, or{" "}
        <a href="/docs/claude-code" className="text-accent hover:underline">Claude Code</a>), connect your mailbox, and ask in
        plain language:
      </p>
      <Sample title="1 · Build the list">
        {"› Find 40 VPs of Sales at B2B SaaS companies in the UK with 50–200 employees, put them in a table called \"UK SaaS\" and find their work emails."}
      </Sample>
      <Sample title="2 · Write and preview">
        {"› Write a 3-step sequence for \"UK SaaS\": a short first email and two follow-ups 3 and 7 days later. Show me a preview for two people. Don't start it."}
      </Sample>
      <Sample title="3 · Start, then handle replies">
        {"› Start the sequence from my Gmail. Later: go through new replies, label them, and draft answers for the interested ones so I can approve them."}
      </Sample>
      <p>
        Behind each prompt are Meerko&apos;s tools: <a href="/docs/finding-leads" className="text-accent hover:underline">finding leads</a>,{" "}
        <a href="/docs/emails" className="text-accent hover:underline">emails</a>,{" "}
        <a href="/docs/sequences" className="text-accent hover:underline">sequences</a> and{" "}
        <a href="/docs/replies" className="text-accent hover:underline">replies</a>. Need copy to start from? Use the{" "}
        <a href="/guides/cold-email-templates" className="text-accent hover:underline">cold email templates</a>.
      </p>
      <Callout>
        <p>
          A found email costs 8 credits and a verification 1; sending, reply detection and drafts are free, and lookups that
          find nothing cost nothing. On Pro you can use your own provider keys for 0 credits.
        </p>
      </Callout>
    </GuideShell>
  );
}
