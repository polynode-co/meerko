import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { Nav } from "@/components/sections/nav";
import { apiUrl } from "@/lib/meerko";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  // Targets "mcp servers for claude code" (140/mo) and the long tail around it (DataForSEO, Oct 2026).
  title: "Meerko MCP server for Claude Code, Codex & Cursor — setup guide",
  description: "Add the Meerko MCP server to Claude Code, Codex, Cursor or any MCP client: lead search, enrichment, cold email sequences and replies as tools for your agent.",
  alternates: { canonical: "/docs" },
};

const repo = site.githubUrl;
// Pages that aren't written yet link to the README and deploy guide on GitHub (↗).
const sidebar: [string, [string, string][]][] = [
  ["Get started", [["Quick start", `${repo}#quick-start-self-hosted`], ["Meerko Cloud", "/pricing"], ["Self-hosting", `${repo}/blob/main/docs/DEPLOY.md`]]],
  ["Agents", [["Connect your agent", "/docs"], ["Commands", "/docs#commands"]]],
  ["Reference", [["MCP tools", `${repo}#use-from-claude-code-mcp`], ["CLI", `${repo}#cli`]]],
];

const steps = [
  { id: "get-server", title: "Get the MCP server" },
  { id: "api-key", title: "Create an API key" },
  { id: "register", title: "Register it with your agent" },
  { id: "commands", title: "Try a command" },
];

const commands = [
  ["find-leads", "Build a list from your ideal customer, with verified emails."],
  ["write-sequence", "Draft a 3-step sequence for a table and preview it. Nothing starts until you say so."],
  ["triage-replies", "Classify new replies and draft answers for you to approve."],
  ["pipeline", "Counts per stage, how each sequence is doing, and what's waiting on you."],
];

function Step({ n, id, title, children }: { n: number; id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3.5 pt-3">
      <h2 className="flex items-center gap-3 font-display text-[22px] font-bold">
        <span className="grid size-7 place-items-center rounded-full bg-accent-soft font-mono text-[13px] text-accent">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  const register = [
    "claude mcp add meerko \\",
    "    -e MEERKO_API_KEY=mk_… \\",
    `    -e MEERKO_API_URL=${apiUrl()} \\`,
    "    -- npx tsx ~/meerko/packages/mcp/src/index.ts",
  ];
  return (
    <>
      <Nav />
      <div className="mx-auto flex w-full max-w-[1440px] gap-14 px-5 pt-12 pb-24 sm:px-10 lg:px-20">
        <nav aria-label="Docs" className="hidden w-[220px] shrink-0 flex-col gap-7 lg:flex">
          {sidebar.map(([group, items]) => (
            <div key={group} className="flex flex-col gap-1">
              <p className="mb-1 font-mono text-[11px] tracking-[0.15em] text-muted uppercase">{group}</p>
              {items.map(([label, href]) => {
                const on = href === "/docs";
                const external = href.startsWith("http");
                return (
                  <a
                    key={label}
                    href={href}
                    className={`flex items-center justify-between rounded-md px-2.5 py-[7px] text-sm ${on ? "bg-accent-soft font-semibold text-accent" : "hover:text-accent"}`}
                  >
                    {label}
                    {external && <ArrowUpRight className="size-3.5 text-muted" />}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <article className="flex min-w-0 flex-1 flex-col gap-7">
          <p className="flex gap-2 text-[13px] text-muted">
            Docs <span className="text-line">/</span> Agents <span className="text-line">/</span> <span className="text-fg">Connect your agent</span>
          </p>
          <header className="flex flex-col gap-3">
            <h1 className="font-display text-[44px] leading-tight font-bold tracking-[-0.02em]">Add the Meerko MCP server to your agent</h1>
            <p className="text-lg leading-[1.55] text-muted">
              Meerko runs as an MCP server, so any agent that speaks MCP gets the same tools you do: search and enrich leads, run
              sequences from your Gmail and work the replies.
            </p>
          </header>
          <div className="flex gap-3.5 rounded-xl border border-accent/25 bg-accent-soft px-[18px] py-4 text-[15px] leading-normal">
            <Sparkles className="mt-0.5 size-[18px] shrink-0 text-accent" />
            <p>
              Fastest way: click <strong>Copy setup prompt</strong> on the{" "}
              <a href="/#product" className="text-accent underline-offset-2 hover:underline">
                homepage
              </a>{" "}
              and paste it into your agent. It runs these steps for you and asks for your key.
            </p>
          </div>

          <Step n={1} id="get-server" title="Get the MCP server">
            <p className="leading-[1.55] text-muted">Clone the repo somewhere permanent and install it. You need Node 20+ and pnpm.</p>
            <CodeBlock
              title="bash"
              code={`git clone ${repo} ~/meerko\ncd ~/meerko && pnpm install`}
              lines={[{ text: `$ git clone ${repo} ~/meerko` }, { text: "$ cd ~/meerko && pnpm install" }]}
            />
          </Step>
          <Step n={2} id="api-key" title="Create an API key">
            <p className="leading-[1.55] text-muted">
              In the dashboard, open <a href="/app/settings" className="text-fg underline underline-offset-2">Settings → API keys</a> and
              create a key named after this machine or agent. It&apos;s shown once and starts with <code className="font-mono text-fg">mk_</code>.
            </p>
          </Step>
          <Step n={3} id="register" title="Register it with your agent">
            <p className="leading-[1.55] text-muted">
              Claude Code takes one command. For Codex, Cursor, Gemini CLI or Windsurf, add the same command and environment variables
              to that agent&apos;s MCP config.
            </p>
            <CodeBlock title="Claude Code" code={register.join("\n")} lines={register.map((t, i) => ({ text: i === 0 ? `$ ${t}` : t }))} />
          </Step>
          <Step n={4} id="commands" title="Try a command">
            <p className="leading-[1.55] text-muted">
              Ask in plain language, or use a Meerko command. In Claude Code they&apos;re listed as{" "}
              <code className="font-mono text-fg">/mcp__meerko__…</code>. Anything that emails someone waits for your OK.
            </p>
            <CodeBlock
              title="claude"
              lines={[
                { text: "› /mcp__meerko__find-leads heads of growth at Series A fintechs in Spain", tone: "accent" },
                { text: "● meerko.find_people → 50 leads · enrich_rows → 46 verified", tone: "muted" },
              ]}
            />
            <dl className="flex flex-col">
              {commands.map(([cmd, desc]) => (
                <div key={cmd} className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:gap-6">
                  <dt className="font-mono text-sm text-accent sm:w-44 sm:shrink-0">{cmd}</dt>
                  <dd className="text-[15px] text-muted">{desc}</dd>
                </div>
              ))}
            </dl>
          </Step>

          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-raised px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-display text-xl font-bold">No Meerko account yet?</p>
              <p className="text-[15px] text-muted">Start on Meerko Cloud with 1,000 free credits, or self-host it for free.</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <a href={site.pricingUrl} className="rounded-[10px] bg-accent px-5 py-3 font-semibold text-dark hover:brightness-110">
                Get started free
              </a>
              <a href={`${repo}/blob/main/docs/DEPLOY.md`} className="rounded-[10px] border border-line px-5 py-3 font-semibold hover:border-muted">
                Self-host
              </a>
            </div>
          </div>

          <div className="mt-2 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
            <a href={`${repo}/blob/main/docs/DEPLOY.md`} className="flex flex-col gap-1 rounded-xl border border-line px-[18px] py-4 hover:border-muted">
              <span className="font-mono text-xs text-muted">Previous</span>
              <span className="font-semibold">Self-hosting</span>
            </a>
            <a href={`${repo}#cli`} className="flex flex-col items-end gap-1 rounded-xl border border-line px-[18px] py-4 hover:border-muted">
              <span className="font-mono text-xs text-muted">Next</span>
              <span className="font-semibold">CLI</span>
            </a>
          </div>
        </article>

        <aside className="hidden w-[200px] shrink-0 xl:block">
          <div className="sticky top-28 flex flex-col gap-2.5">
            <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">On this page</p>
            {steps.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-[13px] text-muted hover:text-accent">
                {s.title}
              </a>
            ))}
          </div>
        </aside>
      </div>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] justify-between px-5 py-6 text-[13px] text-muted sm:px-10 lg:px-20">
          <span>© 2026 Meerko · AGPL-3.0</span>
          <a href={`${repo}/edit/main/apps/web/src/app/docs/page.tsx`} className="hover:text-fg">
            Edit this page on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
