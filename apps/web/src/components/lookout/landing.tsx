import { ArrowDown, ArrowRight, Bot, Check, CircleCheck, Mail, Repeat, Reply, Zap } from "lucide-react";
import Image from "next/image";
import { mcpUrl } from "@/lib/meerko";
import { proPlan, proPrices } from "@/lib/pricing";
import { site } from "@/lib/site";
import { LogoMark } from "../ui/brand";
import { LookoutCommand } from "./copy-command";
import { LimeButton, LkLandscapeFooter, LkNav, PaperButton, Window, label } from "./kit";
import { VideoPlayer } from "./video-player";

// The landing page from the .pen design "Landing v2.1": a centred hero one screen tall, the video, five short
// sections (how it works, the loop, approval, the pipeline shape, own or rent), then the start panel and footer.

const eyebrow = "font-plex text-[11px] tracking-[0.8px] text-lk-dim uppercase sm:text-[13px]";
const title = "text-[28px] leading-[1.1] font-semibold tracking-[-0.9px] text-lk-fg sm:text-[44px] sm:tracking-[-1.5px]";
const section = "mx-auto flex max-w-[1440px] flex-col gap-7 px-5 pt-[72px] lg:gap-12 lg:px-36 lg:pt-[120px]";
const chip = "bg-lk-bg/80 px-2.5 py-1.5 font-plex text-[11px] font-semibold tracking-[1.5px] text-lk-fg uppercase sm:text-[12.5px]";

function Head({ n, name, children, id }: { n: string; name: string; children: React.ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <span className={eyebrow}>
        {n} · {name}
      </span>
      <h2 id={id} className={`${title} max-w-[900px]`}>
        {children}
      </h2>
    </div>
  );
}

// The video's length, said two ways from the one number in lib/site.ts: "Watch · 30 seconds" and "0:30".
const watch = `Watch · ${site.demoVideoSeconds} seconds`;
const clock = `${Math.floor(site.demoVideoSeconds / 60)}:${String(site.demoVideoSeconds % 60).padStart(2, "0")}`;

// ------------------------------------------------------------------ hero

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-var(--lk-nav-h))] flex-col overflow-hidden">
      {/* The night scene sits along the bottom; the copy reads over a shade that fades into it. */}
      <div className="absolute inset-x-0 bottom-0 h-[254px] md:h-auto md:aspect-[1584/672] md:min-h-[58%]">
        {/* On a phone the strip is the page's largest paint, so `sizes` asks for a light file: pixel art survives it. */}
        <Image src="/landing/lookout-night.jpg" alt="" fill priority sizes="(min-width: 768px) 100vw, 60vw" className="object-cover object-right md:object-[80%_center] xl:object-center" />
      </div>
      <div aria-hidden className="absolute inset-x-0 top-0 h-[71%] bg-[linear-gradient(to_bottom,rgb(10_10_11/0.95),rgb(10_10_11/0.7)_60%,rgb(10_10_11/0))]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[100px] bg-gradient-to-b from-lk-bg/0 to-lk-bg" />

      <div className="relative mx-auto flex w-full max-w-[920px] flex-col items-center gap-5 px-5 pt-[30px] pb-[110px] text-center lg:gap-[26px] lg:pt-[52px] lg:pb-[130px]">
        <div className="flex items-center gap-2.5 lg:gap-3.5">
          <span className="lg:hidden">
            <LogoMark size={48} />
          </span>
          <span className="hidden lg:block">
            <LogoMark size={68} />
          </span>
          <span className="font-pixel text-[26px] tracking-[2px] text-lk-fg lg:text-[38px] lg:tracking-[2.7px]">MEERKO</span>
        </div>
        <span className="font-plex text-[11px] tracking-[0.8px] text-lk-lime uppercase lg:text-[13px]">● Open source · AGPL-3.0</span>
        <h1 className="text-[38px] leading-[1.1] font-semibold tracking-[-1.2px] text-lk-fg sm:text-[52px] lg:text-[68px] lg:leading-[1.06] lg:tracking-[-2.3px]">
          The outbound engine <br className="hidden sm:block" />
          for your AI agent.
        </h1>
        <p className="max-w-[760px] text-[15.5px] leading-[1.55] text-lk-muted lg:text-[17px]">
          Meerko finds the leads, sends from your own inbox and catches every reply, around the clock.
        </p>
        {/* Your site in, your first 10 customers out (/app/welcome, after sign-up). A plain GET form: no JS needed. */}
        <form action="/app/welcome" method="get" className="flex w-full max-w-[600px] flex-col gap-2.5 sm:flex-row sm:gap-0 sm:shadow-[4px_4px_0_#000]">
          <label htmlFor="hero-site" className="sr-only">
            Your website
          </label>
          <input
            id="hero-site"
            name="site"
            required
            inputMode="url"
            autoComplete="url"
            placeholder="yourcompany.com"
            className="h-[52px] w-full min-w-0 shrink-0 bg-lk-bg/80 sm:w-auto sm:flex-1 px-4 font-plex text-[14px] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray placeholder:text-lk-dim focus:outline-lk-lime"
          />
          <button className={`${label} h-[52px] shrink-0 bg-lk-lime px-5 font-semibold text-lk-bg transition hover:brightness-110`}>Find my first customers →</button>
        </form>
        {/* Small print over the dithered horizon, on a dark highlight that hugs the text so it stays readable. */}
        <p className="font-plex text-[11px] leading-[1.7] text-lk-fg/90 sm:text-[13px]">
          <span className="bg-lk-bg/75 box-decoration-clone px-1.5 py-[2px]">
            200 free credits · Cloud ${proPrices.month}/mo ·{" "}
            <a href="/docs/self-hosting" className="underline-offset-4 hover:text-lk-lime hover:underline">
              Free self-hosted
            </a>
            <span className="hidden sm:inline"> · </span>
            <br className="sm:hidden" />
            <a href="/docs/quick-start" className="underline-offset-4 hover:text-lk-lime hover:underline">
              Connect your agent →
            </a>
          </span>
        </p>
      </div>

      <a href="#watch" className={`${chip} absolute bottom-[30px] left-1/2 -translate-x-1/2 whitespace-nowrap transition hover:text-lk-lime lg:bottom-10`}>
        ↓ {watch}
      </a>
    </section>
  );
}

// ------------------------------------------------------------------ video

function Video() {
  const src = site.demoVideoUrl || undefined;
  return (
    <section id="watch" aria-labelledby="watch-title" className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 px-5 pt-16 text-center lg:gap-5 lg:px-16 lg:pt-24">
      <span className="font-plex text-[11px] font-semibold tracking-[1.5px] text-lk-lime uppercase lg:text-[13px]">{watch}</span>
      <h2 id="watch-title" className="max-w-[760px] text-[26px] leading-[1.15] font-semibold tracking-[-0.5px] text-lk-fg lg:text-[40px] lg:tracking-[-0.8px]">
        See Meerko catch a reply while your agent is closed.
      </h2>
      <div className="w-full max-w-[960px] pt-3 lg:pt-5">
        <VideoPlayer src={src} poster="/landing/lookout-night.jpg" duration={clock} title="Meerko catches a reply while your agent is closed" />
      </div>
      <div className="flex max-w-[680px] flex-col gap-1 pt-2.5 text-[14px] leading-normal lg:pt-3.5 lg:text-[15px]">
        <p className="text-lk-dim">A real run with demo data: a reply lands, Meerko wakes your agent, its draft waits for you.</p>
        <a href={site.signupUrl} className="text-lk-lime underline-offset-4 hover:underline">
          Try it on your own leads →
        </a>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 01 how it works

const steps: { name: string; text: string; window: string; rows: [string, string][] }[] = [
  {
    name: "Find",
    text: "Verified leads from one sentence.",
    window: "LEADS",
    rows: [
      ["Lucía M. · Ledgr", "verified"],
      ["Pau R. · Tallyo", "verified"],
      ["Ana L. · Fondo", "verified"],
    ],
  },
  {
    name: "Send",
    text: "Sequences from your own Gmail or Outlook.",
    window: "SEQUENCE",
    rows: [
      ["DAY 0 · Intro", "sent"],
      ["DAY 3 · Follow-up", "sent"],
      ["DAY 7 · Last note", "queued"],
    ],
  },
  {
    name: "Approve",
    text: "Your agent drafts every reply. You press send.",
    window: "REPLIES",
    rows: [
      ["Lucía M. · interested", "draft ready"],
      ["Marta G. · question", "draft ready"],
      ["Pau R. · not now", "closed"],
    ],
  },
];

function HowItWorks() {
  return (
    <section id="product" aria-labelledby="how-title" className={section}>
      <Head n="01" name="How it works" id="how-title">
        Find. Send. Approve.
      </Head>
      <ol className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        {steps.map((s, i) => (
          <li key={s.name} className="flex flex-col gap-[18px]">
            <h3 className="flex items-center gap-3">
              <span className="grid size-[30px] place-items-center bg-lk-lime font-plex text-[14px] font-semibold text-lk-bg">{i + 1}</span>
              <span className="font-pixel text-[16px] tracking-[1px] text-lk-fg uppercase">{s.name}</span>
            </h3>
            <p className="text-[17px] leading-[1.4] text-lk-fg lg:min-h-[54px] lg:text-[19px]">{s.text}</p>
            <Window title={s.window} bodyClassName="p-3.5">
              <ul>
                {s.rows.map(([cell, status], r) => (
                  <li key={cell} className={`flex items-center justify-between gap-3 py-2 font-plex ${r < s.rows.length - 1 ? "border-b border-lk-ink/15" : ""}`}>
                    <span className="text-[12.5px] text-lk-ink">{cell}</span>
                    <span className="text-[12px] text-lk-ink/60">{status}</span>
                  </li>
                ))}
              </ul>
            </Window>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ------------------------------------------------------------------ 02 the loop

type Tone = "plain" | "lime" | "solid";
const nodes: { name: string; text: string; tone: Tone; icon: React.ReactNode }[] = [
  { name: "Your agent", text: "Picks who to target and what to say", tone: "plain", icon: <Bot aria-hidden className="size-6" strokeWidth={1.75} /> },
  { name: "Meerko", text: "Finds the leads, runs the sequence", tone: "lime", icon: <LogoMark size={26} /> },
  { name: "Your inbox", text: "Sends from Gmail or Outlook", tone: "plain", icon: <Mail aria-hidden className="size-6" strokeWidth={1.75} /> },
  { name: "A reply lands", text: "Caught around the clock", tone: "lime", icon: <Reply aria-hidden className="size-6 text-lk-lime" strokeWidth={1.75} /> },
  { name: "Agent wakes", text: "Drafts an answer", tone: "plain", icon: <Zap aria-hidden className="size-6" strokeWidth={1.75} /> },
  { name: "You approve", text: "One click, then it sends", tone: "solid", icon: <CircleCheck aria-hidden className="size-6" strokeWidth={1.75} /> },
];
const box: Record<Tone, string> = {
  plain: "bg-lk-box text-lk-fg outline-lk-line",
  lime: "bg-lk-box text-lk-fg outline-lk-lime",
  solid: "bg-lk-lime text-lk-bg outline-lk-lime",
};
const nodeName: Record<Tone, string> = { plain: "text-lk-dim", lime: "text-lk-lime", solid: "text-lk-bg" };

// Where each chip leads: our own setup page for that agent, mailbox or channel.
const worksWith: [string, [string, string][]][] = [
  ["Works in", [["Claude", "/docs/claude"], ["ChatGPT", "/docs/chatgpt"], ["Claude Code", "/docs/claude-code"], ["Cursor", "/docs/codex-cursor"], ["Codex", "/docs/codex-cursor"]]],
  ["Sends from", [["Gmail", "/integrations/gmail"], ["Outlook", "/integrations/outlook"]]],
  ["Approve in", [["Slack", "/docs/slack"]]],
];

function Loop() {
  return (
    <section aria-labelledby="loop-title" className={section}>
      <Head n="02" name="The loop" id="loop-title">
        Works in Claude or ChatGPT. Sends from your own inbox.
      </Head>
      <ol className="flex flex-col xl:flex-row xl:items-stretch">
        {nodes.map((n, i) => (
          <li key={n.name} className={`flex flex-col xl:flex-row xl:items-center ${i ? "xl:flex-[198_1_0]" : "xl:flex-[164_1_0]"}`}>
            {i > 0 && (
              <span aria-hidden className="grid h-[30px] place-items-center text-lk-lime xl:h-auto xl:w-[34px] xl:shrink-0">
                <ArrowDown className="size-[18px] xl:hidden" />
                <ArrowRight className="hidden size-[18px] xl:block" />
              </span>
            )}
            <div className={`flex items-center gap-3.5 p-3.5 outline outline-1 -outline-offset-1 xl:min-h-[158px] xl:flex-1 xl:flex-col xl:items-start xl:gap-3 xl:self-stretch xl:p-4 ${box[n.tone]}`}>
              <span className="grid size-[26px] shrink-0 place-items-center xl:place-items-start">{n.icon}</span>
              <span className="flex flex-col gap-1.5">
                <span className={`font-plex text-[11px] font-semibold tracking-[0.8px] uppercase ${nodeName[n.tone]}`}>{n.name}</span>
                <span className="text-[14px] leading-[1.35]">{n.text}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="flex items-center justify-center gap-2.5 border border-dashed border-lk-gray px-4 py-[11px] font-plex text-[10.5px] tracking-[0.8px] text-lk-muted uppercase sm:text-[12px]">
        <Repeat aria-hidden className="size-3.5 shrink-0 text-lk-lime" />
        <span>
          <span className="hidden sm:inline">Repeats for every lead · </span>24/7, even with your agent closed
        </span>
      </p>
      <dl className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:gap-x-10">
        {worksWith.map(([group, items]) => (
          <div key={group} className="flex flex-wrap items-center gap-2.5">
            <dt className="font-plex text-[11px] tracking-[0.8px] text-lk-dim uppercase">{group}</dt>
            {items.map(([name, href]) => (
              <dd key={name}>
                <a href={href} className="block px-[9px] py-[5px] text-[13.5px] leading-[1.2] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-line transition hover:outline-lk-lime">
                  {name}
                </a>
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
}

// ------------------------------------------------------------------ 03 you approve

const checks = ["The agent's key can draft, never send", "Approve in Slack or the inbox", "A sequence stops the moment a lead replies"];

function Approve() {
  return (
    <section aria-labelledby="approve-title" className={`${section} lg:flex-row lg:items-center lg:gap-[72px]`}>
      <div className="flex flex-col gap-6 lg:w-[460px] lg:shrink-0 lg:gap-8">
        <Head n="03" name="You stay in control" id="approve-title">
          Nothing sends until you approve.
        </Head>
        <ul className="flex flex-col gap-3.5">
          {checks.map((c) => (
            <li key={c} className="flex items-start gap-3 text-[16px] leading-[1.35] text-lk-fg lg:text-[17px]">
              <Check aria-hidden className="mt-[3px] size-[18px] shrink-0 text-lk-lime" />
              {c}
            </li>
          ))}
        </ul>
      </div>
      {/* What the approval looks like in Slack: the reply, the agent's draft, and the two buttons. A picture, not a control. */}
      <div className="min-w-0 lg:flex-1">
        <Window title="SLACK — #OUTBOUND" bodyClassName="flex gap-3.5 p-3.5 lg:p-[22px]">
          <span aria-hidden className="size-[34px] shrink-0 bg-lk-ink" />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="font-plex text-[12px] text-lk-ink/60">Meerko&nbsp; APP&nbsp; 14:22</span>
            <p className="text-[14.5px] leading-[1.4] text-lk-ink lg:text-[16px]">Lucía M. (Ledgr) replied: “Good timing, can we talk Thursday?”</p>
            <div className="flex flex-col gap-1 border-l-[1.5px] border-lk-ink bg-lk-ink/[0.07] px-3 py-2.5">
              <span className="font-plex text-[10.5px] tracking-[0.8px] text-lk-ink/60 uppercase">Draft by your agent</span>
              <p className="text-[14.5px] leading-[1.4] text-lk-ink lg:text-[16px]">“Thursday works. 10:00 or 15:00 your time?”</p>
            </div>
            <div aria-hidden className="flex flex-wrap gap-2 pt-1.5 font-plex text-[12.5px]">
              <span className="bg-lk-ink px-3.5 py-[9px] text-lk-lime">Approve &amp; send</span>
              <span className="px-3.5 py-[9px] text-lk-ink outline outline-1 -outline-offset-1 outline-lk-ink">Discard</span>
            </div>
          </div>
        </Window>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 04 pipeline

// The shape of a pipeline, not measurements: each bar is a share of the first one, picked for the picture.
const funnel: [stage: string, note: string, share: number, bar: string][] = [
  ["Leads found", "searched from your ideal customer", 0.672, "bg-lk-gray"],
  ["Emails verified", "a miss costs nothing", 0.565, "bg-lk-dim"],
  ["Sent", "from your own mailbox", 0.525, "bg-lk-fg"],
  ["Replies", "each one wakes your agent", 0.094, "bg-lk-lime"],
];

function Pipeline() {
  return (
    <section aria-labelledby="pipeline-title" className={section}>
      <Head n="04" name="Pipeline" id="pipeline-title">
        From lead to reply, in one place.
      </Head>
      <div className="flex flex-col gap-[18px] bg-lk-box p-[18px] outline outline-1 -outline-offset-1 outline-lk-line sm:gap-3.5 sm:p-8">
        <ol className="flex flex-col gap-[18px] sm:gap-3.5">
          {funnel.map(([stage, note, share, bar]) => (
            <li key={stage} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 sm:flex sm:gap-4" style={{ "--share": share } as React.CSSProperties}>
              <span className="font-plex text-[11px] font-semibold tracking-[0.8px] text-lk-fg uppercase sm:w-[150px] sm:shrink-0 sm:text-[12px]">{stage}</span>
              <span className="text-right text-[12.5px] leading-[1.2] text-lk-dim sm:order-3 sm:text-left sm:text-[14px]">{note}</span>
              <span aria-hidden className={`col-span-2 h-[22px] w-[calc(100%*var(--share)*1.46)] sm:order-2 sm:h-[34px] sm:w-[calc((100%-166px)*var(--share))] sm:shrink-0 ${bar}`} />
            </li>
          ))}
        </ol>
        <p className="font-plex text-[10.5px] tracking-[0.8px] text-lk-dim uppercase">Illustrative shape, not real data</p>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 05 own it or rent it

const plan = "flex flex-col gap-[18px] bg-lk-box p-5 outline outline-1 -outline-offset-1 lg:gap-[22px] lg:p-8";
const planName = "font-plex text-[12px] font-semibold tracking-[0.8px] text-lk-lime uppercase";
const amount = "text-[48px] leading-none font-semibold tracking-[-2px] text-lk-fg lg:text-[64px]";
const per = "pb-2 font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase";

function Lines({ items }: { items: string[] }) {
  return (
    <>
      {items.map((line) => (
        <li key={line} className="flex items-start gap-2.5 text-[16px] leading-[1.35] text-lk-fg">
          <Check aria-hidden className="mt-[3px] size-4 shrink-0 text-lk-lime" />
          {line}
        </li>
      ))}
    </>
  );
}

function OwnOrRent() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className={section}>
      <div className="flex flex-col gap-3 lg:gap-4">
        <Head n="05" name="Open source · Pricing" id="pricing-title">
          Own it or rent it.
        </Head>
        <p className="text-[15.5px] leading-normal text-lk-muted lg:text-[17px]">Same engine either way. No seats, no per-mailbox fees.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
        <div className={`${plan} outline-lk-gray`}>
          <h3 className={planName}>Self-host</h3>
          <p className="flex items-end gap-2.5">
            <span className={amount}>$0</span>
            <span className={per}>Forever · AGPL-3.0</span>
          </p>
          <ul className="flex flex-col gap-2.5">
            <Lines items={["Your infra, your Postgres", "Your own provider keys, no markup"]} />
            <li className="overflow-x-auto bg-lk-bg px-2.5 py-2 font-plex text-[11px] leading-normal whitespace-nowrap text-lk-fg outline outline-1 -outline-offset-1 outline-lk-line sm:text-[12.5px]">
              $ git clone {site.githubUrl.replace("https://", "")}
            </li>
          </ul>
          <PaperButton href={site.githubUrl} className="mr-1 text-center">
            Star Meerko on GitHub
          </PaperButton>
          <p className="text-[14px] leading-[1.3] text-lk-dim">
            Every core feature included.{" "}
            <a href="/docs/self-hosting" className="underline underline-offset-4 hover:text-lk-fg">
              Self-hosting guide
            </a>
          </p>
        </div>
        <div className={`${plan} outline-lk-lime`}>
          <h3 className={planName}>Cloud Pro</h3>
          <p className="flex items-end gap-2.5">
            <span className={amount}>${proPrices.month}</span>
            <span className={per}>/ month</span>
          </p>
          <ul className="flex flex-col gap-2.5">
            <Lines items={["Unlimited mailboxes", "Sending and reply detection, 24/7", proPlan.sub]} />
          </ul>
          <LimeButton href={proPlan.href} className="text-center">
            {proPlan.cta} →
          </LimeButton>
          <p className="text-[14px] leading-[1.3] text-lk-dim">
            Or{" "}
            <a href={site.signupUrl} className="underline underline-offset-4 hover:text-lk-fg">
              start free with 200 credits
            </a>
            .{" "}
            <a href={site.pricingUrl} className="underline underline-offset-4 hover:text-lk-fg">
              Full pricing
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ 06 start + footer

function Start() {
  return (
    <section aria-labelledby="start-title" className="flex flex-col items-center gap-3.5 px-5 pt-[72px] text-center lg:gap-5 lg:pt-[120px]">
      <span className={eyebrow}>06 · Start</span>
      <h2 id="start-title" className={title}>
        Put a meerkat on watch.
      </h2>
      <p className="text-[15.5px] text-lk-muted lg:text-[17px]">Connect it to your coding agent in one command.</p>
      <div className="mt-4 flex w-full max-w-[820px] flex-col gap-3.5 bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,var(--color-lk-frame)_0%,var(--color-lk-ink)_100%)] p-5 text-left outline outline-1 -outline-offset-1 outline-lk-gray sm:gap-5 sm:p-8 lg:mt-0">
        <span className="font-plex text-[11px] tracking-[0.8px] text-lk-dim sm:text-[12.5px]">IN YOUR TERMINAL</span>
        <LookoutCommand command={`claude mcp add --transport http --scope user meerko ${mcpUrl()}`} />
        <span className="font-plex text-[11px] tracking-[0.8px] text-lk-dim sm:text-[12.5px]">OR IN THE BROWSER</span>
        <LimeButton href={site.signupUrl} className="px-[18px] py-4 text-center sm:text-right">
          Start free with 200 credits →
        </LimeButton>
      </div>
    </section>
  );
}

export function LookoutLanding() {
  return (
    <div className="bg-lk-bg text-lk-fg">
      <LkNav />
      <main>
        <Hero />
        <Video />
        <HowItWorks />
        <Loop />
        <Approve />
        <Pipeline />
        <OwnOrRent />
        <Start />
      </main>
      <LkLandscapeFooter />
    </div>
  );
}
