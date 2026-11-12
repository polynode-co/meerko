"use client";

import { useState, useTransition } from "react";
import type { ApprovalMode, SendingMode } from "@meerko/sdk";
import { setSendingMode } from "@/app/app/actions";
import { SectionHead } from "@/app/app/settings/parts";

const CHOICES: { key: keyof SendingMode; label: string; approve: string; auto: string }[] = [
  { key: "sequence_emails", label: "Sequence emails", approve: "Approve each one", auto: "Send on schedule" },
  { key: "reply_drafts", label: "Answers to replies", approve: "Approve each draft", auto: "Send as soon as drafted" },
];

/** Whether a person approves every email first (the default) or Meerko sends on its own, chosen once at setup. */
export function SendingModeCard({ mode, canManage }: { mode: SendingMode; canManage: boolean }) {
  const [current, setCurrent] = useState(mode);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const choose = (key: keyof SendingMode, value: ApprovalMode) =>
    start(async () => {
      const res = await setSendingMode({ [key]: value });
      if (res.ok) setCurrent((m) => ({ ...m, [key]: value }));
      setError(res.ok ? undefined : res.error);
    });
  const modes = new Set(CHOICES.map((c) => current[c.key]));

  return (
    <section id="sending-mode" className="scroll-mt-6">
      <SectionHead title="Sending" note={modes.size > 1 ? "mixed mode" : modes.has("approve") ? "approve mode" : "sends on its own"} />
      <div className="border-y border-lk-line">
        {CHOICES.map((c) => (
          <fieldset key={c.key} disabled={!canManage || pending} className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-lk-line py-2.5 last:border-0">
            <legend className="sr-only">{c.label}</legend>
            <span className="text-[13.5px] font-medium text-lk-fg">{c.label}</span>
            <span className="inline-flex rounded-md border border-lk-line bg-white p-0.5">
              {(["approve", "auto"] as const).map((v) => (
                <label
                  key={v}
                  className="cursor-pointer rounded px-2.5 py-[5px] text-[12.5px] text-lk-muted transition hover:text-lk-fg has-[:checked]:bg-lk-fg has-[:checked]:font-medium has-[:checked]:text-white has-[:disabled]:cursor-default has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lk-gray"
                >
                  <input type="radio" name={c.key} checked={current[c.key] === v} onChange={() => choose(c.key, v)} className="sr-only" />
                  {v === "approve" ? c.approve : c.auto}
                </label>
              ))}
            </span>
          </fieldset>
        ))}
      </div>
      {!canManage && <p className="pt-2 text-[12.5px] text-lk-dim">Sign in to the dashboard to change this.</p>}
      {error && (
        <p role="alert" className="pt-2 text-[13px] text-ws-red">
          {error}
        </p>
      )}
    </section>
  );
}
