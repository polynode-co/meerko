import { Bot, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared workspace pieces, from the WS3 designs in docs/design/meerko.pen ("WS3 · …", 2026-11-12): white pages,
 * hairline cards with 8px corners, Inter for UI, JetBrains Mono caps for labels, Bricolage for titles and big numbers,
 * saffron (lk-lime inside .ws3) for outcomes. Colours come from the .ws3 tokens in globals.css.
 */

/** The padding and rhythm of every workspace page. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-5 px-5 py-6 sm:px-8 ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, meta, actions }: { eyebrow?: ReactNode; title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className={crumb}>{eyebrow}</p>}
        <h1 className="font-display text-[28px] leading-[1.15] font-bold tracking-[-0.6px] break-words text-lk-fg">{title}</h1>
        {meta && <div className="max-w-[760px] text-[13.5px] leading-[1.5] text-lk-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Small breadcrumb above a page title ("Leads /"). */
export const crumb = "text-[13px] text-lk-dim";
/** Mono caps label: column headings, field names, small meta. */
export const monoLabel = "font-mono text-[10px] tracking-[1px] text-lk-dim uppercase";
/** A card's title ("Pipeline", "Needs you"). */
export const cardTitle = "text-[13.5px] leading-snug font-semibold text-lk-fg";

const pillTones = {
  neutral: "bg-ws-soft text-lk-muted",
  /** Worth a look: in progress, a question. */
  amber: "bg-ws-acc-soft text-ws-acc-ink",
  /** A good signal (verified, interested, sending). */
  signal: "bg-ws-green-soft text-ws-green",
  /** The strongest signal (draft ready, meeting, won): saffron. */
  solid: "bg-ws-acc text-lk-fg",
  blue: "bg-ws-blue-soft text-ws-blue",
  red: "bg-ws-red-soft text-ws-red",
} as const;
export type PillTone = keyof typeof pillTones;

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-[7px] py-[2px] font-mono text-[10.5px] leading-[1.4] whitespace-nowrap ${pillTones[tone]}`}>{children}</span>
  );
}

export const stageTone: Record<string, PillTone> = { new: "neutral", contacted: "blue", replied: "signal", meeting: "solid", won: "solid", lost: "neutral" };

export const intentTone: Record<string, PillTone> = {
  interested: "signal",
  question: "blue",
  referral: "blue",
  not_now: "neutral",
  not_interested: "neutral",
  wrong_person: "neutral",
  other: "neutral",
  out_of_office: "neutral",
  bounce: "red",
  unsubscribe: "neutral",
};

export const label = (s: string) => s.replace(/_/g, " ");

const buttonStyles = {
  primary: "bg-lk-fg text-white hover:bg-[#2b2b31]",
  secondary: "bg-white text-lk-fg border border-lk-line hover:bg-lk-frame",
  ghost: "text-lk-muted hover:bg-lk-frame hover:text-lk-fg",
  /** Saffron: a live control or an AI moment (Pause sending, Approve all). */
  lime: "bg-ws-acc text-lk-fg hover:brightness-95",
  /** Red: the confirming click of something destructive. */
  danger: "bg-white text-ws-red border border-[#f3c9c9] hover:bg-ws-red-soft",
} as const;

/** `sm` is the compact size used in card title bars and inline toolbars. */
export function buttonClass(variant: keyof typeof buttonStyles = "secondary", size: "md" | "sm" = "md") {
  const sizing = size === "sm" ? "gap-1.5 px-2.5 py-[5px] text-[12px]" : "gap-1.5 px-3 py-[7px] text-[12.5px]";
  return `inline-flex items-center justify-center rounded-md ${sizing} font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[13px] ${buttonStyles[variant]}`;
}

/** A white hairline card, the container of most things. */
export function Card({ children, className = "", raised = false, id }: { children: ReactNode; className?: string; raised?: boolean; id?: string }) {
  return (
    <section id={id} className={`min-w-0 overflow-hidden rounded-lg border border-lk-line ${raised ? "bg-lk-frame" : "bg-white"} ${className}`}>
      {children}
    </section>
  );
}

/** A card's title bar: title on the left, links or buttons on the right. */
export function CardHead({ title, children, className = "" }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex min-h-[42px] flex-wrap items-center justify-between gap-3 border-b border-lk-line px-4 py-2 ${className}`}>
      <h2 className={`flex items-center gap-2 ${cardTitle}`}>{title}</h2>
      {children}
    </div>
  );
}

/** A small count next to a card title ("Needs you 5"). */
export function Count({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-ws-acc-soft px-[7px] py-px font-mono text-[11px] font-semibold text-ws-acc-ink">{children}</span>;
}

/** The "Open inbox →" style link in a card's title bar. */
export const headLink = "text-[12.5px] text-lk-muted transition hover:text-lk-fg";

/** Table heading cells: mono caps on the head band. */
export const thText = "text-left font-mono text-[10px] font-normal tracking-[1px] text-lk-dim uppercase";
export const th = `bg-ws-head px-4 py-2.5 ${thText}`;
export const td = "px-4 py-3 text-[13px] text-lk-fg";

/** Form fields: white, hairline, 6px corners, ink focus ring. */
export const field =
  "w-full min-w-0 rounded-md border border-lk-line bg-white px-2.5 py-[7px] text-[13px] text-lk-fg placeholder:text-lk-dim focus:border-lk-fg focus:outline-none";
export const fieldLabel = "text-[12.5px] font-medium text-lk-fg";

/** What a person receives (previews, drafts): a light sheet with a small title bar. */
export function PaperWindow({ title, children, className = "", bodyClassName = "p-4" }: { title: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-lk-line bg-white text-lk-fg ${className}`}>
      <div className="flex justify-between gap-3 border-b border-lk-line bg-ws-head px-3 py-2">
        <span className={`min-w-0 truncate ${monoLabel}`}>{title}</span>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** Shown wherever a list can be empty, so the screen says what to do next. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
      <span className="grid size-9 place-items-center rounded-lg bg-ws-acc-soft">
        <Icon className="size-[18px] text-ws-acc-ink" />
      </span>
      <p className="text-[14px] font-semibold text-lk-fg">{title}</p>
      {children && <div className="max-w-xl text-[13px] leading-relaxed text-lk-muted">{children}</div>}
    </div>
  );
}

/** A command to give the user's agent; Meerko's main interface is their Claude Code / Cursor / Codex. */
export function AgentHint({ children, command }: { children: ReactNode; command: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#f3e2a6] bg-ws-acc-soft px-4 py-3 text-left text-[13px] leading-normal text-lk-fg">
      <Bot className="mt-0.5 size-4 shrink-0 text-ws-acc-ink" />
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{children}</span>
        <span className="font-mono text-[12px] text-ws-acc-ink">“{command}”</span>
      </span>
    </div>
  );
}

/** A one-line outcome: green for success, red for a refusal. */
export function Notice({ ok, children, className = "" }: { ok: boolean; children: ReactNode; className?: string }) {
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-md border px-4 py-2.5 text-[13px] ${ok ? "border-[#cde9d6] bg-ws-green-soft text-lk-fg" : "border-[#f3c9c9] bg-ws-red-soft text-lk-fg"} ${className}`}
    >
      {children}
    </p>
  );
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
