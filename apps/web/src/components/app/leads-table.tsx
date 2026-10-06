"use client";

import { Loader, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import type { Row } from "@meerko/sdk";
import { STAGES } from "@meerko/sdk/constants";
import { moveStage } from "@/app/app/actions";
import { buttonClass, Pill, stageTone } from "./ui";

export interface LeadColumn {
  key: string;
  name: string;
  kind: "person" | "company" | "email" | "ai" | "plain";
  prompt?: string;
}

const certainty: Record<string, [string, string]> = {
  ultra_sure: ["bg-signal", "verified"],
  very_sure: ["bg-signal", "verified"],
  probable: ["bg-accent", "probable"],
  not_found: ["bg-muted", "not found"],
  undeliverable: ["bg-[#e5795b]", "bounces"],
};
const certaintyText: Record<string, string> = { "bg-signal": "text-signal", "bg-accent": "text-accent", "bg-muted": "text-muted", "bg-[#e5795b]": "text-[#e5795b]" };
const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Cell({ col, data }: { col: LeadColumn; data: Record<string, unknown> }) {
  if (col.kind === "person") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{[str(data.first_name), str(data.last_name)].join(" ").trim() || "—"}</span>
        {!!data.title && <span className="text-xs text-muted">{str(data.title)}</span>}
      </div>
    );
  }
  if (col.kind === "company") {
    return (
      <div className="flex flex-col gap-0.5">
        <span>{str(data.company) || "—"}</span>
        {!!data.domain && <span className="font-mono text-[11px] text-muted">{str(data.domain)}</span>}
      </div>
    );
  }
  if (col.kind === "email") {
    if (data.email_certainty === "missing_input") return <span className="text-xs text-muted italic">no name or domain · skipped</span>;
    const status = str(data.email_verification) || str(data.email_certainty);
    const [dot, text] = certainty[status] ?? (data.email ? ["bg-muted", "unverified"] : [null, ""]);
    if (!dot) return <span className="text-muted">—</span>;
    return (
      <div className="flex items-center gap-2">
        <span className={`size-[7px] shrink-0 rounded-full ${dot}`} />
        {!!data.email && <span className="truncate font-mono text-xs">{str(data.email)}</span>}
        <span className={`text-[11px] whitespace-nowrap ${certaintyText[dot]}`}>{text}</span>
      </div>
    );
  }
  const value = str(data[col.key]);
  if (col.kind === "ai") {
    if (!value) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/50 px-2 py-1 font-mono text-[11px] text-accent/80">
          <Loader className="size-3" /> agent pending
        </span>
      );
    }
    // A leading 1-5 score ("4 · social is 60% of revenue") renders as a badge plus the reason.
    const scored = value.match(/^([1-5])(?:\s*[·|:—–-]\s*|\s+|$)(.*)$/s);
    if (scored) {
      const [, score, why] = scored;
      const high = Number(score) >= 4;
      return (
        <div className="flex items-center gap-2">
          <span className={`grid size-[22px] shrink-0 place-items-center rounded-[5px] font-mono text-xs font-bold ${high ? "bg-accent-soft text-accent" : "bg-line text-muted"}`}>{score}</span>
          {why && <span className="line-clamp-2 text-xs text-muted">{why}</span>}
        </div>
      );
    }
    return <span className="line-clamp-2 text-[13px]">{value}</span>;
  }
  if (/^https?:\/\//.test(value)) {
    const host = (value.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] ?? "link").toLowerCase();
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-xs whitespace-nowrap text-accent hover:underline">
        {host.endsWith("linkedin.com") ? "LinkedIn" : host} ↗
      </a>
    );
  }
  return <span className="line-clamp-2 text-[13px]">{value || <span className="text-muted">—</span>}</span>;
}

export function LeadsTable({ tableId, columns, rows }: { tableId: string; columns: LeadColumn[]; rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));
  const all = rows.length > 0 && selected.size === rows.length;

  const move = (stage: string) =>
    start(async () => {
      const res = await moveStage(tableId, [...selected], stage);
      setMessage(res.ok ? (res.message ?? null) : res.error);
      if (res.ok) setSelected(new Set());
    });

  return (
    <div className="flex flex-col gap-3">
      {(selected.size > 0 || message) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-[13px]">
          {selected.size > 0 ? (
            <>
              <span className="font-semibold">{selected.size} selected</span>
              <span className="text-muted">Move to</span>
              {STAGES.map((s) => (
                <button key={s} disabled={pending} onClick={() => move(s)} className={`${buttonClass("ghost")} px-2.5 py-1 text-xs capitalize`}>
                  {s}
                </button>
              ))}
            </>
          ) : (
            <span className="text-muted">{message}</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-[10px] border border-line">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead className="bg-raised">
            <tr className="border-b border-line">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-3.5 accent-accent"
                />
              </th>
              {columns.map((c) => (
                <th key={c.key} title={c.prompt} className={`px-3 py-2.5 font-mono text-[11px] font-normal tracking-[0.06em] uppercase ${c.kind === "ai" ? "text-accent" : "text-muted"}`}>
                  <span className="inline-flex items-center gap-1.5">
                    {c.kind === "ai" && <Sparkles className="size-3" />}
                    {c.name.replace(/_/g, " ").replace(/\burl\b/i, "").trim()}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 font-mono text-[11px] font-normal tracking-[0.06em] text-muted uppercase">Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-14 text-center text-muted">
                  No rows at this stage.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-line last:border-0 ${selected.has(r.id) ? "bg-accent/[0.04]" : "hover:bg-raised/60"}`}>
                <td className="px-3 py-3 align-middle">
                  <input type="checkbox" aria-label="Select row" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-3.5 accent-accent" />
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="max-w-[280px] px-3 py-3 align-middle">
                    <Cell col={c} data={r.data} />
                  </td>
                ))}
                <td className="px-3 py-3 align-middle">
                  <Pill tone={stageTone[r.stage]}>{r.stage}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
