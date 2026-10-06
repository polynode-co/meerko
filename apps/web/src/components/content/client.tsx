"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** "Copy" button for an email sample. */
export function CopySample({ text }: { text: string }) {
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
      className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
    >
      {copied ? <Check className="size-[13px] text-signal" /> : <Copy className="size-[13px]" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** The "On this page" list; highlights the section currently in view. */
export function Toc({ items }: { items: [id: string, label: string][] }) {
  const [active, setActive] = useState(items[0]?.[0]);
  useEffect(() => {
    const els = items.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="On this page" className="flex flex-col gap-[11px] border-l border-line pl-4">
      <p className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">On this page</p>
      {items.map(([id, label]) => (
        <a key={id} href={`#${id}`} className={`text-sm transition ${active === id ? "font-semibold text-accent" : "text-muted hover:text-fg"}`}>
          {label}
        </a>
      ))}
    </nav>
  );
}
