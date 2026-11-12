"use client";

import { CheckCheck, Mail } from "lucide-react";
import { useState, useTransition } from "react";
import type { PendingEmail } from "@meerko/sdk";
import { approveEmails } from "@/app/app/actions";
import { buttonClass, Card, Pill } from "@/components/app/ui";

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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3e2a6] bg-ws-acc-soft px-4 py-2.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Mail className="size-4 shrink-0 text-ws-acc-ink" />
          <h2 className="text-[13.5px] font-semibold text-lk-fg">Waiting for your approval</h2>
          <span className="font-mono text-[12px] font-semibold text-ws-acc-ink">{total}</span>
          <span className="text-[12.5px] text-ws-acc-ink">Approved emails go when due; each follow-up waits again.</span>
        </span>
        <button onClick={() => act({ sequenceId })} disabled={pending} className={buttonClass("primary", "sm")}>
          <CheckCheck />
          {pending ? "Approving…" : `Approve all ${total}`}
        </button>
      </div>
      {result && (
        <p role="status" className={`border-b border-lk-line px-4 py-2.5 text-[13px] ${result.ok ? "bg-ws-green-soft text-ws-green" : "bg-ws-red-soft text-ws-red"}`}>
          {result.text}
        </p>
      )}
      {emails.map((e) => (
        <div key={e.enrollment_id} className="grid gap-x-6 gap-y-2 border-b border-lk-line px-4 py-3.5 last:border-0 md:grid-cols-[220px_minmax(0,1fr)_auto]">
          <span className="flex min-w-0 items-start gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ws-soft text-[11px] font-semibold text-lk-muted uppercase">{e.to.slice(0, 2)}</span>
            <span className="min-w-0 truncate pt-1.5 font-mono text-[11.5px] text-lk-fg">{e.to}</span>
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Pill>Email {e.step}</Pill>
              {e.send_at && <span className="font-mono text-[11px] text-lk-dim">due {when(e.send_at)}</span>}
            </span>
            <span className="text-[13px] font-semibold text-lk-fg">{e.subject}</span>
            <span className="text-[13px] leading-relaxed whitespace-pre-line text-lk-muted">{e.body}</span>
          </span>
          <span>
            <button onClick={() => act({ enrollmentIds: [e.enrollment_id] })} disabled={pending} className={buttonClass("secondary", "sm")}>
              Approve
            </button>
          </span>
        </div>
      ))}
      {total > emails.length && (
        <p className="bg-ws-head px-4 py-2.5 text-[12px] text-lk-dim">
          Showing the next {emails.length} of {total} · Approve all covers every one
        </p>
      )}
    </Card>
  );
}
