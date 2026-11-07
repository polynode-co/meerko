"use client";

import { Loader, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { Row } from "@meerko/sdk";
import { STAGES } from "@meerko/sdk/constants";
import { deleteRows, moveStage } from "@/app/app/actions";
import { ScoreRing } from "./score-ring";
import { buttonClass, Pill, stageTone, thText } from "./ui";

export interface LeadColumn {
  key: string;
  name: string;
  kind: "person" | "company" | "email" | "ai" | "plain";
  prompt?: string;
}

const certainty: Record<string, [string, string]> = {
  ultra_sure: ["bg-lk-lime", "verified"],
  very_sure: ["bg-lk-lime", "verified"],
  probable: ["bg-lk-muted", "probable"],
  not_found: ["bg-lk-gray", "not found"],
  undeliverable: ["bg-[#e5795b]", "bounces"],
};
const certaintyText: Record<string, string> = { "bg-lk-lime": "text-lk-lime", "bg-lk-muted": "text-lk-muted", "bg-lk-gray": "text-lk-dim", "bg-[#e5795b]": "text-[#e5795b]" };
const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Cell({ col, data }: { col: LeadColumn; data: Record<string, unknown> }) {
  if (col.kind === "person") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-lk-fg">{[str(data.first_name), str(data.last_name)].join(" ").trim() || "—"}</span>
        {!!data.title && <span className="text-sm text-lk-dim">{str(data.title)}</span>}
      </div>
    );
  }
  if (col.kind === "company") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-lk-muted">{str(data.company) || "—"}</span>
        {!!data.domain && <span className="font-plex text-[12px] text-lk-dim">{str(data.domain)}</span>}
      </div>
    );
  }
  if (col.kind === "email") {
    if (data.email_certainty === "missing_input") return <span className="text-sm text-lk-dim italic">no name or domain · skipped</span>;
    const status = str(data.email_verification) || str(data.email_certainty);
    const [dot, text] = certainty[status] ?? (data.email ? ["bg-lk-gray", "unverified"] : [null, ""]);
    if (!dot) return <span className="text-lk-dim">—</span>;
    return (
      <div className="flex items-center gap-2">
        <span className={`size-[7px] shrink-0 ${dot}`} />
        {!!data.email && <span className="truncate font-plex text-[14px] text-lk-muted">{str(data.email)}</span>}
        <span className={`font-plex text-[12px] tracking-[0.6px] whitespace-nowrap uppercase ${certaintyText[dot]}`}>{text}</span>
      </div>
    );
  }
  const value = str(data[col.key]);
  if (col.kind === "ai") {
    if (!value) {
      return (
        <span className="inline-flex items-center gap-1.5 border border-lk-lime/50 px-2 py-1 font-plex text-[12px] text-lk-lime/80">
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
          <span className={`grid size-[22px] shrink-0 place-items-center font-plex text-sm font-bold ${high ? "bg-lk-lime/[0.08] text-lk-lime" : "bg-lk-line text-lk-dim"}`}>{score}</span>
          {why && <span className="line-clamp-2 text-sm text-lk-dim">{why}</span>}
        </div>
      );
    }
    return <span className="line-clamp-2 text-[15px] text-lk-muted">{value}</span>;
  }
  if (/^https?:\/\//.test(value)) {
    const host = (value.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] ?? "link").toLowerCase();
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-sm whitespace-nowrap text-lk-lime hover:underline">
        {host.endsWith("linkedin.com") ? "LinkedIn" : host} ↗
      </a>
    );
  }
  return <span className="line-clamp-2 text-[15px] text-lk-muted">{value || <span className="text-lk-dim">—</span>}</span>;
}

export function LeadsTable({ tableId, columns, rows }: { tableId: string; columns: LeadColumn[]; rows: Row[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));
  const all = rows.length > 0 && selected.size === rows.length;
  // The Fit column appears once the workspace has an ICP (any row with a score).
  const scored = rows.some((r) => r.icp?.score !== null && r.icp?.score !== undefined);

  // Deleting asks once more inline (no browser dialog), since it can't be undone.
  const [confirming, setConfirming] = useState(false);
  const act = (fn: () => ReturnType<typeof moveStage>) =>
    start(async () => {
      const res = await fn();
      setMessage(res.ok ? (res.message ?? null) : res.error);
      setConfirming(false);
      if (res.ok) setSelected(new Set());
    });
  const move = (stage: string) => act(() => moveStage(tableId, [...selected], stage));

  return (
    <div className="flex flex-col">
      {(selected.size > 0 || message) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-lk-lime/40 bg-lk-lime/[0.07] px-[18px] py-2.5 text-[15px]">
          {selected.size > 0 ? (
            <>
              <span className="font-semibold text-lk-fg">{selected.size} selected</span>
              <span className="text-lk-dim">Move to</span>
              {STAGES.map((s) => (
                <button key={s} disabled={pending} onClick={() => move(s)} className={buttonClass("ghost", "sm")}>
                  {s}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-2">
                {confirming ? (
                  <>
                    <span className="text-sm">Delete {selected.size} for good? Their sequences stop.</span>
                    <button disabled={pending} onClick={() => act(() => deleteRows(tableId, [...selected]))} className={buttonClass("danger", "sm")}>
                      Delete
                    </button>
                    <button disabled={pending} onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button disabled={pending} onClick={() => setConfirming(true)} className={buttonClass("ghost", "sm")}>
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                )}
              </span>
            </>
          ) : (
            <span className="text-lk-dim">{message}</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-[15px]">
          <thead className="bg-lk-ink">
            <tr className="border-b border-lk-line">
              <th className="w-10 py-2.5 pr-2 pl-[18px]">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-3.5 accent-lk-lime"
                />
              </th>
              {scored && (
                <th className={`py-2.5 pr-1 pl-2 ${thText}`} title="How well each lead fits your ideal customer. Hover a score for why.">
                  Fit
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} title={c.prompt} className={`px-3 py-2.5 whitespace-nowrap ${thText} ${c.kind === "ai" ? "!text-lk-lime" : ""}`}>
                  <span className="inline-flex items-center gap-1.5">
                    {c.kind === "ai" && <Sparkles className="size-3" />}
                    {c.name.replace(/_/g, " ").replace(/\burl\b/i, "").trim()}
                  </span>
                </th>
              ))}
              <th className={`py-2.5 pr-[18px] pl-3 ${thText}`}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (scored ? 3 : 2)} className="px-3 py-14 text-center text-lk-dim">
                  No rows at this stage.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-lk-line last:border-0 ${selected.has(r.id) ? "bg-lk-lime/[0.04]" : "hover:bg-lk-frame"}`}>
                <td className="py-3 pr-2 pl-[18px] align-middle">
                  <input type="checkbox" aria-label="Select row" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-3.5 accent-lk-lime" />
                </td>
                {scored && (
                  <td className="py-3 pr-1 pl-2 align-middle">
                    <ScoreRing fit={r.icp} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className="max-w-[280px] px-3 py-3 align-middle">
                    <Cell col={c} data={r.data} />
                  </td>
                ))}
                <td className="py-3 pr-[18px] pl-3 align-middle">
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
