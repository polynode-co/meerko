"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteSequence } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Deletes the sequence after an inline confirmation (no browser dialog). Refused while it is sending. */
export function DeleteSequence({ sequenceId, name }: { sequenceId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost")} aria-label="Delete sequence">
        <Trash2 className="size-[15px]" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-[15px]">
      <span>{error ?? `Delete "${name}"? Leads and replies stay.`}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteSequence(sequenceId);
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
