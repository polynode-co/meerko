"use client";

import { MailSearch, Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { enrichEmails, findPhones, type ActionResult } from "@/app/app/actions";
import { buttonClass } from "./ui";

/**
 * Finds and verifies emails for up to 25 rows per click (each row takes a few seconds). With an ICP, it offers to
 * spend credits on good fits (70+) only, on by default.
 */
export function EnrichButton({ tableId, scored = false }: { tableId: string; scored?: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [goodFitsOnly, setGoodFitsOnly] = useState(true);
  return (
    <div className="flex items-center gap-3">
      {scored && (
        <label className="flex items-center gap-2 font-plex text-[12px] tracking-[0.6px] text-lk-muted uppercase" title="Only leads whose ICP fit is 70 or more">
          <input type="checkbox" checked={goodFitsOnly} onChange={(e) => setGoodFitsOnly(e.target.checked)} className="size-3.5 accent-lk-lime" />
          Fit 70+ only
        </label>
      )}
      {result && (
        <span role="status" className={`max-w-xs text-sm ${result.ok ? "text-lk-dim" : "text-[#e5795b]"}`}>
          {result.ok ? result.message : result.error}
        </span>
      )}
      <button
        disabled={pending}
        onClick={() => start(async () => setResult(await enrichEmails(tableId, scored && goodFitsOnly ? 70 : undefined)))}
        className={buttonClass("secondary")}
      >
        <MailSearch className="size-[15px]" />
        {pending ? "Finding emails…" : "Find & verify emails"}
      </button>
    </div>
  );
}

/** Finds phone numbers for up to 25 rows per click: 80 credits per number found, on Pro or your own Generect key. */
export function PhoneButton({ tableId }: { tableId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="flex items-center gap-3">
      {result && (
        <span role="status" className={`max-w-xs text-sm ${result.ok ? "text-lk-dim" : "text-[#e5795b]"}`}>
          {result.ok ? result.message : result.error}
        </span>
      )}
      <button
        disabled={pending}
        onClick={() => start(async () => setResult(await findPhones(tableId)))}
        className={buttonClass("ghost")}
        title="80 credits per number found; misses are free"
      >
        <Phone className="size-[15px]" />
        {pending ? "Finding phones…" : "Find phones"}
      </button>
    </div>
  );
}
