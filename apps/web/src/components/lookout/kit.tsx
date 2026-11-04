import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/meerko";
import { site } from "@/lib/site";
import { LogoMark } from "../ui/brand";

// The Lookout kit: the shared pieces of every marketing page, from the .pen "Lookout Kit — components"
// (FKxST). Night background, IBM Plex Mono labels, Silkscreen pixel titles, paper windows, lime signal.

/** Uppercase mono label (buttons, tags, small headings). */
export const label = "font-plex text-[13px] tracking-[0.8px] uppercase";
/** Section label with a lime square: "01 · How it works". */
export const kicker =
  "inline-flex items-center gap-2.5 font-plex text-[14px] tracking-[0.8px] uppercase text-lk-fg/80 before:size-2 before:bg-lk-lime before:content-['']";
export const sectionTitle = "font-sans text-[32px] font-semibold tracking-[-1.2px] text-lk-fg sm:text-[44px] sm:tracking-[-1.5px]";
export const pageTitle = "font-sans text-[40px] leading-[1.05] font-semibold tracking-[-1.4px] text-lk-fg sm:text-[56px] sm:tracking-[-2px]";
export const lead = "text-[17px] leading-[1.6] text-lk-muted sm:text-[18px]";
export const crumb = "font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase";

export function Kicker({ children, as: Tag = "span" }: { children: React.ReactNode; as?: "span" | "p" | "h2" }) {
  return <Tag className={kicker}>{children}</Tag>;
}

/** Paper "OS" window: pixel title bar with a [x], hard black shadow. */
export function Window({ title, children, className = "", bodyClassName = "p-[18px]" }: { title: string; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={`bg-lk-paper text-lk-ink shadow-[10px_10px_0_#000] outline outline-1 -outline-offset-1 outline-lk-fg ${className}`}>
      <div className="flex justify-between border-b-[1.5px] border-lk-ink px-3 py-[7px] text-[13px]">
        <span className="font-pixel">{title}</span>
        <span className="font-plex">[x]</span>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function LimeButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={`${label} inline-block bg-lk-lime px-4 py-[13px] font-semibold text-lk-bg transition hover:brightness-110 ${className}`}>
      {children}
    </a>
  );
}

/** Light button with a lime hard shadow; presses in on hover. */
export function PaperButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={`${label} inline-block bg-lk-fg px-4 py-3 font-semibold text-lk-ink shadow-[4px_4px_0_var(--color-lk-lime)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_var(--color-lk-lime)] ${className}`}
    >
      {children}
    </a>
  );
}

/** Outlined button for secondary actions on dark backgrounds. */
export function GhostButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} className={`${label} inline-block px-4 py-3 font-semibold text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray transition hover:outline-lk-muted ${className}`}>
      {children}
    </a>
  );
}

/** Lime-tinted note with an icon. */
export function Callout({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-lk-lime/[0.07] px-4 py-3.5 text-[15px] leading-[1.55] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-lime/35 [&_a]:text-lk-lime [&_a]:underline-offset-4 hover:[&_a]:underline">
      {icon && <span className="mt-0.5 shrink-0 text-lk-lime">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The Lime "start free" band that closes most pages. */
export function CtaBand({ title, body, cta = "Get started free →", href = site.signupUrl }: { title: string; body: string; cta?: string; href?: string }) {
  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-36">
      <div className="flex flex-col items-start justify-between gap-6 bg-lk-box p-8 outline outline-1 -outline-offset-1 outline-lk-gray sm:p-10 lg:flex-row lg:items-center">
        <div className="flex max-w-[720px] flex-col gap-2.5">
          <h2 className="text-[26px] font-semibold tracking-[-0.6px] text-lk-fg">{title}</h2>
          <p className="text-[15.5px] leading-[1.6] text-lk-muted">{body}</p>
        </div>
        <LimeButton href={href} className="shrink-0">
          {cta}
        </LimeButton>
      </div>
    </div>
  );
}

export async function LkNav({ links, transparent = false }: { links?: [string, string][]; transparent?: boolean }) {
  // A saved session means signed in; /app re-checks it.
  const signedIn = !!(await cookies()).get(SESSION_COOKIE)?.value;
  const items = links ?? [
    ["Product", "/#product"],
    ["Docs", site.docsUrl],
    ["Guides", "/guides"],
    ["Pricing", site.pricingUrl],
    ["GitHub", site.githubUrl],
  ];
  return (
    <header className={`relative z-10 ${transparent ? "" : "border-b border-lk-line bg-lk-bg"}`}>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-[22px] lg:px-12">
        <a href="/" aria-label="Meerko home" className="flex items-center gap-2.5">
          <LogoMark size={26} />
          <span className="font-pixel text-[16px] tracking-[0.6px] text-lk-fg">MEERKO</span>
        </a>
        <nav className="flex items-center gap-8">
          {items.map(([name, href]) => (
            <a key={name} href={href} className="hidden font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase transition hover:text-lk-fg md:inline">
              {name}
            </a>
          ))}
          <a
            href={signedIn ? "/app" : site.signupUrl}
            className="bg-lk-lime px-3.5 py-[9px] font-plex text-[13px] font-semibold tracking-[0.6px] text-lk-bg transition hover:brightness-110"
          >
            {signedIn ? "OPEN APP →" : "START FREE →"}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function LkFooter() {
  const links: [string, string][] = [
    ["Docs", site.docsUrl],
    ["Guides", "/guides"],
    ["Integrations", "/integrations"],
    ["GitHub", site.githubUrl],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
  ];
  return (
    <footer className="border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-[18px] font-plex text-[12.5px] tracking-[0.8px] text-lk-dim sm:flex-row sm:items-center sm:justify-between lg:px-12">
        <span>MEERKO · A POLYNODE PROJECT · AGPL-3.0</span>
        <span className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {links.map(([name, href]) => (
            <a key={name} href={href} className="uppercase hover:text-lk-fg">
              {name}
            </a>
          ))}
          <span className="size-2 bg-lk-lime" />
        </span>
      </div>
    </footer>
  );
}

/** A marketing page: night background, nav, the page, footer. */
export async function LkPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-lk-bg text-lk-fg">
      <LkNav />
      <main>{children}</main>
      <LkFooter />
    </div>
  );
}
