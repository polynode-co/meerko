import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-20 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "deep" }) {
  return (
    <p className={`font-mono text-[13px] tracking-[0.15em] uppercase ${tone === "deep" ? "text-accent-deep" : "text-accent"}`}>
      {children}
    </p>
  );
}

export function SectionTitle({ children, className = "", as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <Tag className={`font-display text-4xl leading-[1.05] font-bold tracking-[-0.03em] sm:text-5xl lg:text-[52px] ${className}`}>
      {children}
    </Tag>
  );
}

export function PrimaryButton({ href, children, arrow = true }: { href: string; children: ReactNode; arrow?: boolean }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[10px] bg-accent px-6 py-4 text-base font-semibold text-dark transition hover:brightness-110"
    >
      {children}
      {arrow && <ArrowRight className="size-[18px]" />}
    </a>
  );
}

export function TrafficLights() {
  return (
    <span className="flex gap-2">
      <span className="size-[11px] rounded-full bg-[#ff5f57]" />
      <span className="size-[11px] rounded-full bg-[#febc2e]" />
      <span className="size-[11px] rounded-full bg-[#28c840]" />
    </span>
  );
}

export function TerminalWindow({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border border-line bg-raised shadow-[0_30px_60px_rgba(0,0,0,0.5)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <TrafficLights />
        <span className="font-mono text-xs text-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}
