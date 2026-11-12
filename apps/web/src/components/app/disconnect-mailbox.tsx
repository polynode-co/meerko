"use client";

import { Mail, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { disconnectMailbox } from "@/app/app/actions";
import { Modal } from "@/app/app/settings/dialog";
import { dangerSolid, modalBody, modalFoot } from "@/app/app/settings/parts";
import { buttonClass } from "./ui";

// "WS3 · Modal · Disconnect mailbox" (xI3j9) in docs/design/meerko.pen.

/** Removes a mailbox after a confirmation dialog. Refused while it's a sequence's only sender. */
export function DisconnectMailbox({ mailboxId, email, limit }: { mailboxId: string; email: string; /** Shown beside the address, e.g. "40/day". */ limit?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const close = () => (setConfirming(false), setError(undefined));

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className={`${buttonClass("ghost", "sm")} px-1.5`} aria-label={`Disconnect ${email}`}>
        <Trash2 />
      </button>
      {confirming && (
        <Modal title={`Disconnect ${email}?`} onClose={close} width={480}>
          <div className={modalBody}>
            <p className="text-[13.5px] text-lk-muted">Meerko stops sending from it and checking it for replies.</p>
            <div className="flex items-center gap-3 rounded-lg border border-lk-line bg-lk-frame px-3 py-2.5">
              <span className="grid size-6 shrink-0 place-items-center rounded bg-ws-blue-soft text-ws-blue">
                <Mail className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-lk-fg">{email}</span>
              {limit && <span className="font-mono text-[11px] text-lk-dim">{limit}</span>}
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-ws-red">
                {error}
              </p>
            )}
          </div>
          <div className={modalFoot}>
            <button type="button" onClick={close} className={buttonClass("secondary")}>
              Cancel
            </button>
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
                className={dangerSolid}
              >
                {pending ? "Disconnecting…" : "Disconnect"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
