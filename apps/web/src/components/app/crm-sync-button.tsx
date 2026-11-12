"use client";

import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { syncCrmBatch } from "@/app/app/actions";
import { buttonClass } from "./ui";

const NAMES = { hubspot: "HubSpot", attio: "Attio" } as const;

/** Pushes the table's rows that aren't in the CRM yet (or changed stage since), 100 per pass, counting up. */
export function CrmSyncButton({ tableId, provider }: { tableId: string; provider: "hubspot" | "attio" }) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async () => {
    setRunning(true);
    setStatus(null);
    let synced = 0;
    let skipped = 0;
    let failed = 0;
    let firstError: string | undefined;
    try {
      for (;;) {
        const r = await syncCrmBatch(tableId);
        if (!r.ok) {
          setStatus({ ok: false, text: r.error });
          return;
        }
        synced += r.synced;
        skipped += r.skipped;
        failed += r.failed;
        firstError ??= r.errors[0];
        setStatus({ ok: true, text: `${synced} pushed…` });
        if (r.remaining === 0 || r.synced + r.skipped === 0) break;
      }
      const parts = [`${synced} pushed to ${NAMES[provider]}`];
      if (skipped) parts.push(`${skipped} without an email skipped`);
      if (failed) parts.push(`${failed} failed${firstError ? `: ${firstError}` : ""}`);
      setStatus({ ok: failed === 0, text: synced + skipped + failed === 0 ? `Everything is already in ${NAMES[provider]}` : parts.join(", ") });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {status && (
        <span role="status" aria-live="polite" className={`max-w-xs text-[12.5px] ${status.ok ? "text-lk-muted" : "text-ws-red"}`}>
          {status.text}
        </span>
      )}
      <button disabled={running} onClick={run} className={buttonClass("ghost")} title={`Push rows not yet in ${NAMES[provider]}, matched by email`}>
        <CloudUpload className={running ? "animate-pulse text-ws-acc-ink" : ""} />
        {running ? "Syncing…" : `Sync to ${NAMES[provider]}`}
      </button>
    </div>
  );
}
