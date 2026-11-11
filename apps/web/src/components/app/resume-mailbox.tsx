"use client";

import { useState, useTransition } from "react";
import { resumeMailbox } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Lifts the hold Meerko put on a mailbox (too many bounces or spam rejections), after an inline confirmation. */
export function ResumeMailbox({ mailboxId, email }: { mailboxId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("secondary", "sm")}>
        Resume
      </button>
    );
  }
  return (
    <span className="flex basis-full flex-wrap items-center justify-end gap-2 text-[15px]">
      <span className={error ? "text-[#e5795b]" : undefined}>
        {error ?? `Resume ${email}? Fix what caused the hold first, or it will be held again.`}
      </span>
      {!error && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await resumeMailbox(mailboxId);
              if (!res.ok) setError(res.error);
            })
          }
          className={buttonClass("primary", "sm")}
        >
          {pending ? "Resuming…" : "Resume sending"}
        </button>
      )}
      <button type="button" onClick={() => (setConfirming(false), setError(undefined))} className={buttonClass("ghost")}>
        Cancel
      </button>
    </span>
  );
}
