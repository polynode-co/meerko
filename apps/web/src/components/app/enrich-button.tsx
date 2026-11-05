"use client";

import { MailSearch, Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { enrichEmails, findPhones, type ActionResult } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Finds and verifies emails for up to 25 rows per click (each row takes a few seconds). */
export function EnrichButton({ tableId }: { tableId: string }) {
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
        onClick={() => start(async () => setResult(await enrichEmails(tableId)))}
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
