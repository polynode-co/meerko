import { FileText, KeyRound, Mail } from "lucide-react";
import type { Metadata } from "next";
import { LkFooter, LkNav, kicker, lead, pageTitle, sectionTitle } from "@/components/lookout/kit";
import { LkBreadcrumbs } from "@/components/lookout/docs/breadcrumbs";
import { DocsSearch } from "@/components/lookout/docs/search";
import { GitHubIcon } from "@/components/ui/brand";
import { apiOperations } from "@/lib/api-reference";
import { cli, docBySlug, mcp, searchEntries, toolGroups } from "@/lib/docs";
import { site } from "@/lib/site";

// The docs home from the .pen design "LK · Docs home" (ScLSm).

export const metadata: Metadata = {
  title: "Meerko docs: MCP server, CLI and self-hosting",
  description: "Set up the Meerko MCP server in Claude Code, Codex or Cursor, self-host Meerko, and look up every MCP tool and CLI command.",
  alternates: { canonical: "/docs" },
};

const paths = [
  { title: "Meerko Cloud", body: "Sign in, connect your mailbox and add Meerko to your agent with one command. New workspaces start with 200 free credits.", cta: "Quick start", href: "/docs/quick-start", main: true },
  { title: "Self-host", body: "Run the API, the worker, the web app and Postgres yourself, with your own provider keys. AGPL-3.0.", cta: "Self-hosting guide", href: "/docs/self-hosting" },
  { title: "Connect your agent", body: "Add the hosted MCP server to Claude Code, Codex, Cursor or any MCP client, and sign in with your browser.", cta: "Connect Claude Code", href: "/docs/claude-code" },
];

const concepts = [
  { title: "Tables", body: "Leads live in rows. AI columns are answered by your agent, row by row.", href: "/docs/tables" },
  { title: "Find leads", body: "Search people and companies straight into a table.", href: "/docs/finding-leads" },
  { title: "Emails", body: "Find work emails and verify them before you send.", href: "/docs/emails" },
  { title: "Sequences", body: "Send from your own Gmail or Outlook, in the same thread, inside a send window.", href: "/docs/sequences" },
  { title: "Replies", body: "Sort replies by intent and approve the answers your agent drafts.", href: "/docs/replies" },
  { title: "Pipeline", body: "Leads move to contacted and replied on their own; you mark meetings and wins.", href: "/docs/pipeline" },
];

const terminal = [`pnpm meerko tables create "Fintech CTOs Spain"`, "pnpm meerko tables import <tableId> leads.csv", "pnpm meerko sequences preview <sequenceId>", "pnpm meerko replies ls", "pnpm meerko --json credits"];

const section = "mx-auto max-w-[1440px] px-6 lg:px-36";
const sectionLead = "max-w-[640px] text-[17px] leading-[28px] text-lk-muted";
const box = "bg-lk-box outline outline-1 -outline-offset-1 outline-lk-line";
const chip = "font-plex text-[12.5px] tracking-[0.6px] uppercase";
const codeBox = "flex flex-col gap-1.5 bg-lk-ink px-3.5 py-3 font-plex text-[13px] leading-[1.5] [overflow-wrap:anywhere] outline outline-1 -outline-offset-1 outline-lk-gray";

export default function DocsHub() {
  const api = docBySlug("api");
  return (
    <div className="min-h-dvh bg-lk-bg text-lk-fg">
      <LkNav />
      <main>
        <section className={`${section} flex flex-col gap-5 pt-14 pb-16 lg:pt-24`}>
          <LkBreadcrumbs items={[["Home", "/"], ["Docs", "/docs"]]} />
          <span className={`${kicker} pt-4`}>Docs</span>
          <h1 className={`${pageTitle} max-w-[900px]`}>Run Meerko from your agent</h1>
          <p className={`${lead} max-w-[640px]`}>Set it up, learn how tables, sequences and replies fit together, and look up every MCP tool and CLI command.</p>
          <div className="max-w-[720px] pt-2">
            <DocsSearch entries={searchEntries()} size="lg" />
          </div>
        </section>

        <section className={`${section} flex flex-col gap-5`}>
          <h2 className="font-plex text-[13px] tracking-[0.8px] text-lk-dim uppercase">Start here</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {paths.map(({ title, body, cta, href, main }) => (
              <a
                key={title}
                href={href}
                className={`group flex flex-col gap-3.5 p-7 transition ${main ? "bg-lk-paper text-lk-ink shadow-[8px_8px_0_#000] outline outline-1 -outline-offset-1 outline-lk-fg hover:bg-lk-paper-hi" : `${box} hover:outline-lk-gray`}`}
              >
                <span className={`font-pixel text-[15px] ${main ? "text-lk-ink" : "text-lk-lime"}`}>{title}</span>
                <span className={`flex-1 text-[16px] leading-[26px] ${main ? "text-[#3a3a40]" : "text-lk-muted"}`}>{body}</span>
                <span className={`${chip} pt-1 font-semibold ${main ? "text-lk-ink" : "text-lk-fg"}`}>
                  {cta} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className={`${section} flex flex-col gap-7 pt-20 pb-10 lg:pt-24`}>
          <span className={kicker}>Concepts</span>
          <h2 className={sectionTitle}>How Meerko works</h2>
          <p className={sectionLead}>One loop, from an empty table to a booked meeting. Each step has its own page.</p>
          <ol className="grid pt-3 sm:grid-cols-2 lg:grid-cols-6">
            {concepts.map(({ title, body, href }, i) => (
              <li key={title} className="-mt-px -ml-px flex">
                <a href={href} className="group flex flex-1 flex-col gap-3 p-5 outline outline-1 -outline-offset-1 outline-lk-line transition hover:bg-lk-box">
                  <span aria-hidden className="grid size-8 place-items-center bg-lk-lime font-pixel text-[15px] text-lk-ink">
                    {i + 1}
                  </span>
                  <span className="text-[18px] leading-[29px] font-semibold tracking-[-0.6px] text-lk-fg">{title}</span>
                  <span className="flex-1 text-[15px] leading-[1.55] text-lk-muted">{body}</span>
                  <span className={`${chip} text-lk-dim group-hover:text-lk-lime`}>Read →</span>
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${section} flex flex-col gap-7 pt-16 pb-14 lg:pt-[72px]`}>
          <span className={kicker}>Reference</span>
          <h2 className={sectionTitle}>Every tool and command</h2>
          <p className={sectionLead}>Generated from the code, so it matches what Meerko actually does.</p>
          <div className="grid gap-6 lg:grid-cols-3">
            <a href="/docs/mcp-tools" className={`${box} flex min-w-0 flex-col gap-3.5 p-7 transition hover:outline-lk-gray`}>
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[22px] leading-[28px] font-semibold tracking-[-0.6px]">MCP tools</span>
                <span className={`${chip} text-lk-lime`}>
                  {mcp.tools.length} tools · {mcp.prompts.length} commands
                </span>
              </span>
              <span className="text-[16px] leading-[26px] text-lk-muted">
                What your agent can call: tables and rows, lead search and enrichment, mailboxes, sequences, replies and drafts, pipeline and credits.
              </span>
              <span className="flex flex-col">
                {toolGroups.slice(0, 5).map((g) => (
                  <span key={g.id} className="flex flex-col gap-1 border-t border-lk-line py-2.5">
                    <span className="w-28 shrink-0 text-[15px] font-semibold">{g.label}</span>
                    <span className="min-w-0 font-plex text-[12.5px] leading-normal break-words text-lk-lime">{g.tools.slice(0, 4).join(" · ")}</span>
                  </span>
                ))}
              </span>
            </a>
            <a href="/docs/cli" className={`${box} flex min-w-0 flex-col gap-3.5 p-7 transition hover:outline-lk-gray`}>
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[22px] leading-[28px] font-semibold tracking-[-0.6px]">CLI</span>
                <span className={`${chip} text-lk-lime`}>{cli.commands.length} commands · --json</span>
              </span>
              <span className="text-[16px] leading-[26px] text-lk-muted">The same features from your terminal or scripts. Add --json to any command for machine-readable output.</span>
              <span className={codeBox}>
                {terminal.map((l) => (
                  <span key={l} className="text-lk-lime">
                    $ {l}
                  </span>
                ))}
              </span>
            </a>
            <a href="/docs/api" className={`${box} flex min-w-0 flex-col gap-3.5 p-7 transition hover:outline-lk-gray`}>
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[22px] leading-[28px] font-semibold tracking-[-0.6px]">{api.title}</span>
                <span className={`${chip} text-lk-lime`}>{apiOperations.length} endpoints</span>
              </span>
              <span className="text-[16px] leading-[26px] text-lk-muted">{api.description}</span>
              <span className={codeBox}>
                {apiOperations.slice(0, 5).map((o) => (
                  <span key={o.id} className="text-lk-lime">
                    {o.method} {o.path}
                  </span>
                ))}
              </span>
            </a>
          </div>
        </section>

        <section className={`${section} grid gap-x-6 pb-24 md:grid-cols-3`}>
          {[
            { icon: KeyRound, title: "API keys", body: "For scripts and self-hosted servers without Google or email sign-in. Agents sign in with the browser.", href: "/docs/api-keys" },
            { icon: FileText, title: "Edit these docs", body: "Every page is in the repo. Spot something wrong? Open a pull request.", href: `${site.githubUrl}/tree/main/apps/web/src/app/docs` },
            { icon: Mail, title: "Ask on GitHub", body: "Questions and bugs go to GitHub issues, where the answers stay findable.", href: `${site.githubUrl}/issues`, github: true },
          ].map(({ icon: Icon, title, body, href, github }) => (
            <a key={title} href={href} className="group flex gap-3.5 border-t border-lk-line py-[18px]">
              {github ? <GitHubIcon className="mt-1 size-[18px] shrink-0 text-lk-lime" /> : <Icon className="mt-1 size-[18px] shrink-0 text-lk-lime" />}
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-lk-fg group-hover:text-lk-lime">{title}</span>
                <span className="text-[15px] leading-[1.55] text-lk-muted">{body}</span>
              </span>
            </a>
          ))}
        </section>
      </main>
      <LkFooter />
    </div>
  );
}
