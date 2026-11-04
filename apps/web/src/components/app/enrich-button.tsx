"use client";

import { MailSearch } from "lucide-react";
import { useState, useTransition } from "react";
import { enrichEmails, type ActionResult } from "@/app/app/actions";
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
