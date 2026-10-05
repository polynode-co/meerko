import { site } from "@/lib/site";
import { GitHubIcon, Logo } from "../ui/brand";
import { Container } from "../ui/primitives";

const links = [
  ["Product", "#how-it-works"],
  ["Docs", site.docsUrl],
  ["Pricing", "#pricing"],
  ["Changelog", `${site.githubUrl}/commits/main`],
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink/85 backdrop-blur">
      <Container className="flex items-center justify-between py-5 lg:py-6">
        <a href="#" aria-label="Meerko home">
          <Logo size={34} />
        </a>
        <nav className="hidden items-center gap-9 md:flex">
          {links.map(([label, href]) => (
            <a key={label} href={href} className="text-[15px] text-muted transition hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={site.githubUrl}
            className="hidden items-center gap-2 rounded-lg border border-line px-3.5 py-2.5 text-sm font-medium transition hover:border-muted sm:inline-flex"
          >
            <GitHubIcon />
            Star
          </a>
          <a href={site.signupUrl} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-dark transition hover:brightness-110">
            Get started
          </a>
        </div>
      </Container>
    </header>
  );
}
