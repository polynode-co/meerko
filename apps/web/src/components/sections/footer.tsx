import { site } from "@/lib/site";
import { Logo } from "../ui/brand";
import { Container } from "../ui/primitives";

const columns = [
  ["Product", [["Features", "/#product"], ["Pricing", site.pricingUrl], ["Changelog", `${site.githubUrl}/commits/main`], ["Roadmap", `${site.githubUrl}/blob/main/docs/PLAN.md`]]],
  ["Developers", [["Docs", site.docsUrl], ["CLI", `${site.githubUrl}#cli`], ["MCP server", site.docsUrl], ["GitHub", site.githubUrl]]],
] as const;

export function Footer() {
  return (
    <footer className="border-t border-line">
      <Container className="flex flex-col gap-12 pt-14 pb-10">
        <div className="flex flex-col justify-between gap-12 lg:flex-row">
          <div className="flex max-w-[320px] flex-col gap-3">
            <Logo size={30} className="text-[22px]" />
            <p className="text-sm leading-relaxed text-muted">The open-source GTM agent. Always on the lookout for your next customer.</p>
          </div>
          <div className="grid grid-cols-2 gap-10 lg:gap-[72px]">
            {columns.map(([heading, links]) => (
              <div key={heading} className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">{heading}</h3>
                {links.map(([label, href]) => (
                  <a key={label} href={href} className="text-sm text-muted transition hover:text-fg">
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-line pt-6 font-mono text-[13px]">
          <span className="text-muted">© 2026 Meerko · AGPL-3.0</span>
        </div>
      </Container>
    </footer>
  );
}
