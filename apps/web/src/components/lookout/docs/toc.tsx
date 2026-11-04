"use client";

import { useEffect, useState } from "react";

/** "On this page": a rail of links; the section in view gets the lime bar. */
export function LkToc({ items }: { items: [id: string, label: string][] }) {
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
    <nav aria-label="On this page" className="flex flex-col gap-2.5">
      <p className="font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">On this page</p>
      <div className="flex flex-col gap-2.5 border-l border-lk-line">
        {items.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={`-ml-px border-l-2 pl-2.5 text-[15px] leading-snug transition ${active === id ? "border-lk-lime text-lk-fg" : "border-transparent text-lk-dim hover:text-lk-fg"}`}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/** Copy button for the title bar of a paper window (ink on paper). */
export function CopyText({ text, className = "" }: { text: string; className?: string }) {
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
      className={`font-plex text-[12.5px] tracking-[0.6px] uppercase hover:underline ${className}`}
    >
      {copied ? "[copied]" : "[copy]"}
    </button>
  );
}
