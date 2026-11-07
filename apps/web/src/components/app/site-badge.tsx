"use client";

import { useState } from "react";

/** A site's favicon (via /favicon-for), or its initial when it has none. */
export function SiteIcon({ host, name, size = 28 }: { host: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (failed) {
    return (
      <span style={box} className="inline-flex shrink-0 items-center justify-center bg-lk-lime font-plex text-[0.55em] font-semibold text-lk-ink" aria-hidden>
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // A plain img: the icon comes from our own route, at its native size, and may 404.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/favicon-for?domain=${encodeURIComponent(host)}`} alt="" style={box} className="shrink-0 bg-lk-fg/95 p-[3px] [image-rendering:auto]" onError={() => setFailed(true)} />
  );
}

/** The site as a small chip (icon + domain) that never wraps: long domains are cut with an ellipsis. */
export function SiteChip({ host, name }: { host: string; name: string }) {
  return (
    <span title={host} className="inline-flex max-w-full items-center gap-2 self-start bg-lk-box px-2 py-1.5 outline outline-1 -outline-offset-1 outline-lk-line">
      <SiteIcon host={host} name={name} size={20} />
      <span className="truncate font-plex text-[13px] tracking-[0.4px] text-lk-fg">{host}</span>
    </span>
  );
}
