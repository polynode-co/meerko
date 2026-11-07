import { Bot, Globe } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MeerkoApiError } from "@meerko/sdk";
import { CopyPromptButton } from "@/components/lookout/copy-command";
import { CopyText } from "@/components/lookout/docs/toc";
import { buttonClass, Card, CardHead, field, fieldLabel, Notice, Page, PageHeader } from "@/components/app/ui";
import { SiteIcon } from "@/components/app/site-badge";
import { mcpUrl, meerko, SESSION_COOKIE } from "@/lib/meerko";
import { siteHost, siteName } from "@/lib/site-hint";

export const metadata: Metadata = { title: "Your first customers — Meerko", robots: { index: false } };

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

  return (
    <Page>
      <PageHeader
        eyebrow="Welcome"
        title={
          host ? (
            <span className="flex items-center gap-3">
              <SiteIcon host={host} name={siteName(host)} size={30} />
              First customers for {siteName(host)}
            </span>
          ) : (
            "Your first customers"
          )
        }
        meta="Meerko reads your site, your AI works out who buys from you, and Meerko finds 10 of those companies with the person to talk to at each. About two minutes."
      />

      <Card className="max-w-[880px]">
        <CardHead title="1 · Your website" />
        <div className="flex flex-col gap-4 p-[18px]">
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className={fieldLabel}>Website</span>
              <input name="site" defaultValue={site} required inputMode="url" placeholder="yourcompany.com" className={field} />
            </label>
            <button className={buttonClass(site ? "secondary" : "primary")}>{site ? "Read again" : "Read my site"}</button>
          </form>
          {read?.error && <Notice ok={false}>{read.error}</Notice>}
          {read?.site && (
            <div className="flex gap-3 text-[15px] leading-relaxed">
              <Globe className="mt-1 size-4 shrink-0 text-lk-lime" />
              <p className="flex flex-col gap-1">
                <span className="font-semibold text-lk-fg">{read.site.title ?? new URL(read.site.url).hostname}</span>
                {read.site.description && <span className="text-lk-muted">{read.site.description}</span>}
                <span className="text-[14px] text-lk-dim">Meerko read it. Your AI will use it to work out who you sell to.</span>
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="max-w-[880px]">
        <CardHead title="2 · Connect your AI" />
        <div className="flex flex-col gap-4 p-[18px] text-[15px] leading-relaxed text-lk-muted">
          <p>Meerko works inside the assistant you already use. Add it once; it signs in with this account.</p>
          <div className="flex flex-wrap gap-2">
            {agents.map(([name, href]) => (
              <a key={name} href={href} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                {name} →
              </a>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Meerko&apos;s MCP address</span>
            <span className="flex items-center justify-between gap-4 px-4 py-3 outline outline-1 -outline-offset-1 outline-lk-line">
              <code className="min-w-0 overflow-x-auto font-plex text-[14px] whitespace-nowrap text-lk-fg">{mcpUrl()}</code>
              <CopyText text={mcpUrl()} className="shrink-0 text-lk-muted" />
            </span>
          </div>
        </div>
      </Card>

      <Card className="max-w-[880px]">
        <CardHead title="3 · Ask it" />
        <div className="flex flex-col gap-4 p-[18px] text-[15px] leading-relaxed text-lk-muted">
          <p className="flex items-start gap-3 text-lk-fg">
            <Bot className="mt-1 size-4 shrink-0 text-lk-lime" />“{prompt}”
          </p>
          <div>
            <CopyPromptButton text={prompt} label="Copy the request" />
          </div>
          <p className="text-[14px] text-lk-dim">
            It reads your site, tells you who it thinks your customers are so you can correct it, then saves 10 companies and a
            decision-maker at each to your tables. About 20 credits; emails only when you ask.
          </p>
        </div>
      </Card>

      <p className="max-w-[880px] text-[15px] text-lk-muted">
        Rather search yourself?{" "}
        <Link href="/app/leads/find" className="text-lk-lime underline-offset-4 hover:underline">
          Find leads →
        </Link>
      </p>
    </Page>
  );
}
