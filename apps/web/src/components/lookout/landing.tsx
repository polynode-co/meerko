import Image from "next/image";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";
import { LogoMark } from "../ui/brand";
import { LookoutCommand } from "./copy-command";
import { LimeButton, LkLandscapeFooter, LkNav, Window, kicker, label, sectionTitle } from "./kit";
import { DemoPlayer } from "./demo-player";
import { GtmFaq, OpenSource, Problem, Superpowers, WorksWith } from "./landing-more";

// The landing page from the .pen design "Meerko — Lookout OS (mockup 1)" (node VhHk8).

// ------------------------------------------------------------------ nav + hero

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Image src="/landing/lookout-night.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center md:object-[77%_center]" />
      <div className="absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-b from-lk-bg/0 to-lk-bg" />
      <div className="relative mx-auto max-w-[1440px]">
        <LkNav transparent links={[["Product", "#product"], ["Docs", site.docsUrl], ["Guides", "/guides"], ["Pricing", site.pricingUrl], ["GitHub", site.githubUrl]]} />
        <div className="flex max-w-[688px] flex-col gap-6 px-6 pt-10 lg:max-w-[736px] lg:pt-[72px] lg:pr-0 lg:pl-24">
          <span className={`${label} text-lk-lime`}>● Open source · AGPL-3.0</span>
          <h1 className="font-sans text-[40px] leading-[1.05] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[60px] sm:leading-[62px] sm:tracking-[-2.1px]">
            Always on the lookout <br className="hidden sm:block" />
            for your next customer.
          </h1>
          <p className="max-w-[540px] text-[17px] leading-[26px] text-lk-muted">
            Meerko is the outbound engine for your AI agent. Claude Code, Codex or Cursor does the thinking. Meerko finds the leads, sends
            from your own Gmail or Outlook and catches every reply, around the clock, even when your agent is closed.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <LimeButton href={site.signupUrl}>Start free with 200 credits →</LimeButton>
            <a
              href="/docs/quick-start"
              className={`${label} bg-lk-fg px-4 py-[13px] font-semibold text-lk-ink shadow-[4px_4px_0_var(--color-lk-lime)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_var(--color-lk-lime)]`}
            >
              Connect your agent →
            </a>
          </div>
          <p className="font-plex text-[13px] tracking-[0.5px] text-lk-muted [text-shadow:0_1px_8px_#000]">
            Cloud $49/mo, no seats · Free forever when self-hosted ·{" "}
            <a href="/docs/self-hosting" className="underline-offset-4 hover:text-lk-fg hover:underline">
              AGPL-3.0
            </a>
          </p>
        </div>
        <div className="px-6 pt-16 pb-16 lg:px-[150px] lg:pt-[84px] lg:pb-[72px]">
          <DemoPlayer />
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ how it works

const leads = [
  ["Lucía M.", "Ledgr", "lucia@ledgr.io", "verified"],
  ["Pau R.", "Tallyo", "pau@tallyo.io", "verified"],
  ["Marta G.", "Monea", "marta@monea.app", "verified"],
  ["Jordi S.", "Clearbook", "—", "no email"],
  ["Ana L.", "Fondo", "ana@fondo.dev", "verified"],
];

function LeadsWindow() {
  const row = "flex gap-0 px-1 py-[9px] font-plex text-[11.5px]";
  return (
    <Window title="LEADS — fintech-ctos-es">
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          <div className={`${row} bg-lk-ink text-lk-paper`}>
            <span className="w-[110px]">NAME</span>
            <span className="w-[110px]">COMPANY</span>
            <span className="flex-1">EMAIL</span>
            <span className="w-[110px]">STATUS</span>
          </div>
          {leads.map(([name, company, email, status]) => (
            <div key={name} className={`${row} border-t border-lk-ink text-lk-ink`}>
              <span className="w-[110px]">{name}</span>
              <span className="w-[110px]">{company}</span>
              <span className="flex-1">{email}</span>
              <span className={`w-[110px] ${status === "verified" ? "" : "text-lk-dim"}`}>{status}</span>
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}

const sequence = [
  ["DAY 0", "Intro: ledger reconciliation for Series A teams", "sent 47"],
  ["DAY 3", "Follow-up: a 2-minute teardown of your stack", "sent 41"],
  ["DAY 7", "Last note: worth a call?", "queued"],
];

function SequenceWindow() {
  return (
    <Window title="SEQUENCE — 3 steps">
      {sequence.map(([day, subject, status], i) => (
        <div key={day} className={`flex items-center gap-4 px-1 py-[18px] ${i ? "border-t border-lk-ink" : ""}`}>
          <span className="shrink-0 bg-lk-ink px-2 py-1 font-plex text-[12.5px] text-lk-lime">{day}</span>
          <span className="flex-1 text-[15.5px] text-lk-ink">{subject}</span>
          <span className="shrink-0 font-plex text-[12.5px] text-lk-gray">{status}</span>
        </div>
      ))}
    </Window>
  );
}

function SlackWindow() {
  return (
    <Window title="SLACK — #outbound">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center bg-lk-ink">
          <LogoMark size={24} />
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <span className="font-plex text-[12.5px] text-lk-gray">Meerko APP 14:22</span>
          <p className="text-[15.5px] leading-[21px] text-lk-ink">
            Lucía M. (Ledgr) replied: “Good timing — can we talk Thursday?”
            <br />
            Draft: “Thursday works. 10:00 or 15:00 your time?”
          </p>
          <div className="flex gap-2 pt-1.5">
            <span className="bg-lk-ink px-3.5 py-2 font-plex text-[12.5px] text-lk-lime">Approve &amp; send</span>
            <span className="px-3.5 py-2 font-plex text-[12.5px] text-lk-ink outline-[1.5px] -outline-offset-[0.75px] outline-lk-ink outline">Discard</span>
          </div>
        </div>
      </div>
    </Window>
  );
}

const steps = [
  {
    tag: "Find",
    title: "Leads, enriched and verified.",
    body: "Describe who you sell to. Meerko searches, finds work emails and verifies them. A miss costs nothing.",
    cta: ["Read the docs →", site.docsUrl],
    window: <LeadsWindow />,
  },
  {
    tag: "Send",
    title: "From your own inbox. Never a shared domain.",
    body: "Sequences go out from your Gmail or Outlook, within each mailbox’s daily limit, and stop for a lead the moment they reply.",
    cta: ["See sequences →", "/docs/sequences"],
    window: <SequenceWindow />,
  },
  {
    tag: "Approve",
    title: "Your agent drafts. You press send.",
    body: "When a reply lands, Meerko wakes your agent to draft an answer. Its key can draft, never send. Approve in Slack or the inbox.",
    cta: ["Wake your agent →", "/docs/wake-your-agent"],
    window: <SlackWindow />,
  },
] as const;

function Steps() {
  return (
    <section id="product" className="mx-auto flex max-w-[1440px] scroll-mt-6 flex-col gap-16 px-6 pt-16 pb-24 lg:gap-24 lg:px-36 lg:pb-[120px]">
      <div className="flex flex-col gap-[18px]">
        <span className={kicker}>01 · How it works</span>
        <h2 className={sectionTitle}>Every step is one tool call.</h2>
      </div>
      <ol className="relative flex flex-col gap-16 lg:gap-24">
        {/* the rail that ties the steps together */}
        <span aria-hidden className="absolute top-8 bottom-8 left-[27px] hidden w-0 border-l-2 border-dashed border-lk-gray lg:block" />
        {steps.map((s, i) => (
        <li key={s.tag} className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-[72px] lg:pl-[88px]">
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center bg-lk-lime font-pixel text-[26px] text-lk-ink shadow-[4px_4px_0_#000] lg:absolute lg:top-1/2 lg:left-0 lg:-translate-y-1/2"
          >
            {i + 1}
          </span>
          <div className="flex flex-col items-start gap-[18px] lg:w-[380px] lg:shrink-0">
            <span className="flex items-center gap-3 font-plex text-[14px] tracking-[0.8px] uppercase">
              <span className="text-lk-muted">Step {i + 1} of {steps.length}</span>
              <span className="h-px w-6 bg-lk-line" />
              <span className="bg-lk-lime/10 px-2 py-1 font-semibold text-lk-lime outline outline-1 -outline-offset-1 outline-lk-lime/40">{s.tag}</span>
            </span>
            <h3 className="text-[30px] leading-[1.1] font-semibold tracking-[-1.2px] text-lk-fg sm:text-[36px] sm:leading-10">{s.title}</h3>
            <p className="text-[16px] leading-[26px] text-lk-muted">{s.body}</p>
            <a
              href={s.cta[1]}
              className={`${label} bg-lk-fg px-4 py-3 font-semibold text-lk-ink shadow-[4px_4px_0_var(--color-lk-lime)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_var(--color-lk-lime)]`}
            >
              {s.cta[0]}
            </a>
          </div>
          <div className="min-w-0 flex-1">{s.window}</div>
        </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ pricing

const credits: [string, string, string, boolean?][] = [
  ["612", "found work emails", "8 / each"],
  ["4,900", "leads from search", "1 / each"],
  ["4,900", "email verifications", "1 / each"],
  ["0", "credits to send, catch replies and draft", "always", true],
];

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-6 border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-6 py-24 lg:px-36">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-[18px]">
            <span className={kicker}>04 · Pricing</span>
            <h2 className={sectionTitle}>One flat plan. No seats, no per-mailbox fees.</h2>
          </div>
          <p className="text-[16px] text-lk-muted">$1 = 100 credits. Misses are free. Credits don’t expire.</p>
        </div>
        <div className="flex flex-col bg-lk-box outline outline-1 -outline-offset-1 outline-lk-line lg:flex-row">
          <div className="flex flex-col gap-[22px] border-b border-lk-line p-9 lg:w-[420px] lg:shrink-0 lg:border-r lg:border-b-0">
            <span className="font-pixel text-[14px] text-lk-lime">PRO</span>
            <div className="flex items-end gap-2.5">
              <span className="text-[72px] leading-[72px] font-semibold tracking-[-3px] text-lk-fg">$49</span>
              <span className="pb-1 font-plex text-[13px] text-lk-dim">/ MONTH</span>
            </div>
            {["Unlimited mailboxes", "Sending and reply detection, 24/7", "Your agent woken on every reply", "4,900 credits every month", "Your own provider keys, 0 credits"].map((f) => (
              <span key={f} className="font-plex text-[13.5px] text-lk-muted">
                + {f}
              </span>
            ))}
            <LimeButton href={`${site.signupUrl}?next=${encodeURIComponent("/app/settings#billing")}`} className="text-center">
              Get Pro →
            </LimeButton>
            <span className="text-[15.5px] text-lk-dim">
              Or{" "}
              <a href={site.signupUrl} className="underline-offset-4 hover:text-lk-fg hover:underline">
                start free with 200 credits
              </a>
              .
            </span>
          </div>
          <div className="flex flex-1 flex-col px-6 py-9 sm:px-10">
            <span className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim">WHAT 4,900 CREDITS BUY</span>
            {credits.map(([n, what, cost, free], i) => (
              <div key={what} className={`flex items-center gap-6 py-5 ${i ? "border-t border-lk-line" : ""}`}>
                <span className={`w-[110px] shrink-0 text-[32px] font-semibold tracking-[-1.2px] sm:w-[150px] sm:text-[40px] ${free ? "text-lk-lime" : "text-lk-fg"}`}>{n}</span>
                <span className="flex-1 text-[16px] text-lk-fg">{what}</span>
                <span className="hidden font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase sm:inline">{cost}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 font-plex text-[13px] tracking-[0.8px] text-lk-muted sm:flex-row sm:justify-between">
          <a href="/docs/self-hosting" className="hover:text-lk-fg">
            OR SELF-HOST IT FOR FREE · AGPL-3.0 →
          </a>
          <a href={`mailto:${site.contactEmail}`} className="hover:text-lk-fg">
            VOLUME CREDITS? TALK TO US →
          </a>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ start + footer

function Start() {
  return (
    <section className="flex flex-col items-center gap-5 px-6 pt-20 pb-[120px] text-center">
      <span className={kicker}>07 · Start</span>
      <h2 className={sectionTitle}>Put a meerkat on watch.</h2>
      <p className="text-[17px] text-lk-muted">Connect it to your coding agent in one command.</p>
      <div className="flex w-full max-w-[820px] flex-col gap-5 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,var(--color-lk-frame)_0%,var(--color-lk-ink)_100%)] p-5 text-left outline outline-1 -outline-offset-1 outline-lk-gray sm:p-8">
        <span className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim">IN YOUR TERMINAL</span>
        <LookoutCommand command={`claude mcp add --transport http --scope user meerko ${mcpUrl()}`} />
        <span className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim">OR IN THE BROWSER</span>
        <LimeButton href={site.signupUrl} className="px-[18px] py-4 text-right">
          Start free with 200 credits →
        </LimeButton>
      </div>
    </section>
  );
}

export function LookoutLanding() {
  return (
    <div className="bg-lk-bg text-lk-fg">
      <Hero />
      <main>
        <WorksWith />
        <Steps />
        <Problem n="02" />
        <Superpowers n="03" />
        <Pricing />
        <OpenSource n="05" />
        <GtmFaq n="06" />
        <Start />
      </main>
      <LkLandscapeFooter />
    </div>
  );
}
