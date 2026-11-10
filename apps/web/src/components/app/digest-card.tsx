"use client";

import { useState, useTransition } from "react";
import { setDigest } from "@/app/app/actions";
import { buttonClass, Card, cardTitle, Pill } from "@/components/app/ui";

/** The owner's daily email of replies waiting: on by default, turned off here or from the email's own link. */
export function DigestCard({ enabled, lastSentAt }: { enabled: boolean; lastSentAt: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const toggle = () =>
    start(async () => {
      const res = await setDigest(!enabled);
      setError(res.ok ? undefined : res.error);
    });

  return (
    <Card id="digest">
      <div className="flex flex-wrap items-center gap-4 px-[18px] py-4">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-3">
            <h2 className={cardTitle}>Daily digest</h2>
            <Pill tone={enabled ? "solid" : "neutral"}>{enabled ? "on" : "off"}</Pill>
          </span>
          <span className="text-[15px] leading-relaxed text-lk-muted">
            One email a morning when people have replied, with who and how many are waiting. Nothing new, no email.
            {lastSentAt ? ` Last sent ${new Date(lastSentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.` : ""}
          </span>
          {error && <span role="alert" className="text-[15px] text-[#e5795b]">{error}</span>}
        </span>
        <button onClick={toggle} disabled={pending} className={buttonClass("secondary", "sm")}>
          {pending ? "Saving…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
    </Card>
  );
}
