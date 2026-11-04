import { Bot, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared dashboard pieces, from the "Lookout" app designs in the .pen file (LK App …): night background, IBM Plex
 * Mono labels, Silkscreen box titles, square outlined boxes and a lime signal colour.
 */

/** The padding and rhythm of every dashboard page. */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-col gap-7 px-5 py-6 sm:px-10 sm:py-8 ${className}`}>{children}</div>;
}

export function PageHeader({ eyebrow, title, meta, actions }: { eyebrow: string; title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-2">
        <p className={crumb}>{eyebrow}</p>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.9px] break-words text-lk-fg sm:text-[34px] sm:tracking-[-1.1px]">{title}</h1>
        {meta && <div className="max-w-[760px] text-[16px] leading-[1.55] text-lk-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}

/** Uppercase mono breadcrumb above a page title. */
export const crumb = "font-plex text-[13px] tracking-[0.6px] text-lk-dim uppercase";
/** Uppercase mono label: field names, table headings, small meta. */
export const monoLabel = "font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase";
/** A box's pixel title ("PIPELINE", "NEEDS YOU"). */
export const cardTitle = "font-pixel text-[13px] leading-snug text-lk-fg uppercase";

const pillTones = {
  /** Outlined grey: the default, for neutral states. */
  neutral: "text-lk-dim outline outline-1 -outline-offset-1 outline-lk-gray",
  /** Outlined, brighter: something in progress or worth a look. */
  amber: "text-lk-fg outline outline-1 -outline-offset-1 outline-lk-muted",
  /** Ink with lime text: a good signal (verified, interested). */
  signal: "bg-lk-ink text-lk-lime outline outline-1 -outline-offset-1 outline-lk-line",
  /** Solid lime: the strongest signal (running, replied, draft ready). */
  solid: "bg-lk-lime text-lk-ink",
} as const;
export type PillTone = keyof typeof pillTones;

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] font-plex text-[12px] tracking-[0.6px] whitespace-nowrap uppercase ${pillTones[tone]}`}>{children}</span>
  );
}

export const stageTone: Record<string, PillTone> = { new: "neutral", contacted: "amber", replied: "solid", meeting: "solid", won: "solid", lost: "neutral" };

export const intentTone: Record<string, PillTone> = {
  interested: "signal",
  question: "amber",
  referral: "amber",
  not_now: "neutral",
  not_interested: "neutral",
  wrong_person: "neutral",
  other: "neutral",
  out_of_office: "neutral",
  bounce: "neutral",
  unsubscribe: "neutral",
};

export const label = (s: string) => s.replace(/_/g, " ");

const buttonStyles = {
  primary: "bg-lk-lime text-lk-ink hover:brightness-110",
  secondary: "text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray hover:outline-lk-muted",
  ghost: "text-lk-dim outline outline-1 -outline-offset-1 outline-lk-line hover:text-lk-fg hover:outline-lk-gray",
  /** Outlined lime: a live control that stops something (Pause sending). */
  lime: "text-lk-lime outline outline-1 -outline-offset-1 outline-lk-lime/70 hover:bg-lk-lime/[0.08]",
  /** Outlined red: the confirming click of something destructive. */
  danger: "text-[#e5795b] outline outline-1 -outline-offset-1 outline-[#e5795b]/50 hover:bg-[#e5795b]/10",
} as const;

/** `sm` is the compact size used in box title bars and inline toolbars. */
export function buttonClass(variant: keyof typeof buttonStyles = "secondary", size: "md" | "sm" = "md") {
  const sizing = size === "sm" ? "gap-1.5 px-2.5 py-[7px] text-[12px]" : "gap-2 px-3.5 py-[10px] text-[13px]";
  return `inline-flex items-center justify-center ${sizing} font-plex font-semibold tracking-[0.8px] whitespace-nowrap uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]}`;
}

/** An outlined dark box, the container of almost everything. */
export function Card({ children, className = "", raised = false, id }: { children: ReactNode; className?: string; raised?: boolean; id?: string }) {
  return (
    <section id={id} className={`min-w-0 border border-lk-line ${raised ? "bg-lk-frame" : "bg-lk-box"} ${className}`}>
      {children}
    </section>
  );
}

/** A box's title bar: pixel title on the left, links or buttons on the right. */
export function CardHead({ title, children, className = "" }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-lk-line px-[18px] py-3.5 ${className}`}>
      <h2 className={cardTitle}>{title}</h2>
      {children}
    </div>
  );
}

/** The "OPEN INBOX →" style link in a box's title bar. */
export const headLink = "font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase transition hover:text-lk-lime";

/** Table heading cells: mono labels on the ink band. */
export const thText = "text-left font-plex text-[12px] font-normal tracking-[0.6px] text-lk-dim uppercase";
export const th = `px-[18px] py-2.5 ${thText}`;
export const td = "px-[18px] py-3 text-[15px] text-lk-muted";

/** Form fields: outlined, square, lime focus. */
export const field =
  "w-full min-w-0 bg-lk-ink px-3 py-[9px] text-[15px] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray placeholder:text-lk-gray focus:outline-lk-lime";
export const fieldLabel = monoLabel;

/**
 * The paper "OS" window (pixel title bar, hard black shadow), like the Lookout kit's Window, but safe to use from
 * client components (the kit module reads cookies). Used for what a person receives: previews and drafts.
 */
export function PaperWindow({ title, children, className = "", bodyClassName = "p-[18px]" }: { title: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={`bg-lk-paper text-lk-ink shadow-[8px_8px_0_#000] outline outline-1 -outline-offset-1 outline-lk-fg ${className}`}>
      <div className="flex justify-between gap-3 border-b-[1.5px] border-lk-ink px-3 py-[7px] text-[13px]">
        <span className="min-w-0 truncate font-pixel">{title}</span>
        <span aria-hidden className="font-plex">[x]</span>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/** Shown wherever a list can be empty, so the screen explains itself and says what to do next. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3.5 px-6 py-16 text-center">
      <span className="grid size-11 place-items-center bg-lk-ink outline outline-1 -outline-offset-1 outline-lk-line">
        <Icon className="size-5 text-lk-lime" />
      </span>
      <p className="text-[17px] font-semibold text-lk-fg">{title}</p>
      {children && <div className="max-w-xl text-[15px] leading-relaxed text-lk-muted">{children}</div>}
    </div>
  );
}

/** A command to give the user's agent; Meerko's main interface is their Claude Code / Cursor / Codex. */
export function AgentHint({ children, command }: { children: ReactNode; command: string }) {
  return (
    <div className="flex items-start gap-3 bg-lk-lime/[0.07] px-4 py-3 text-left text-[15px] leading-normal text-lk-fg outline outline-1 -outline-offset-1 outline-lk-lime/35">
      <Bot className="mt-0.5 size-4 shrink-0 text-lk-lime" />
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{children}</span>
        <span className="font-plex text-[13px] text-lk-lime">Ask your agent: “{command}”</span>
      </span>
    </div>
  );
}

/** A one-line outcome: lime for success, red for a refusal. */
export function Notice({ ok, children, className = "" }: { ok: boolean; children: ReactNode; className?: string }) {
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`px-4 py-3 text-[15px] outline outline-1 -outline-offset-1 ${ok ? "bg-lk-lime/[0.07] text-lk-fg outline-lk-lime/40" : "bg-[#e5795b]/10 text-lk-fg outline-[#e5795b]/50"} ${className}`}
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
