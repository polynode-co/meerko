"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { disconnectMailbox } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Removes a mailbox after an inline confirmation (no browser dialog). Refused while it's a sequence's only sender. */
export function DisconnectMailbox({ mailboxId, email }: { mailboxId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("ghost")} aria-label={`Disconnect ${email}`}>
        <Trash2 className="size-[15px]" />
      </button>
    );
  }
  return (
    <span className="flex basis-full flex-wrap items-center justify-end gap-2 text-[13px]">
      <span className={error ? "text-[#e5795b]" : undefined}>{error ?? `Disconnect ${email}? Meerko stops sending from it and checking it for replies.`}</span>
      {!error && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await disconnectMailbox(mailboxId);
              if (!res.ok) setError(res.error);
            })
          }
          className={`${buttonClass("ghost")} text-[#e5795b]`}
        >
          {pending ? "Disconnecting…" : "Disconnect"}
        </button>
      )}
      <button type="button" onClick={() => (setConfirming(false), setError(undefined))} className={buttonClass("ghost")}>
        Cancel
      </button>
    </span>
  );
}
