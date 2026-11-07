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
