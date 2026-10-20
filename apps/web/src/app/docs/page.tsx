import { ArrowRight, Cloud, FileText, KeyRound, Mail, MailCheck, Plug, Reply, Search, Send, Server, Table2, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { DocsSearch } from "@/components/docs/search";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { GitHubIcon } from "@/components/ui/brand";
import { Container } from "@/components/ui/primitives";
import { cli, mcp, searchEntries, toolGroups } from "@/lib/docs";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Meerko docs: MCP server, CLI and self-hosting",
  description: "Set up the Meerko MCP server in Claude Code, Codex or Cursor, self-host Meerko, and look up every MCP tool and CLI command.",
  alternates: { canonical: "/docs" },
};

const paths = [
  { icon: Cloud, title: "Meerko Cloud", body: "Sign in, connect Gmail and add Meerko to your agent with one command. New workspaces start with 200 free credits.", cta: "Quick start", href: "/docs/quick-start", main: true },
  { icon: Server, title: "Self-host", body: "Run the API, the worker, the web app and Postgres yourself, with your own provider keys. AGPL-3.0.", cta: "Self-hosting guide", href: "/docs/self-hosting" },
  { icon: Plug, title: "Connect your agent", body: "Add the hosted MCP server to Claude Code, Codex, Cursor or any MCP client, and sign in with your browser.", cta: "Connect Claude Code", href: "/docs/claude-code" },
];

const concepts = [
  { icon: Table2, title: "Tables", body: "Leads live in rows. AI columns are answered by your agent, row by row.", href: "/docs/tables" },
  { icon: Search, title: "Find leads", body: "Search people and companies straight into a table.", href: "/docs/finding-leads" },
  { icon: MailCheck, title: "Emails", body: "Find work emails and verify them before you send.", href: "/docs/emails" },
  { icon: Send, title: "Sequences", body: "Send from your own Gmail, in the same thread, inside a send window.", href: "/docs/sequences" },
  { icon: Reply, title: "Replies", body: "Sort replies by intent and approve the answers your agent drafts.", href: "/docs/replies" },
  { icon: Trophy, title: "Pipeline", body: "Leads move to contacted and replied on their own; you mark meetings and wins.", href: "/docs/pipeline" },
];

const terminal = [`pnpm meerko tables create "Fintech CTOs Spain"`, "pnpm meerko tables import <tableId> leads.csv", "pnpm meerko sequences preview <sequenceId>", "pnpm meerko replies ls", "pnpm meerko --json credits"];

export default function DocsHub() {
  return (
    <>
      <Nav />
      <main>
        <Container className="flex flex-col gap-[18px] pt-7 pb-12">
          <Breadcrumbs items={[["Home", "/"], ["Docs", "/docs"]]} />
          <p className="pt-10 font-mono text-[13px] tracking-[0.15em] text-accent uppercase">Docs</p>
          <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-[-0.03em] lg:text-[64px]">Run Meerko from your agent</h1>
          <p className="max-w-[720px] text-lg leading-[1.55] text-muted lg:text-[19px]">
            Set it up, learn how tables, sequences and replies fit together, and look up every MCP tool and CLI command.
          </p>
          <div className="max-w-[720px] pt-1">
            <DocsSearch entries={searchEntries()} size="lg" />
          </div>
        </Container>

        <Container className="flex flex-col gap-5 pb-14">
          <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Start here</p>
          <div className="grid gap-[18px] md:grid-cols-3">
            {paths.map(({ icon: Icon, title, body, cta, href, main }) => (
              <a
                key={title}
                href={href}
                className={`group flex flex-col gap-3 rounded-2xl border p-6 ${main ? "border-accent/35 bg-accent-soft" : "border-line bg-raised hover:border-muted"}`}
              >
                <span className={`grid size-10 place-items-center rounded-[10px] ${main ? "bg-accent text-ink" : "bg-accent-soft text-accent"}`}>
                  <Icon className="size-5" />
                </span>
                <span className="font-display text-[22px] font-bold">{title}</span>
                <span className="flex-1 text-[15px] leading-[1.55] text-muted">{body}</span>
                <span className="inline-flex items-center gap-1.5 pt-1.5 font-semibold text-accent">
                  {cta} <ArrowRight className="size-[15px] transition group-hover:translate-x-0.5" />
                </span>
              </a>
            ))}
          </div>
        </Container>

        <section className="border-y border-line bg-raised">
          <Container className="flex flex-col gap-8 py-14">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div className="flex flex-col gap-2">
                <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Concepts</p>
                <h2 className="font-display text-4xl font-bold tracking-[-0.02em]">How Meerko works</h2>
              </div>
              <p className="max-w-[400px] text-[15px] leading-normal text-muted">One loop, from an empty table to a booked meeting. Each step has its own page.</p>
            </div>
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-0">
              {concepts.map(({ icon: Icon, title, body, href }, i) => (
                <li key={title} className="lg:pr-5">
                  <a href={href} className="group flex flex-col gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-ink text-accent transition group-hover:border-accent group-hover:bg-accent group-hover:text-ink">
                        <Icon className="size-4" />
                      </span>
                      {i < concepts.length - 1 && <span className="hidden h-px flex-1 bg-line lg:block" />}
                    </span>
                    <span className="font-mono text-[11px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[17px] font-semibold group-hover:text-accent">{title}</span>
                    <span className="text-sm leading-normal text-muted">{body}</span>
                  </a>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <Container className="flex flex-col gap-8 pt-16 pb-14">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs tracking-[0.15em] text-muted uppercase">Reference</p>
              <h2 className="font-display text-4xl font-bold tracking-[-0.02em]">Every tool and command</h2>
            </div>
            <p className="max-w-[400px] text-[15px] leading-normal text-muted">Generated from the code, so it matches what Meerko actually does.</p>
          </div>
          <div className="grid gap-[18px] lg:grid-cols-2">
            <a href="/docs/mcp-tools" className="flex flex-col gap-4 rounded-2xl border border-line bg-raised p-[26px] hover:border-muted">
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold">MCP tools</span>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-xs text-accent">
                  {mcp.tools.length} tools · {mcp.prompts.length} commands
                </span>
              </span>
              <span className="text-[15px] leading-normal text-muted">
                What your agent can call: tables and rows, lead search and enrichment, mailboxes, sequences, replies and drafts, pipeline and credits.
              </span>
              <span className="flex flex-col">
                {toolGroups.slice(0, 5).map((g) => (
                  <span key={g.id} className="flex gap-3.5 border-t border-line py-2.5">
                    <span className="w-28 shrink-0 text-sm font-semibold">{g.label}</span>
                    <span className="font-mono text-[12.5px] leading-normal text-muted">{g.tools.slice(0, 4).join(" · ")}</span>
                  </span>
                ))}
              </span>
            </a>
            <a href="/docs/cli" className="flex flex-col gap-4 rounded-2xl border border-line bg-raised p-[26px] hover:border-muted">
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold">CLI</span>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 font-mono text-xs text-accent">{cli.commands.length} commands · --json</span>
              </span>
              <span className="text-[15px] leading-normal text-muted">The same features from your terminal or scripts. Add --json to any command for machine-readable output.</span>
              <span className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-ink px-[18px] py-4 font-mono text-[13px]">
                {terminal.map((l) => (
                  <span key={l}>$ {l}</span>
                ))}
              </span>
            </a>
          </div>
        </Container>

        <Container className="grid gap-x-[18px] pb-20 md:grid-cols-3">
          {[
            { icon: KeyRound, title: "API keys", body: "For scripts and self-hosted servers without Google sign-in. Agents sign in with the browser.", href: "/docs/api-keys" },
            { icon: FileText, title: "Edit these docs", body: "Every page is in the repo. Spot something wrong? Open a pull request.", href: `${site.githubUrl}/tree/main/apps/web/src/app/docs` },
            { icon: Mail, title: "Ask on GitHub", body: "Questions and bugs go to GitHub issues, where the answers stay findable.", href: `${site.githubUrl}/issues`, github: true },
          ].map(({ icon: Icon, title, body, href, github }) => (
            <a key={title} href={href} className="group flex gap-3.5 border-t border-line py-[18px]">
              {github ? <GitHubIcon className="mt-0.5 size-[18px] shrink-0 text-accent" /> : <Icon className="mt-0.5 size-[18px] shrink-0 text-accent" />}
              <span className="flex flex-col gap-1">
                <span className="font-semibold group-hover:text-accent">{title}</span>
                <span className="text-sm leading-normal text-muted">{body}</span>
              </span>
            </a>
          ))}
        </Container>
      </main>
      <Footer />
    </>
  );
}
