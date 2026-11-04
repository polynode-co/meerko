"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteTable } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Deletes the table after an inline confirmation (no browser dialog). Refused while a sequence is sending to it. */
export function DeleteTable({ tableId, rowCount }: { tableId: string; rowCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost")} aria-label="Delete table">
        <Trash2 className="size-[15px]" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[15px]">
      <span>{error ?? `Delete the table and its ${rowCount.toLocaleString("en")} leads?`}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteTable(tableId);
            if (!res.ok) setError(res.error);
          })
        }
        className={buttonClass("danger")}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <button type="button" onClick={() => (setConfirming(false), setError(undefined))} className={buttonClass("ghost")}>
        Cancel
      </button>
    </span>
  );
}
