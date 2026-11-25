"use client";

import { Loader, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lead, Row } from "@meerko/sdk";
import { getLead } from "@/app/app/actions";
import { ScoreRing } from "./score-ring";
import { Thread } from "./thread";
import { monoLabel, Pill, stageTone } from "./ui";

export type LeadField = { key: string; name: string };

const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

const sequenceState: Record<string, string> = {
  active: "in progress",
  completed: "finished, no reply",
  replied: "replied",
  bounced: "bounced",
  unsubscribed: "unsubscribed",
  failed: "failed",
  stopped: "stopped",
};

/**
 * A lead opened from the table: every field in full (long descriptions and locations aren't cut), its stage and fit,
 * the sequences it's in, and the emails sent to it with its replies. The row is shown at once; its history loads.
 */
export function LeadPanel({ tableId, row, fields, onClose }: { tableId: string; row: Row; fields: LeadField[]; onClose: () => void }) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    setLead(null);
    setError(undefined);
    getLead(tableId, row.id).then((res) => {
      if (!live) return;
      if (res.ok) setLead(res.lead);
      else setError(res.error);
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      live = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [tableId, row.id, onClose]);

  const data = lead?.row.data ?? row.data;
  const name = [str(data.first_name), str(data.last_name)].join(" ").trim();
  const title = name || str(data.company) || str(data.email) || "Lead";
  const subtitle = [name ? str(data.title) : "", name ? str(data.company) : ""].filter(Boolean).join(" · ");
  // Table columns first, in their order, then anything else the row holds.
  const keys = [...fields.map((f) => f.key), ...Object.keys(data).filter((k) => !fields.some((f) => f.key === k))];
  const labelOf = (key: string) => fields.find((f) => f.key === key)?.name ?? key;
  const filled = keys.filter((k) => str(data[k]) !== "");
  const empty = keys.length - filled.length;
  const emails = lead?.emails ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-lk-fg/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="flex h-full w-full max-w-[560px] flex-col border-l border-lk-line bg-white shadow-[0_12px_40px_rgba(22,22,26,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-lk-line px-5 py-3.5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-[15px] font-semibold break-words text-lk-fg">{title}</h2>
            {subtitle && <span className="text-[12.5px] text-lk-muted">{subtitle}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <Pill tone={stageTone[row.stage]}>{lead?.row.stage ?? row.stage}</Pill>
              {row.icp?.score !== null && row.icp?.score !== undefined && (
                <span className="flex items-center gap-1.5 text-[12px] text-lk-muted">
                  <ScoreRing fit={row.icp} /> fit
                </span>
              )}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-lk-dim hover:bg-lk-frame hover:text-lk-fg">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
          {row.icp?.reason && <p className="text-[12.5px] text-lk-muted">{row.icp.reason}</p>}

          <section className="flex flex-col gap-2">
            <h3 className={monoLabel}>Details</h3>
            <dl className="grid grid-cols-[minmax(96px,150px)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
              {filled.map((k) => {
                const value = str(data[k]);
                return (
                  <div key={k} className="contents">
                    <dt className="font-mono text-[11px] leading-5 break-words text-lk-dim">{labelOf(k).replace(/_/g, " ")}</dt>
                    <dd className="min-w-0 break-words whitespace-pre-line text-lk-fg">
                      {/^https?:\/\//.test(value) ? (
                        <a href={value} target="_blank" rel="noreferrer" className="break-all text-ws-blue hover:underline">
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
            {empty > 0 && <span className="text-[12px] text-lk-dim">{empty} empty {empty === 1 ? "field" : "fields"} not shown</span>}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className={monoLabel}>Sequences</h3>
            {!lead && !error ? (
              <span className="flex items-center gap-2 text-[12.5px] text-lk-dim">
                <Loader className="size-3.5 animate-spin" /> Loading
              </span>
            ) : error ? (
              <span role="alert" className="text-[12.5px] text-ws-red">
                {error}
              </span>
            ) : lead!.sequences.length === 0 ? (
              <span className="text-[12.5px] text-lk-muted">Not in a sequence yet.</span>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {lead!.sequences.map((s) => (
                  <li key={s.sequenceId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-lk-line px-3 py-2 text-[13px]">
                    <Link href={`/app/sequences/${s.sequenceId}`} className="font-medium text-lk-fg hover:underline">
                      {s.sequenceName}
                    </Link>
                    <span className="font-mono text-[11.5px] text-lk-muted">
                      {sequenceState[s.state] ?? s.state} · {s.stepsSent} sent
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {lead && (
            <section className="flex flex-col gap-2">
              <h3 className={monoLabel}>
                Emails · {emails.filter((m) => m.direction === "out").length} sent, {emails.filter((m) => m.direction === "in").length}{" "}
                {emails.filter((m) => m.direction === "in").length === 1 ? "reply" : "replies"}
              </h3>
              {emails.length === 0 ? <span className="text-[12.5px] text-lk-muted">Nothing sent yet.</span> : <Thread messages={emails} prospect={title} />}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
