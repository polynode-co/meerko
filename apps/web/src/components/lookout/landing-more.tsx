import { ArrowRight, Check } from "lucide-react";
import Image from "next/image";
import { alternatives } from "@/lib/content";
import { mcpUrl } from "@/lib/meerko";
import { site } from "@/lib/site";
import { CHECKED_ON, agentDocs, stackPrices } from "@/lib/sources";
import { GitHubIcon } from "../ui/brand";
import { CopyPromptButton } from "./copy-command";
import { kicker, label, sectionTitle, Window } from "./kit";

// The production home page's sections (works-with, the problem, agent superpowers, open source, GTM engineers
// + FAQ), carried over in the Lookout style. Every price and source is the same as before (lib/sources.ts).

const ext = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {});

/** A logo on a small paper tile, so black and coloured marks both read on the night background. */
function Tile({ src, size = 26 }: { src: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center bg-lk-paper" style={{ width: size, height: size }}>
      <Image src={src} alt="" width={Math.round(size * 0.62)} height={Math.round(size * 0.62)} className="object-contain" />
    </span>
  );
}

// ------------------------------------------------------------------ works with

// Only what Meerko integrates with today, grouped by the job each does. Agents link to their own MCP docs;
// the rest to our pages. The full list is /integrations (lib/integrations.ts).
const groups: { label: string; items: [string, string, string][] }[] = [
  {
    label: "Your agent",
    items: [
      ["Claude", "/logos/agents/claude.svg", "/docs/claude"],
      ["ChatGPT", "/logos/agents/openai.svg", "/docs/chatgpt"],
      ["Claude Code", "/logos/agents/claude.svg", agentDocs["Claude Code"]],
      ["Cursor", "/logos/agents/cursor.svg", agentDocs.Cursor],
      ["Codex", "/logos/agents/openai.svg", agentDocs.Codex],
      ["Gemini CLI", "/logos/agents/gemini.svg", agentDocs["Gemini CLI"]],
    ],
  },
  {
    label: "Your inbox",
    items: [
      ["Gmail", "/logos/integrations/gmail.png", "/integrations/gmail"],
      ["Outlook", "/logos/integrations/outlook.png", "/integrations/outlook"],
    ],
  },
  { label: "Your team", items: [["Slack", "/logos/integrations/slack.png", "/docs/slack"]] },
  { label: "Lead data", items: [["Icypeas", "/logos/integrations/icypeas.png", "https://www.icypeas.com"]] },
];

/** "Works with": a panel in the OS-window style, tucked into the bottom of the hero. Logos stay grey until hovered. */
export function WorksWith() {
  return (
    <section aria-label="Works with" className="relative z-10 -mt-4 px-6 pb-6 lg:-mt-6 lg:px-[150px]">
      <div className="mx-auto max-w-[1140px] bg-lk-box/85 outline outline-1 -outline-offset-1 outline-lk-line backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 border-b border-lk-line px-5 py-2.5">
          <span className="font-pixel text-[13px] text-lk-fg">WORKS WITH</span>
          <a href="/integrations" className={`${label} text-lk-lime hover:underline`}>
            All integrations →
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          {groups.map((g, gi) => (
            <div
              key={g.label}
              className={`flex flex-col gap-3.5 px-5 py-5 ${gi ? "border-t border-lk-line md:border-t-0 lg:border-l" : ""} ${gi === 1 ? "md:border-l" : ""} ${gi >= 2 ? "md:border-t lg:border-t-0" : ""} ${gi === 3 ? "md:border-l" : ""}`}
            >
              <span className="font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">{g.label}</span>
              <ul className="flex flex-wrap gap-x-4 gap-y-3">
                {g.items.map(([name, logo, href]) => (
                  <li key={name}>
                    <a href={href} {...ext(href)} className="group flex items-center gap-2.5 text-[15px] font-medium text-lk-muted transition hover:text-lk-fg">
                      <span className="grid size-7 shrink-0 place-items-center bg-lk-paper">
                        <Image
                          src={logo}
                          alt=""
                          width={17}
                          height={17}
                          className="object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
                        />
                      </span>
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ the problem

const total = stackPrices.reduce((sum, s) => sum + s.price, 0);
const usd = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const included = [
  "Tables, enrichment & verification",
  "Sequences from your own Gmail or Outlook",
  "Reply detection & AI drafts",
  "Pipeline to booked meeting",
  "CLI + MCP for your agent",
];

export function Problem({ n }: { n: string }) {
  return (
    <section className="border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-14 px-6 py-24 lg:px-36 lg:py-[120px]">
        <div className="flex max-w-[820px] flex-col gap-[18px]">
          <span className={kicker}>{n} · The problem</span>
          <h2 className={sectionTitle}>Your outbound stack costs {usd(Math.round(total))} a month, and you own none of it.</h2>
          <p className="text-[17px] leading-[1.6] text-lk-muted">
            Four tools, four logins, four bills, glued together with Zapier. Meerko replaces the loop with one open-source engine you can
            run yourself.
          </p>
        </div>

        <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-10">
          <div className="flex w-full flex-1 flex-col">
            <div className="flex flex-col outline outline-1 -outline-offset-1 outline-lk-line">
              {stackPrices.map(({ tool, logo, job, plan, price, url }, i) => (
                <div key={tool} className={`flex items-center gap-4 bg-lk-box px-5 py-4 ${i ? "border-t border-lk-line" : ""}`}>
                  <span className="flex w-[132px] shrink-0 items-center gap-3 sm:w-40">
                    <Tile src={logo} />
                    {/* Tools with a comparison page link to it (lib/content.ts) */}
                    {alternatives.some((a) => a.name === tool) ? (
                      <a href={`/alternatives/${tool.toLowerCase()}`} className="text-[17px] font-semibold text-lk-fg line-through decoration-lk-dim hover:text-lk-lime">
                        {tool}
                      </a>
                    ) : (
                      <span className="text-[17px] font-semibold text-lk-fg line-through decoration-lk-dim">{tool}</span>
                    )}
                  </span>
                  <span className="flex flex-1 flex-col text-[15px] text-lk-muted">
                    {job}
                    <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim">{plan}</span>
                  </span>
                  <a href={url} target="_blank" rel="noopener" className="font-plex text-[15px] text-lk-muted underline decoration-lk-gray underline-offset-4 hover:text-lk-fg">
                    {usd(price)}/mo
                  </a>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-5 py-3">
              <span className="text-[15px] text-lk-muted">Entry-level stack</span>
              <span className="font-plex text-[15px] font-semibold text-lk-fg">{usd(total)}/mo</span>
            </div>
            <p className="px-5 text-[13px] leading-[1.55] text-lk-dim">
              Entry-level paid plans, billed monthly, from each vendor&apos;s pricing page (linked) on {CHECKED_ON}.{" "}
              <a href="/alternatives" className="text-lk-fg underline underline-offset-2 hover:text-lk-lime">
                Compare Meerko with Clay, Apollo and Instantly →
              </a>
            </p>
          </div>

          <ArrowRight className="size-9 shrink-0 rotate-90 text-lk-lime lg:rotate-0" />

          <Window title="MEERKO — one engine" className="w-full flex-1" bodyClassName="flex flex-col gap-5 p-7">
            <ul className="flex flex-col gap-4">
              {included.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[16px]">
                  <span className="grid size-5 shrink-0 place-items-center bg-lk-ink text-lk-lime">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t-[1.5px] border-lk-ink pt-4 font-plex">
              <span className="bg-lk-ink px-2 py-1 text-[14px] font-semibold text-lk-lime">$0 self-hosted</span>
              <span className="text-[13.5px] text-lk-gray">Cloud from $49/mo</span>
            </div>
          </Window>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ agent superpowers

// Slash commands are the MCP server's prompts (packages/mcp); agents list them under the server's name.
const commands = [
  ["/find-leads", "Build a list from your ideal customer."],
  ["/write-sequence", "Draft a 3-step sequence in your voice."],
  ["/triage-replies", "Sort replies and draft answers to approve."],
  ["/pipeline", "See who's interested, booked and won."],
];
// Claude and ChatGPT link to our own setup pages; the coding agents to their MCP docs.
const agents: [string, string][] = [
  ["Claude", "/logos/agents/claude.svg"],
  ["ChatGPT", "/logos/agents/openai.svg"],
  ["Claude Code", "/logos/agents/claude.svg"],
  ["Codex", "/logos/agents/openai.svg"],
  ["Cursor", "/logos/agents/cursor.svg"],
  ["Gemini CLI", "/logos/agents/gemini.svg"],
];
const leads = [
  ["Lucía Ferrer", "Brava Pay", "verified"],
  ["Marc Soler", "Kokoro Finance", "verified"],
  ["Elena Ruiz", "Norte Capital", "found"],
];

/** What an agent does with this prompt: add the hosted MCP server, and get the person signed in. */
function setupPrompt() {
  return `Set up the Meerko MCP server for me. It's a hosted server at ${mcpUrl()} that signs me in with my browser (OAuth); there's nothing to install and no API key.

1. Add it. For Claude Code: claude mcp add --transport http --scope user meerko ${mcpUrl()}
   For another agent, follow its docs for adding a remote (HTTP) MCP server by URL; setup for each is at ${site.url}/docs.
2. Tell me to sign in: in Claude Code, run /mcp, pick meerko and authenticate. My browser opens; I continue with Google and click Allow.
3. Once I'm signed in, check it works by calling the list_tables tool, then show me the Meerko commands: find-leads, write-sequence, triage-replies and pipeline.`;
}

export function Superpowers({ n }: { n: string }) {
  return (
    <section className="border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-24 lg:flex-row lg:gap-[72px] lg:px-36 lg:py-[112px]">
        <div className="order-2 w-full bg-lk-ink shadow-[10px_10px_0_#000] outline outline-1 -outline-offset-1 outline-lk-gray lg:order-1 lg:w-[600px] lg:shrink-0">
          <div className="flex justify-between border-b-[1.5px] border-lk-ink bg-lk-paper px-3 py-[7px] font-plex text-[12.5px] text-lk-ink">
            <span>claude · meerko mcp</span>
            <span>[x]</span>
          </div>
          <div className="flex flex-col gap-[18px] overflow-x-auto px-6 pt-6 pb-[26px] font-plex text-[13.5px] leading-normal text-lk-fg">
            <p className="flex gap-2.5">
              <span className="text-lk-lime">›</span>find 50 heads of growth at Series A fintechs in Spain
            </p>
            <div className="flex flex-col gap-1.5">
              <p className="flex gap-2.5 text-lk-muted">
                <span>●</span>
                <span className="whitespace-nowrap">meerko.find_people(title: &quot;head of growth&quot;, industry: &quot;fintech&quot;)</span>
              </p>
              <div className="grid grid-cols-[140px_160px_auto] pt-1 pl-[22px] whitespace-nowrap">
                {["name", "company", "email"].map((h) => (
                  <span key={h} className="text-lk-dim">
                    {h}
                  </span>
                ))}
                {leads.map(([name, company, email]) => (
                  <span key={name} className="contents">
                    <span>{name}</span>
                    <span>{company}</span>
                    <span className={email === "verified" ? "text-lk-lime" : ""}>{email}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-lk-muted">
              <p className="flex gap-2.5">
                <span className="text-lk-lime">✓</span>Saved 50 leads to &quot;Fintech ES&quot; · 46 verified emails.
              </p>
              <p className="flex gap-2.5">
                <span className="text-lk-lime">→</span>Open in dashboard: <span className="text-lk-fg">Leads › Fintech ES</span>
              </p>
            </div>
          </div>
        </div>

        <div className="order-1 flex w-full flex-1 flex-col gap-9 lg:order-2">
          <div className="flex flex-col gap-[18px]">
            <span className={kicker}>{n} · MCP · works in your agent</span>
            <h2 className={sectionTitle}>Your agent stops when you close it. Meerko doesn&apos;t.</h2>
            <p className="text-[17px] leading-[1.6] text-lk-muted">
              Add Meerko to Claude Code, Codex or Cursor once. Your agent decides who to target, what to write and how to answer. Meerko
              remembers every lead, sends on schedule within each mailbox&apos;s limits, skips anyone already enrolled or unsubscribed, and
              wakes your agent when someone replies.
            </p>
          </div>
          <dl className="flex flex-col">
            {commands.map(([cmd, desc]) => (
              <div key={cmd} className="flex flex-col gap-2 border-b border-lk-line py-3.5 sm:flex-row sm:items-center sm:gap-6">
                <dt className="sm:w-[200px] sm:shrink-0">
                  <code className="bg-lk-box px-2.5 py-1.5 font-plex text-[14px] text-lk-lime outline outline-1 -outline-offset-1 outline-lk-line">{cmd}</code>
                </dt>
                <dd className="text-[16px] leading-snug text-lk-muted">{desc}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-3">
            <p className={`${label} text-lk-dim`}>Works with</p>
            <ul className="flex flex-wrap gap-2">
              {agents.map(([name, logo]) => (
                <li key={name}>
                  <a
                    href={agentDocs[name] ?? `/docs/${name.toLowerCase()}`}
                    {...ext(agentDocs[name] ?? "")}
                    className="flex items-center gap-2 bg-lk-box py-1.5 pr-3.5 pl-1.5 text-[14px] font-medium text-lk-fg outline outline-1 -outline-offset-1 outline-lk-line hover:outline-lk-muted"
                  >
                    <Tile src={logo} size={24} />
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <CopyPromptButton text={setupPrompt()} label="Copy setup prompt" />
            <a href="/docs/claude-code" className={`${label} text-lk-fg hover:text-lk-lime`}>
              Setup guide →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ open source

const stats = [
  ["AGPL-3.0", "License"],
  ["BYOK", "Your keys, no markup"],
  ["Postgres", "Your data, your database"],
];
// The README's self-host steps; the output lines are what the scripts print.
const lines: [string, string][] = [
  ["$ git clone https://github.com/polynode-co/meerko", "text-lk-fg"],
  ["$ cd meerko && pnpm install && cp .env.example .env", "text-lk-fg"],
  ["$ pnpm db:up && pnpm db:migrate", "text-lk-fg"],
  ["Migrations applied.", "text-lk-lime"],
  ['$ pnpm db:seed "My workspace"', "text-lk-fg"],
  ["API key:   mk_••••••••", "text-lk-lime"],
  ["$ pnpm --filter @meerko/api dev", "text-lk-fg"],
  ["Meerko API listening on http://localhost:8787", "text-lk-dim"],
];

export function OpenSource({ n }: { n: string }) {
  return (
    <section className="border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-14 px-6 py-24 lg:flex-row lg:gap-20 lg:px-36 lg:py-[120px]">
        <div className="flex flex-1 flex-col gap-5">
          <span className={kicker}>{n} · Self-host it · Fork it · Own your data</span>
          <h2 className={sectionTitle}>100% open source.</h2>
          <p className="text-[17px] leading-[1.6] text-lk-muted">
            Meerko is AGPL-licensed. Run the whole stack on your own infra, bring your own provider keys and keep every lead, email and
            reply in your Postgres. Or skip the ops and use Meerko Cloud.
          </p>
          <dl className="flex flex-wrap gap-10 pt-3">
            {stats.map(([value, what]) => (
              <div key={what} className="flex flex-col-reverse gap-1">
                <dt className="font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">{what}</dt>
                <dd className="font-pixel text-[24px] text-lk-fg">{value}</dd>
              </div>
            ))}
          </dl>
          <a
            href={site.githubUrl}
            className={`${label} inline-flex w-fit items-center gap-2.5 bg-lk-fg px-4 py-3 font-semibold text-lk-ink shadow-[4px_4px_0_var(--color-lk-lime)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_var(--color-lk-lime)]`}
          >
            <GitHubIcon className="size-[17px]" />
            Star Meerko on GitHub
          </a>
        </div>
        <div className="w-full bg-lk-ink shadow-[10px_10px_0_#000] outline outline-1 -outline-offset-1 outline-lk-gray lg:w-[600px] lg:shrink-0">
          <div className="flex justify-between border-b-[1.5px] border-lk-ink bg-lk-paper px-3 py-[7px] font-plex text-[12.5px] text-lk-ink">
            <span>zsh — self-host</span>
            <span>[x]</span>
          </div>
          <div className="flex flex-col gap-2 overflow-x-auto px-6 py-[22px] font-plex text-[14px] leading-normal">
            {lines.map(([text, color]) => (
              <span key={text} className={`whitespace-pre ${color}`}>
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ GTM engineers + FAQ

export const faqs = [
  [
    "Is Meerko really free?",
    "Yes. The self-hosted edition is AGPL and has every core feature. You only pay data providers directly with your own keys. Meerko Cloud charges credits for data lookups; AI runs in your own agent.",
  ],
  [
    "Why not just give my agent a Gmail and an Icypeas connector?",
    "Your agent forgets between sessions and can't send on a schedule. Meerko keeps the leads, sequences, replies and pipeline in one place, sends within each mailbox's daily limit while your agent is closed, skips unsubscribes and duplicates, and wakes your agent when someone replies.",
  ],
  [
    "Is Meerko an open-source Clay alternative?",
    "For outbound, yes: tables, enrichment and AI columns, plus sending from your own Gmail or Outlook and a reply inbox. The difference is that Meerko is open source, so you can self-host it and keep every row in your own Postgres.",
  ],
  [
    "How do you protect deliverability?",
    "You send from your own mailboxes with daily caps, send windows, jitter and threading. Unsubscribes are honored across every sequence in your workspace.",
  ],
  [
    "Can my AI agent really run campaigns?",
    "Every action is an MCP tool. Replies are drafted for your approval, and the Meerko commands never start a sequence without your OK.",
  ],
  ["Does it work with my CRM?", "Meerko has a light built-in pipeline: new, contacted, replied, meeting, won. CRM sync isn't built yet."],
] as const;

export function GtmFaq({ n }: { n: string }) {
  return (
    <section className="border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-14 px-6 py-24 lg:flex-row lg:gap-20 lg:px-36 lg:py-[120px]">
        <div className="flex flex-col gap-5 lg:w-[460px] lg:shrink-0">
          <span className={kicker}>{n} · Built for GTM engineers</span>
          <h2 className={sectionTitle}>You write code. Your outbound should be code too.</h2>
          <p className="text-[17px] leading-[1.6] text-lk-muted">
            GTM engineers turn go-to-market into systems: data pipelines, enrichment, sequencing, routing. Meerko gives you those
            primitives as an open, scriptable engine — version your plays, test them, and hand them to an agent.
          </p>
          <a href="/guides/gtm-engineer" className={`${label} w-fit text-lk-lime hover:underline`}>
            What is a GTM engineer? Read the guide →
          </a>
        </div>
        <div className="flex flex-1 flex-col border-t border-lk-line">
          {faqs.map(([question, answer], i) => (
            <details key={question} open={i === 0} className="group border-b border-lk-line py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[19px] font-semibold text-lk-fg [&::-webkit-details-marker]:hidden">
                {question}
                <span className="grid size-7 shrink-0 place-items-center font-plex text-[18px] text-lk-lime outline outline-1 -outline-offset-1 outline-lk-gray group-open:bg-lk-lime group-open:text-lk-ink">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="pt-3 pr-12 text-[16px] leading-[1.6] text-lk-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
