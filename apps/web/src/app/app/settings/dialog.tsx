"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

// The interactive pieces of the Connections page; the static ones are in ./parts.tsx.

/**
 * A centred dialog over a dimmed page. Escape and the backdrop close it. Rendered in place (no portal) so it stays
 * inside the `.ws3` token scope.
 */
export function Modal({ title, onClose, children, width = 600 }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(22,22,26,0.32)] p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        style={{ maxWidth: width }}
        className="w-full overflow-hidden rounded-xl border border-lk-line bg-white text-left shadow-[0_12px_40px_rgba(22,22,26,0.15)]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-lk-line px-5 py-4">
          <h2 id={id} className="min-w-0 text-[15px] font-semibold break-words text-lk-fg">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-lk-dim transition hover:bg-lk-frame hover:text-lk-fg">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const copyLook = "inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold whitespace-nowrap text-lk-muted transition hover:text-lk-fg";

/** "Copy" with an icon, flipping to "Copied" for a moment. `className` replaces the plain-text look (e.g. a buttonClass). */
export function CopyButton({ text, label = "Copy", done = "Copied", className = copyLook }: { text: string; label?: string; done?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className={className}
    >
      {copied ? <Check className="size-[13px]" /> : <Copy className="size-[13px]" />}
      {copied ? done : label}
    </button>
  );
}

/** An on/off switch; the caller's onClick does the work. */
export function Switch({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-lk-fg" : "bg-lk-gray"}`}
    >
      <span className={`block size-3.5 rounded-full bg-white shadow-sm transition ${on ? "translate-x-[14px]" : "translate-x-[2px]"}`} />
    </button>
  );
}
