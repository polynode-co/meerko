"use client";

import { useState, useTransition } from "react";
import type { ApprovalMode, SendingMode } from "@meerko/sdk";
import { setSendingMode } from "@/app/app/actions";
import { Card, cardTitle } from "@/components/app/ui";

const CHOICES: { key: keyof SendingMode; label: string; approve: string; auto: string }[] = [
  {
    key: "sequence_emails",
    label: "Sequence emails",
    approve: "I approve each one before it goes",
    auto: "Send them on schedule",
  },
  {
    key: "reply_drafts",
    label: "Answers to replies",
    approve: "I approve each draft before it goes",
    auto: "Send my agent's drafts as soon as they're written",
  },
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

  return (
    <Card id="sending-mode">
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>Approval before sending</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-lk-muted">
          Choose whether you read and approve every email first, or let Meerko send on its own. Approving is the safe default.
        </p>
      </div>
      {CHOICES.map((c) => (
        <fieldset key={c.key} disabled={!canManage || pending} className="flex flex-col gap-2 border-b border-lk-line px-[18px] py-4 last:border-0">
          <legend className="sr-only">{c.label}</legend>
          <span className="text-[15px] font-medium text-lk-fg">{c.label}</span>
          {(["approve", "auto"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-3 text-[15px] text-lk-muted">
              <input type="radio" name={c.key} checked={current[c.key] === v} onChange={() => choose(c.key, v)} className="accent-lk-lime" />
              {v === "approve" ? c.approve : c.auto}
            </label>
          ))}
        </fieldset>
      ))}
      {!canManage && <p className="px-[18px] py-3 text-[14px] text-lk-dim">Sign in to the dashboard to change this.</p>}
      {error && <p role="alert" className="px-[18px] py-3 text-[15px] text-[#e5795b]">{error}</p>}
    </Card>
  );
}
