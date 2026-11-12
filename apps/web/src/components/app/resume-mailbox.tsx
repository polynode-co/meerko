"use client";

import { useState, useTransition } from "react";
import { resumeMailbox } from "@/app/app/actions";
import { Modal } from "@/app/app/settings/dialog";
import { modalBody, modalFoot } from "@/app/app/settings/parts";
import { buttonClass } from "./ui";

/** Lifts the hold Meerko put on a mailbox (too many bounces or spam rejections), after a confirmation dialog. */
export function ResumeMailbox({ mailboxId, email }: { mailboxId: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const close = () => (setConfirming(false), setError(undefined));

  return (
    <>
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass("secondary", "sm")}>
        Resume sending
      </button>
      {confirming && (
        <Modal title={`Resume ${email}?`} onClose={close} width={480}>
          <div className={modalBody}>
            <p className="text-[13.5px] text-lk-muted">Fix what caused the hold first, or it will be held again.</p>
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
                    const res = await resumeMailbox(mailboxId);
                    if (!res.ok) setError(res.error);
                  })
                }
                className={buttonClass("primary")}
              >
                {pending ? "Resuming…" : "Resume sending"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
