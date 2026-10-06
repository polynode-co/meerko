"use client";

import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchEntry } from "@/lib/docs";

/** Docs search over page titles, MCP tools and CLI commands. ⌘K (or Ctrl+K) focuses it. */
export function DocsSearch({ entries, size = "sm" }: { entries: SearchEntry[]; size?: "sm" | "lg" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && input.current?.offsetParent) {
        e.preventDefault();
        input.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return entries
      .map((e) => {
        const title = e.title.toLowerCase();
        const hay = `${title} ${e.text.toLowerCase()}`;
        if (!terms.every((t) => hay.includes(t))) return null;
        return { e, score: terms.filter((t) => title.includes(t)).length * 2 + (title.startsWith(terms[0]!) ? 1 : 0) };
      })
      .filter((r): r is { e: SearchEntry; score: number } => !!r)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((r) => r.e);
  }, [q, entries]);

  const go = (e?: SearchEntry) => {
    if (e) window.location.href = e.href;
  };
  const lg = size === "lg";

  return (
    <div className="relative w-full">
      <label className={`flex items-center gap-2.5 rounded-lg border border-line bg-raised focus-within:border-muted ${lg ? "gap-3 rounded-xl px-[18px] py-[15px]" : "px-2.5 py-2"}`}>
        <Search className={`shrink-0 text-muted ${lg ? "size-[18px]" : "size-3.5"}`} />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter") go(results[active]);
            else if (e.key === "Escape") input.current?.blur();
            else return;
            e.preventDefault();
          }}
          placeholder={lg ? "Search the docs, e.g. “send window” or enroll_rows" : "Search docs"}
          aria-label="Search the docs"
          className={`min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted ${lg ? "text-base" : "text-[13px]"}`}
        />
        <kbd className={`hidden font-mono text-muted sm:block ${lg ? "rounded-md border border-line px-[7px] py-[3px] text-xs" : "text-[11px]"}`}>⌘K</kbd>
      </label>
      {open && q && (
        <ul className={`absolute top-full left-0 z-30 mt-2 overflow-hidden rounded-xl border border-line bg-raised shadow-2xl ${lg ? "right-0" : "w-[min(380px,calc(100vw-2.5rem))]"}`}>
          {results.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing found for “{q}”.</li>}
          {results.map((r, i) => (
            <li key={r.href + r.title}>
              <a
                href={r.href}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 px-4 py-2.5 ${i === active ? "bg-accent-soft" : ""}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`truncate text-sm font-semibold ${r.kind === "Page" ? "" : "font-mono font-normal"} ${i === active ? "text-accent" : "text-fg"}`}>{r.title}</span>
                  <span className="truncate text-xs text-muted">{r.text}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{r.kind}</span>
                {i === active && <ArrowRight className="size-3.5 shrink-0 text-accent" />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Opens the <details> the URL hash points at (e.g. /docs/mcp-tools#enroll_rows), on load and on hash changes. */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const el = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        // After Next.js restores the scroll position on load.
        setTimeout(() => el.scrollIntoView({ block: "start" }), 100);
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
