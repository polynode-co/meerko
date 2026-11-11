"use client";

import { useState } from "react";
import { foundingOffer, proPrices } from "@/lib/pricing";

// The Pro card's price with a Monthly / Yearly switch. Yearly shows the per-month equivalent and the founding offer
// while it runs (the offer itself is checked at Checkout: places left and each workspace's 30-day window).

const tab = "px-3 py-[6px] font-plex text-[12px] font-semibold tracking-[0.6px] uppercase transition";

export function ProPrice() {
  const [yearly, setYearly] = useState(false);
  const offerOpen = Date.now() < Date.parse(foundingOffer.endsAt);
  const firstYear = Math.round((proPrices.year * (100 - foundingOffer.percentOff)) / 100);
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Billing period" className="flex w-fit outline outline-1 -outline-offset-1 outline-lk-line">
        {(["Monthly", "Yearly"] as const).map((label) => {
          const on = (label === "Yearly") === yearly;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => setYearly(label === "Yearly")}
              className={`${tab} ${on ? "bg-lk-lime text-lk-ink" : "text-lk-muted hover:text-lk-fg"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="flex items-end gap-2">
        <span className="text-[52px] leading-none font-semibold tracking-[-2px] text-lk-fg">
          ${yearly ? Math.round(proPrices.year / 12) : proPrices.month}
        </span>
        <span className="pb-1.5 font-plex text-[12.5px] tracking-[0.6px] text-lk-dim uppercase">
          {yearly ? `/ month, $${proPrices.year} a year` : "/ month"}
        </span>
      </p>
      {yearly && offerOpen && (
        <p className="font-plex text-[12.5px] leading-snug tracking-[0.4px] text-lk-lime">
          Founding offer: {foundingOffer.percentOff}% off your first year (${firstYear}) for the first {foundingOffer.places}{" "}
          customers, until {foundingOffer.until}.
        </p>
      )}
    </div>
  );
}
