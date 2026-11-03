import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared dashboard pieces, matching the "Dark Amber" dashboard designs in the .pen file. */

export function PageHeader({ eyebrow, title, meta, actions }: { eyebrow: string; title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{eyebrow}</p>
        <h1 className="font-display text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
        {meta && <div className="text-[13px] text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

const pillTones = {
  neutral: "bg-line text-muted",
  amber: "bg-accent-soft text-accent",
  signal: "bg-signal/12 text-signal",
  solid: "bg-signal text-dark",
} as const;
export type PillTone = keyof typeof pillTones;

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: PillTone }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${pillTones[tone]}`}>{children}</span>;
}

export const stageTone: Record<string, PillTone> = { new: "neutral", contacted: "amber", replied: "signal", meeting: "solid", won: "solid", lost: "neutral" };

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
  primary: "bg-accent text-dark hover:brightness-110",
  secondary: "border border-line bg-raised text-fg hover:border-muted/40",
  ghost: "border border-line text-muted hover:text-fg",
} as const;

export function buttonClass(variant: keyof typeof buttonStyles = "secondary") {
  return `inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]}`;
}

export function Card({ children, className = "", raised = false, id }: { children: ReactNode; className?: string; raised?: boolean; id?: string }) {
  return <section id={id} className={`rounded-xl border border-line ${raised ? "bg-raised" : ""} ${className}`}>{children}</section>;
}

/** Shown wherever a list can be empty, so the screen explains itself and says what to do next. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-xl border border-line bg-raised">
        <Icon className="size-5 text-accent" />
      </span>
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-md text-[13px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

/** A command to give the user's agent; Meerko's main interface is their Claude Code / Cursor / Codex. */
export function AgentHint({ children, command }: { children: ReactNode; command: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-accent-soft px-3 py-2 text-[13px]">
      <span>{children}</span>
      <span className="font-mono text-xs text-accent">Ask your agent: “{command}”</span>
    </div>
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
