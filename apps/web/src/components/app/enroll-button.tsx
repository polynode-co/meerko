"use client";

import { UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { enrollTable, type ActionResult } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Adds everyone in the sequence's table who can be emailed; people without an email or a placeholder value are skipped. */
export function EnrollButton({ sequenceId, tableName }: { sequenceId: string; tableName: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button disabled={pending} onClick={() => start(async () => setResult(await enrollTable(sequenceId)))} className={buttonClass("primary")}>
        <UserPlus className="size-[15px]" />
        {pending ? "Adding…" : `Add everyone from ${tableName}`}
      </button>
      {result && <span role="status" className={`text-sm ${result.ok ? "text-lk-dim" : "text-[#e5795b]"}`}>{result.ok ? result.message : result.error}</span>}
    </div>
  );
}
