import { ArrowUpRight, Bot, Check, Globe } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MeerkoApiError } from "@meerko/sdk";
import { CopyButton } from "@/app/app/settings/dialog";
import { buttonClass, Card, field, monoLabel, Notice, Page, PageHeader } from "@/components/app/ui";
import { SiteChip } from "@/components/app/site-badge";
import { mcpUrl, meerko, SESSION_COOKIE } from "@/lib/meerko";
import { siteHost, siteName } from "@/lib/site-hint";

export const metadata: Metadata = { title: "Your first customers — Meerko", robots: { index: false } };

// "WS3 · Welcome" (G6Hci2) in docs/design/meerko.pen, as a checklist of the three steps below.
// "Your site in, your first customers out". Meerko runs no model of its own: it reads the site, and the person's own
// agent (Claude, ChatGPT…) decides who they sell to and runs the searches, through read_website and the
// first-customers prompt in packages/mcp. Reached from the landing hero's website field.

const agents = [
  ["Claude", "/docs/claude"],
  ["ChatGPT", "/docs/chatgpt"],
  ["Claude Code", "/docs/claude-code"],
  ["Codex & Cursor", "/docs/codex-cursor"],
] as const;

/** What Meerko could read from the site, or why it couldn't. */
async function readSite(site: string) {
  try {
    return { site: await (await meerko()).readWebsite(site) };
  } catch (err) {
    if (err instanceof MeerkoApiError) {
      if (err.status === 401) redirect(`/login?expired=1&next=${encodeURIComponent(`/app/welcome?site=${encodeURIComponent(site)}`)}`);
      return { error: err.message };
    }
    throw err;
  }
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const site = (await searchParams).site?.trim().slice(0, 200) ?? "";
  // Straight from the landing page: sign in (or up) first, then come back here with the site.
  if (!(await cookies()).get(SESSION_COOKIE)?.value) redirect(`/login?next=${encodeURIComponent(site ? `/app/welcome?site=${encodeURIComponent(site)}` : "/app/welcome")}`);

  const read = site ? await readSite(site) : null;
  const host = siteHost(site);
  const prompt = `Use Meerko to find my first customers. My website is ${site || "…"}.`;

  const done = !!read?.site;

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex flex-col items-start gap-3">
            {host && <SiteChip host={host} name={siteName(host)} />}
            Your first customers
          </span>
        }
        meta="Meerko reads your site, your AI works out who buys from you, and Meerko finds 10 of those companies with the person to talk to at each. About two minutes."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,820px)_284px] xl:gap-8">
        <Card className="self-start">
          <div className={step}>
            <Marker n={1} done={done} />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className={stepTitle(done)}>Your website</span>
                <span className={stepSub}>{done ? `${host ?? site} · read` : "Meerko reads it; your AI uses it to work out who you sell to"}</span>
              </div>
              <form method="get" className="flex flex-col gap-2 sm:flex-row">
                <input name="site" defaultValue={site} required inputMode="url" placeholder="yourcompany.com" aria-label="Website" className={`${field} sm:max-w-[360px]`} />
                <button className={buttonClass(site ? "secondary" : "primary")}>{site ? "Read again" : "Read my site"}</button>
              </form>
              {read?.error && <Notice ok={false}>{read.error}</Notice>}
              {read?.site && (
                <div className="flex gap-3 rounded-lg border border-lk-line bg-lk-frame px-3.5 py-3 text-[13px] leading-relaxed">
                  <Globe className="mt-0.5 size-4 shrink-0 text-lk-dim" />
                  <p className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium text-lk-fg">{read.site.title ?? new URL(read.site.url).hostname}</span>
                    {read.site.description && <span className="text-lk-muted">{read.site.description}</span>}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className={step}>
            <Marker n={2} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={stepTitle(false)}>Connect your AI</span>
              <span className={stepSub}>Add Meerko to the assistant you already use; it signs in with this account</span>
              <span className="mt-2 flex flex-wrap gap-1.5 xl:hidden">
                {agents.map(([name, href]) => (
                  <a key={name} href={href} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                    {name} ↗
                  </a>
                ))}
              </span>
            </div>
          </div>

          <div className={step}>
            <Marker n={3} />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <span className={stepTitle(false)}>Ask it</span>
                <span className={stepSub}>10 companies, a decision-maker at each · about 20 credits · emails only when you ask</span>
              </div>
              <div className="flex flex-col gap-3 rounded-lg bg-ws-acc-soft px-3.5 py-3 sm:flex-row sm:items-center">
                <p className="flex min-w-0 flex-1 items-start gap-2.5 font-mono text-[12.5px] leading-relaxed text-lk-fg">
                  <Bot className="mt-0.5 size-4 shrink-0 text-ws-acc-ink" />“{prompt}”
                </p>
                <CopyButton text={prompt} label="Copy the request" done="Copied: paste it into your agent" className={`${buttonClass("lime", "sm")} self-start sm:self-auto`} />
              </div>
              <p className="text-[12.5px] text-lk-dim">It tells you who it thinks your customers are so you can correct it, then saves them to your tables.</p>
            </div>
          </div>
        </Card>

        <aside className="hidden flex-col gap-2 xl:flex">
          <span className={monoLabel}>Setup guides</span>
          <div className="overflow-hidden rounded-lg border border-lk-line bg-white">
            {agents.map(([name, href]) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 border-b border-lk-line px-3.5 py-3 text-[13px] text-lk-fg transition last:border-0 hover:bg-lk-frame"
              >
                {name}
                <ArrowUpRight className="size-3.5 text-lk-dim" />
              </a>
            ))}
          </div>
          <span className={`${monoLabel} mt-3`}>MCP address</span>
          <span className="flex items-center justify-between gap-3 rounded-lg border border-lk-line bg-lk-frame px-3.5 py-2.5">
            <code className="min-w-0 overflow-x-auto font-mono text-[12px] whitespace-nowrap text-lk-fg">{mcpUrl()}</code>
            <CopyButton text={mcpUrl()} />
          </span>
        </aside>

        <div className="flex flex-col gap-2 xl:hidden">
          <span className={monoLabel}>MCP address</span>
          <span className="flex items-center justify-between gap-3 rounded-lg border border-lk-line bg-lk-frame px-3.5 py-2.5">
            <code className="min-w-0 overflow-x-auto font-mono text-[12px] whitespace-nowrap text-lk-fg">{mcpUrl()}</code>
            <CopyButton text={mcpUrl()} />
          </span>
        </div>
      </div>

      <p className="text-[13px] text-lk-muted">
        Rather search yourself?{" "}
        <Link href="/app/leads/find" className="font-semibold text-lk-fg underline-offset-4 hover:underline">
          Find leads →
        </Link>
      </p>
    </Page>
  );
}

const step = "flex gap-3.5 border-b border-lk-line px-5 py-4 last:border-0";
const stepTitle = (done: boolean) => `text-[14px] font-semibold ${done ? "text-lk-muted" : "text-lk-fg"}`;
const stepSub = "font-mono text-[11px] text-lk-dim";

/** The step's number, or a check once it's done. */
function Marker({ n, done = false }: { n: number; done?: boolean }) {
  return done ? (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ws-green-soft text-ws-green">
      <Check className="size-3.5" />
    </span>
  ) : (
    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-lk-line font-mono text-[11px] text-lk-muted">{n}</span>
  );
}
