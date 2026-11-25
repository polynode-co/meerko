"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sections that moved from Connections to Settings (/app/workspace). */
export const MOVED_SECTIONS = ["icp", "api-keys", "provider-keys", "billing", "workspace"] as const;

/**
 * Keeps old links to those sections working: /app/settings#billing opens /app/workspace#billing. The fragment never
 * reaches the server, so this runs in the browser; query strings (Stripe's ?billing=) are redirected by the page.
 */
export function MovedToSettings() {
  const router = useRouter();
  useEffect(() => {
    const follow = () => {
      const id = window.location.hash.slice(1);
      if ((MOVED_SECTIONS as readonly string[]).includes(id)) router.replace(`/app/workspace#${id}`);
    };
    follow();
    // Also for such a link followed while already on this page.
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [router]);
  return null;
}
