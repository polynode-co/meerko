"use client";

import { useEffect, useState } from "react";

/** "Contents" list for long pages; marks the section in view with a lime rule. */
export function LkToc({ items, title = "Contents" }: { items: [id: string, label: string][]; title?: string }) {
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
      <p className="font-plex text-[12.5px] tracking-[0.8px] text-lk-dim uppercase">{title}</p>
      {items.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "location" : undefined}
          className={`border-l-2 py-0.5 pl-2.5 text-[15px] leading-snug transition ${active === id ? "border-lk-lime text-lk-fg" : "border-lk-line text-lk-dim hover:text-lk-fg"}`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
