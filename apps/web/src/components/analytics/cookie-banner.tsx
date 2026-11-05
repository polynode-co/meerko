"use client";

import Image from "next/image";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { visitorRegion } from "@/lib/visitor-region";

/** Fired by "Cookie settings" in the footer to ask again. */
const REOPEN = "meerko:cookie-settings";

/**
 * The cookie banner. PostHog runs cookieless until the visitor chooses (instrumentation-client.ts:
 * cookieless_mode "on_reject" with opt-out by default), so visits are counted either way. "Accept" turns on
 * PostHog's cookie, which links visits across days and enables session replay. Each choice is captured as
 * `cookie_consent_chosen`, so the accept rate is a PostHog insight. Shown only to visitors in countries that require
 * consent (/consent-region); elsewhere the cookie goes on without asking. Hidden when PostHog isn't configured.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // PostHog starts once the region is known (instrumentation-client.ts), so wait for the same answer.
    void visitorRegion().then(({ consent }) => {
      if (!posthog.__loaded || posthog.get_explicit_consent_status() !== "pending") return;
      // Only where the law asks for consent (lib/consent-region.ts); elsewhere PostHog's cookie goes on without
      // a banner. If the check failed, ask.
      if (consent) setOpen(true);
      else posthog.opt_in_capturing({ captureEventName: false });
    });
    const reopen = () => setOpen(true);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, []);

  const choose = (accepted: boolean) => {
    if (accepted) posthog.opt_in_capturing({ captureEventName: false });
    else posthog.opt_out_capturing();
    // After the switch, so a "No thanks" is still counted (cookieless).
    posthog.capture("cookie_consent_chosen", { choice: accepted ? "accepted" : "rejected", page: window.location.pathname });
    setOpen(false);
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      className="fixed right-4 bottom-4 left-4 z-50 overflow-hidden bg-lk-paper text-lk-ink shadow-[10px_10px_0_#000] outline outline-1 -outline-offset-1 outline-lk-fg sm:left-auto sm:w-[420px]"
    >
      <div className="relative flex flex-col gap-3 p-5 pr-[104px]">
        <p id="cookie-banner-title" className="font-pixel text-[15px]">
          One cookie, ours
        </p>
        <p className="text-[14.5px] leading-[1.5]">
          It tells us how people use Meerko so we can make it better. No ads, no trackers, nothing sold. Say no and we still count your
          visit, just without the cookie.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => choose(true)}
            className="bg-lk-lime px-5 py-2.5 font-plex text-[13px] font-semibold tracking-[0.6px] text-lk-ink uppercase outline outline-1 -outline-offset-1 outline-lk-ink transition hover:brightness-105"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => choose(false)}
            className="px-3 py-2.5 font-plex text-[13px] tracking-[0.6px] text-lk-ink/75 uppercase underline-offset-4 hover:text-lk-ink hover:underline"
          >
            No thanks
          </button>
        </div>
        <a href="/privacy#cookies" className="text-[12.5px] text-lk-ink/60 underline underline-offset-2 hover:text-lk-ink">
          What we collect
        </a>
        {/* The lookout, keeping watch from the corner. */}
        <Image src="/meerko-mascot.svg" alt="" width={84} height={179} className="pointer-events-none absolute right-3 -bottom-10 select-none" />
      </div>
    </div>
  );
}

/** "Cookie settings" for the footers: shows the banner again so a visitor can change their mind. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(REOPEN))} className={className}>
      Cookie settings
    </button>
  );
}
