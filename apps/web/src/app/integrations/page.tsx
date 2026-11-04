import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { LkPage, lead, pageTitle } from "@/components/lookout/kit";
import { IntegrationTile } from "@/components/lookout/marketing/integration-tile";
import { LkBreadcrumbs, wrap } from "@/components/lookout/marketing/ui";
import { INTEGRATION_GROUPS, integrations } from "@/lib/integrations";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Integrations: Claude Code, Gmail, Outlook, Slack & more | Meerko",
  description:
    "Everything Meerko, the open-source AI sales agent, connects to: Claude Code, Cursor and Codex over MCP; Gmail, Outlook and IMAP mailboxes; Icypeas and Firecrawl for lead data; Slack and webhooks.",
  alternates: { canonical: "/integrations" },
};

// From the .pen design "LK · Integrations" (IBLpQ).
export default function IntegrationsHub() {
  return (
    <LkPage>
      <section className={`${wrap} flex flex-col gap-5 pt-10 pb-10 lg:pt-14`}>
        <LkBreadcrumbs items={[["Home", "/"], ["Integrations", "/integrations"]]} />
        <div className="flex flex-col gap-5 pt-6 lg:pt-10">
          <h1 className={pageTitle}>Integrations</h1>
          <p className={`${lead} max-w-[760px]`}>
            Meerko works inside the tools you already use: your coding agent drives it, your own inbox sends, and replies show up where
            you&apos;ll see them. Everything here works today, on Meerko Cloud and self-hosted.
          </p>
        </div>
      </section>

      <div className={`${wrap} flex flex-col gap-14 pt-6 pb-16`}>
        {INTEGRATION_GROUPS.map(({ group, tagline }) => {
          const items = integrations.filter((i) => i.group === group);
          return (
            <section key={group} aria-labelledby={`g-${group}`} className="flex flex-col gap-5 lg:flex-row lg:gap-12">
              <div className="flex flex-col gap-2.5 lg:w-[280px] lg:shrink-0">
                <h2 id={`g-${group}`} className="font-pixel text-[14px] text-lk-lime uppercase">
                  {group}
                </h2>
                <p className="text-[15.5px] leading-[1.6] text-lk-muted">{tagline}</p>
              </div>
              <ul className="min-w-0 flex-1 outline outline-1 -outline-offset-1 outline-lk-line">
                {items.map((i, k) => (
                  <li key={i.slug} className={k ? "border-t border-lk-line" : ""}>
                    <a href={i.href} className="group flex items-center gap-4 px-5 py-[18px] transition hover:bg-lk-box">
                      <IntegrationTile i={i} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="text-[17px] font-semibold text-lk-fg">{i.name}</span>
                          <span className="px-2 py-[3px] font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase outline outline-1 -outline-offset-1 outline-lk-gray">
                            {i.setup}
                          </span>
                        </span>
                        <span className="text-[15px] leading-[1.55] text-lk-muted">{i.summary}</span>
                      </span>
                      <span className="sr-only">{i.page ? "See how it works" : "Read the docs"}</span>
                      <ArrowRight aria-hidden className="size-4 shrink-0 text-lk-dim transition group-hover:translate-x-0.5 group-hover:text-lk-lime" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className={`${wrap} flex flex-col gap-4 pb-24 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase sm:flex-row sm:gap-10`}>
        <a href={`mailto:${site.contactEmail}`} className="hover:text-lk-fg">
          Missing one you need? Tell us →
        </a>
        <a href="/docs/api" className="hover:text-lk-fg">
          Or build it on the API →
        </a>
      </div>
    </LkPage>
  );
}
