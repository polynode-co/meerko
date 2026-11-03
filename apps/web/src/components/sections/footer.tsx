import { ArrowUp, BookOpen } from "lucide-react";
import Image from "next/image";
import { alternatives, guides } from "@/lib/content";
import { site } from "@/lib/site";
import { GitHubIcon, Logo } from "../ui/brand";
import { Container } from "../ui/primitives";

// Built from the content registry (lib/content.ts). The first link of Learn and Compare is the hub.
const columns = [
  ["Product", [["Features", "/#product"], ["Pricing", site.pricingUrl], ["Integrations", "/integrations"], ["Changelog", `${site.githubUrl}/commits/main`], ["Roadmap", `${site.githubUrl}/blob/main/docs/PLAN.md`]]],
  ["Developers", [["Docs", site.docsUrl], ["MCP tools", "/docs/mcp-tools"], ["CLI", "/docs/cli"], ["Self-hosting", "/docs/self-hosting"], ["GitHub", site.githubUrl]]],
  ["Learn", [["All guides", "/guides"], ...guides.map((g) => [g.title, `/guides/${g.slug}`] as const)]],
  ["Compare", [["All alternatives", "/alternatives"], ...alternatives.map((a) => [`${a.name} alternative`, `/alternatives/${a.slug}`] as const)]],
] as const;

export function Footer() {
  return (
    <footer className="relative mt-[72px] border-t border-line bg-raised">
      {/* The mascot on lookout, peeking over the footer's edge. */}
      <div aria-hidden className="pointer-events-none absolute -top-[72px] right-8 hidden h-[72px] w-[70px] overflow-hidden md:block lg:right-[180px]">
        <Image src="/meerko-mascot.svg" alt="" width={68} height={145} className="mt-1 h-[145px] w-auto" />
      </div>

      <Container className="flex flex-col gap-12 pt-14 pb-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-[72px]">
          <div className="flex flex-col gap-[18px] lg:w-[340px] lg:shrink-0">
            <Logo size={36} className="text-[26px]" />
            <p className="text-[15px] leading-[1.55] text-muted">The open-source AI sales agent. Always on the lookout for your next customer.</p>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-soft px-[11px] py-[5px] font-mono text-xs text-accent">
              <span className="size-1.5 rounded-full bg-accent" />
              AGPL-3.0 · Self-host or cloud
            </span>
            <div className="flex flex-wrap gap-2.5 pt-1.5">
              <a href={site.githubUrl} className="inline-flex items-center gap-2 rounded-[9px] border border-line bg-ink px-3.5 py-2.5 text-sm font-semibold hover:border-muted">
                <GitHubIcon /> Star on GitHub
              </a>
              <a href={site.docsUrl} className="inline-flex items-center gap-2 rounded-[9px] border border-line bg-ink px-3.5 py-2.5 text-sm font-semibold hover:border-muted">
                <BookOpen className="size-4" /> Read the docs
              </a>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map(([heading, links]) => (
              <div key={heading} className="flex flex-col gap-3">
                <h3 className="font-mono text-xs tracking-[0.13em] uppercase">{heading}</h3>
                {links.map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    className={`text-sm leading-snug transition ${label.startsWith("All ") ? "text-accent hover:underline" : "text-muted hover:text-fg"}`}
                  >
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-[22px]">
          <span className="font-mono text-xs text-muted">© 2026 Meerko · Open source under AGPL-3.0</span>
          <div className="flex items-center gap-6 text-[13px]">
            <a href="/privacy" className="text-muted hover:text-fg">Privacy</a>
            <a href="/terms" className="text-muted hover:text-fg">Terms</a>
            <a href="/login" className="text-muted hover:text-fg">Sign in</a>
            <a href={site.githubUrl} className="text-muted hover:text-fg">GitHub</a>
            <a href="#top" className="inline-flex items-center gap-1.5 hover:text-accent">
              Back to top <ArrowUp className="size-3.5" />
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
