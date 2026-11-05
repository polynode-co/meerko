"use client";

import { useEffect } from "react";
import { ATTRIBUTION_KEYS } from "@/lib/attribution";

// Where this visit came from, kept in memory only (no cookie or storage, so it needs no consent). Set on the
// first page of the visit and kept across client-side navigations; a full reload starts over.
let firstTouch: URLSearchParams | null = null;

function captureFirstTouch() {
  if (firstTouch) return;
  const here = new URL(window.location.href);
  const p = new URLSearchParams();
  for (const k of ATTRIBUTION_KEYS) {
    const v = k === "ref" ? referrerHost() : k === "landing" ? here.pathname : here.searchParams.get(k);
    if (v) p.set(k, v.slice(0, 100));
  }
  firstTouch = p;
}

/** The referring site's host, when it's another site. */
function referrerHost() {
  try {
    const host = new URL(document.referrer).host;
    return host && host !== window.location.host ? host : null;
  } catch {
    return null;
  }
}

/**
 * Adds the visit's source (UTM tags, referring site, landing page) to every link into /login, so the API can put
 * it on the `sign_up` event. That keeps signup attribution for visitors who said no to the analytics cookie.
 */
export function SignupAttribution() {
  useEffect(() => {
    captureFirstTouch();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !firstTouch?.size) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== "/login") return;
      for (const [k, v] of firstTouch) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      a.href = url.toString();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
