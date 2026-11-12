"use client";

import { useState, useTransition } from "react";
import { setDigest } from "@/app/app/actions";
import { Switch } from "@/app/app/settings/dialog";

/**
 * The owner's daily email of replies waiting: on by default, turned off here or from the email's own link. Rendered as
 * a block inside the Notifications card.
 */
export function DigestCard({ enabled, lastSentAt }: { enabled: boolean; lastSentAt: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const toggle = () =>
    start(async () => {
      const res = await setDigest(!enabled);
      setError(res.ok ? undefined : res.error);
    });

  return (
    <div id="digest" className="flex min-h-14 scroll-mt-6 flex-wrap items-center gap-x-4 gap-y-2 border-b border-lk-line px-4 py-3 last:border-0">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-lk-fg">Daily digest</span>
        <span className="font-mono text-[11px] text-lk-dim">
          replies waiting, each morning{lastSentAt ? ` · last sent ${new Date(lastSentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
        </span>
        {error && (
          <span role="alert" className="text-[12px] text-ws-red">
            {error}
          </span>
        )}
      </span>
      <Switch on={enabled} onClick={toggle} disabled={pending} label={enabled ? "Turn the daily digest off" : "Turn the daily digest on"} />
    </div>
  );
}
