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
    // A long table name truncates on a phone instead of pushing the button out of the card.
    <div className="flex max-w-full min-w-0 flex-wrap items-center justify-end gap-3">
      <button
        disabled={pending}
        onClick={() => start(async () => setResult(await enrollTable(sequenceId)))}
        className={`${buttonClass("secondary", "sm")} max-w-full`}
        title={`Add everyone from ${tableName}`}
      >
        <UserPlus className="shrink-0" />
        <span className="truncate">{pending ? "Adding…" : `Add everyone from ${tableName}`}</span>
      </button>
      {result && <span role="status" className={`text-[12.5px] ${result.ok ? "text-ws-green" : "text-ws-red"}`}>{result.ok ? result.message : result.error}</span>}
    </div>
  );
}
