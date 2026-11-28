import Image from "next/image";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/meerko";
import { site } from "@/lib/site";
import { LogoMark } from "../ui/brand";
import { CookieSettingsButton } from "../analytics/cookie-banner";
import { NavFrame } from "./nav-frame";

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

/** `wide` drops the 1440px cap, for full-width layouts like the docs. */
export async function LkNav({ links, transparent = false, wide = false }: { links?: [string, string][]; transparent?: boolean; wide?: boolean }) {
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
    <NavFrame transparent={transparent}>
      <div className={`mx-auto flex h-full items-center justify-between px-6 lg:px-12 ${wide ? "" : "max-w-[1440px]"}`}>
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
    </NavFrame>
  );
}

/** "Made by the Antwork team" (Polynode's other product), tagged so Antwork's analytics see where the visit came from. */
const ANTWORK_URL = "https://antwork.io/?utm_source=meerko&utm_medium=referral&utm_campaign=footer";

export function LkFooter() {
  const links: [string, string][] = [
    ["Docs", site.docsUrl],
    ["Guides", "/guides"],
    ["Integrations", "/integrations"],
    ["Claude", "/claude"],
    ["ChatGPT", "/chatgpt"],
    ["Perplexity", "/perplexity"],
    ["Mistral", "/mistral"],
    ["GitHub", site.githubUrl],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
  ];
  return (
    <footer className="border-t border-lk-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-[18px] font-plex text-[12.5px] tracking-[0.8px] text-lk-dim sm:flex-row sm:items-center sm:justify-between lg:px-12">
        <span>
          MEERKO · MADE BY THE{" "}
          <a href={ANTWORK_URL} className="underline decoration-lk-gray underline-offset-4 hover:text-lk-fg hover:decoration-lk-lime">
            ANTWORK
          </a>{" "}
          TEAM · AGPL-3.0
        </span>
        <span className="flex flex-wrap items-center gap-x-7 gap-y-2">
          {links.map(([name, href]) => (
            <a key={name} href={href} className="uppercase hover:text-lk-fg">
              {name}
            </a>
          ))}
          <CookieSettingsButton className="uppercase hover:text-lk-fg" />
          <span className="size-2 bg-lk-lime" />
        </span>
      </div>
    </footer>
  );
}

const directory: [string, string, string][] = [
  ["Claude", "Claude for sales", "/claude"],
  ["ChatGPT", "ChatGPT for sales", "/chatgpt"],
  ["Perplexity", "The Meerko plugin", "/perplexity"],
  ["Mistral", "Vibe · Le Chat", "/mistral"],
  ["Docs", "Quick start · MCP tools", site.docsUrl],
  ["Guides", "Cold email · deliverability", "/guides"],
  ["Integrations", "Gmail · Outlook · Slack", "/integrations"],
  ["Pricing", "Free · or $49 a month", site.pricingUrl],
  ["GitHub", "Open source · AGPL-3.0", site.githubUrl],
  ["Alternatives", "Clay · Apollo · Instantly", "/alternatives"],
  ["Privacy", "How we handle your data", "/privacy"],
  ["Terms", "The small print", "/terms"],
];

/** The website footer (.pen "LK Footer — Landscape", fKqX3): a link directory, then the colony at dawn. */
export function LkLandscapeFooter() {
  return (
    <footer className="overflow-hidden bg-lk-bg">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-10 px-6 pt-24 pb-14 lg:px-36 lg:pt-[120px]">
        <p className={`${kicker} text-center`}>Always on the lookout for your next customer</p>
        <nav aria-label="Footer" className="grid w-full max-w-[1100px] grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-4">
          {directory.map(([name, caption, href]) => (
            <a key={name} href={href} className="group flex flex-col items-center gap-2 text-center">
              <span className="text-[24px] font-medium tracking-[-0.8px] text-lk-fg transition group-hover:text-lk-lime sm:text-[28px]">{name}</span>
              <span className="font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">{caption}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="relative min-h-[320px] w-full md:aspect-[1584/672] md:min-h-0">
        <Image src="/landing/lookout-dawn.jpg" alt="" fill sizes="100vw" className="object-cover object-[80%_center] md:object-center" />
        <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-lk-bg via-lk-bg/80 md:h-[53%] to-lk-bg/0" />
        {/* the pin sits over the lookout on the rock */}
        <a href={site.signupUrl} className="group absolute top-[21%] left-[88%] hidden -translate-x-1/2 flex-col items-center gap-1.5 md:flex">
          <span className="font-plex text-[12px] tracking-[0.8px] text-lk-fg uppercase">Start</span>
          <span className="text-[17px] font-medium text-lk-fg group-hover:text-lk-lime">Free · 200 credits</span>
          <span className="h-0 w-0 border-x-[7px] border-t-[10px] border-x-transparent border-t-lk-lime" />
        </a>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-lk-bg/0 via-lk-bg/85 to-lk-bg pt-16">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 pb-5 font-plex text-[12.5px] tracking-[0.8px] text-lk-muted sm:flex-row sm:items-center sm:justify-between lg:px-12">
            <span>
          MEERKO · MADE BY THE{" "}
          <a href={ANTWORK_URL} className="underline decoration-lk-gray underline-offset-4 hover:text-lk-fg hover:decoration-lk-lime">
            ANTWORK
          </a>{" "}
          TEAM · AGPL-3.0
        </span>
            <span className="flex items-center gap-2.5">
              <CookieSettingsButton className="uppercase hover:text-lk-fg" /> ·
              © {new Date().getFullYear()} POLYNODE TECHNOLOGIES S.L. <span className="size-2 bg-lk-lime" />
            </span>
          </div>
        </div>
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
      <LkLandscapeFooter />
    </div>
  );
}
