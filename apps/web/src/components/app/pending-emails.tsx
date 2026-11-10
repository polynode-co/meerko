"use client";

import { useState, useTransition } from "react";
import type { PendingEmail } from "@meerko/sdk";
import { approveEmails } from "@/app/app/actions";
import { buttonClass, Card, cardTitle, monoLabel } from "@/components/app/ui";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Sequence emails waiting for the person's approval, each as the lead will get it. Approving one lets it go when due. */
export function PendingEmails({ sequenceId, emails, total }: { sequenceId: string; emails: PendingEmail[]; total: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  const act = (input: { enrollmentIds?: string[]; sequenceId?: string }) =>
    start(async () => {
      const res = await approveEmails(input);
      setResult(res.ok ? { ok: true, text: res.message ?? "Approved" } : { ok: false, text: res.error });
    });

  return (
    <Card id="approval">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lk-line px-[18px] py-4">
        <span className="flex flex-col gap-1">
          <h2 className={cardTitle}>
            Waiting for your approval <span className="ml-2 font-plex text-[13px] font-normal text-lk-dim">{total}</span>
          </h2>
          <span className="text-[15px] text-lk-muted">Nothing goes until you approve it. An approved email goes when it&apos;s due; its follow-up waits for you again.</span>
        </span>
        <button onClick={() => act({ sequenceId })} disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Approving…" : `Approve all ${total}`}
        </button>
      </div>
      {result && <p role="status" className={`border-b border-lk-line px-[18px] py-3 text-[15px] ${result.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{result.text}</p>}
      {emails.map((e) => (
        <div key={e.enrollment_id} className="flex flex-col gap-2 border-b border-lk-line px-[18px] py-4 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={monoLabel}>
              Email {e.step} to <span className="text-lk-fg normal-case">{e.to}</span>
              {e.send_at ? ` · due ${when(e.send_at)}` : ""}
            </span>
            <button onClick={() => act({ enrollmentIds: [e.enrollment_id] })} disabled={pending} className={buttonClass("secondary", "sm")}>
              Approve
            </button>
          </div>
          <p className="text-[15px] font-medium text-lk-fg">{e.subject}</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-lk-muted">{e.body}</p>
        </div>
      ))}
      {total > emails.length && <p className="px-[18px] py-3 text-[14px] text-lk-dim">Showing the next {emails.length}. Approve all covers every one waiting.</p>}
    </Card>
  );
}
