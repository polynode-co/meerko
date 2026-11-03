import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/content/breadcrumbs";
import { IntegrationIcon } from "@/components/integrations/integration-icon";
import { Footer } from "@/components/sections/footer";
import { Nav } from "@/components/sections/nav";
import { Container } from "@/components/ui/primitives";
import { INTEGRATION_GROUPS, integrations } from "@/lib/integrations";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Integrations: Claude Code, Gmail, Outlook, Slack & more | Meerko",
  description:
    "Everything Meerko, the open-source AI sales agent, connects to: Claude Code, Cursor and Codex over MCP; Gmail, Outlook and IMAP mailboxes; Icypeas and Firecrawl for lead data; Slack and webhooks.",
  alternates: { canonical: "/integrations" },
};

export default function IntegrationsHub() {
  return (
    <>
      <Nav />
      <main>
        <Container className="flex flex-col gap-12 pt-12 pb-24 lg:pt-16">
          <div className="flex max-w-[720px] flex-col gap-4">
            <Breadcrumbs items={[["Home", "/"], ["Integrations", "/integrations"]]} />
            <h1 className="pt-4 font-display text-5xl leading-[1.04] font-bold tracking-[-0.03em]">Integrations</h1>
            <p className="text-lg leading-[1.55] text-muted">
              Meerko works inside the tools you already use: your coding agent drives it, your own inbox sends, and replies show up where
              you&apos;ll see them. Everything here works today, on Meerko Cloud and self-hosted.
            </p>
          </div>

          {INTEGRATION_GROUPS.map(({ group, tagline }) => {
            const items = integrations.filter((i) => i.group === group);
            return (
              <section key={group} className="flex flex-col gap-5" aria-labelledby={`g-${group}`}>
                <div className="flex flex-col gap-1">
                  <h2 id={`g-${group}`} className="font-display text-[28px] font-bold tracking-[-0.02em]">{group}</h2>
                  <p className="text-muted">{tagline}</p>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((i) => (
                    <li key={i.slug}>
                      <a href={i.href} className="group flex h-full flex-col gap-4 rounded-[14px] border border-line bg-raised p-[22px] hover:border-muted">
                        <span className="flex items-center justify-between gap-3">
                          <IntegrationIcon i={i} />
                          <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted">{i.setup}</span>
                        </span>
                        <span className="text-lg font-semibold">{i.name}</span>
                        <span className="flex-1 text-[15px] leading-snug text-muted">{i.summary}</span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                          {i.page ? "See how it works" : "Read the docs"} <ArrowRight className="size-[15px] transition group-hover:translate-x-0.5" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-8 text-muted">
            <span>Missing one you need?</span>
            <a href={`mailto:${site.contactEmail}`} className="font-semibold text-accent hover:underline">Tell us →</a>
            <a href="/docs/api" className="font-semibold text-accent hover:underline">Or build it on the API →</a>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
