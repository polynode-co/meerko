"use client";

import { Loader, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import type { Row } from "@meerko/sdk";
import { isPlatformHost, siteHost, STAGES } from "@meerko/sdk/constants";
import { deleteRows, moveStage } from "@/app/app/actions";
import { LeadPanel, type LeadField } from "./lead-panel";
import { ScoreRing } from "./score-ring";
import { buttonClass, Pill, stageTone, thText } from "./ui";

export interface LeadColumn {
  key: string;
  name: string;
  kind: "person" | "company" | "email" | "ai" | "plain";
  prompt?: string;
}

const certainty: Record<string, [string, string]> = {
  ultra_sure: ["bg-ws-green", "verified"],
  very_sure: ["bg-ws-green", "verified"],
  probable: ["bg-lk-muted", "probable"],
  not_found: ["bg-lk-gray", "not found"],
  undeliverable: ["bg-ws-red", "bounces"],
};
const certaintyText: Record<string, string> = { "bg-ws-green": "text-ws-green", "bg-lk-muted": "text-lk-muted", "bg-lk-gray": "text-lk-dim", "bg-ws-red": "text-ws-red" };
const str = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Cell({ col, data }: { col: LeadColumn; data: Record<string, unknown> }) {
  if (col.kind === "person") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-lk-fg">{[str(data.first_name), str(data.last_name)].join(" ").trim() || "—"}</span>
        {!!data.title && <span className="text-[12px] text-lk-muted">{str(data.title)}</span>}
      </div>
    );
  }
  if (col.kind === "company") {
    const domain = str(data.domain);
    // Older leads can hold a platform page (instagram.com, linktr.ee) as their domain: show it as the profile link it is.
    const platform = domain && isPlatformHost(siteHost(domain));
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-lk-fg">{str(data.company) || "—"}</span>
        {platform ? (
          <a
            href={/^https?:\/\//i.test(domain) ? domain : `https://${domain}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-[11px] text-ws-blue hover:underline"
            title="A profile page, not the company's own site"
          >
            {siteHost(domain)} profile ↗
          </a>
        ) : (
          domain && <span className="font-mono text-[11px] text-lk-dim">{domain}</span>
        )}
      </div>
    );
  }
  if (col.kind === "email") {
    if (data.email_certainty === "missing_input") return <span className="font-mono text-[11px] text-lk-dim">no name or domain · skipped</span>;
    const status = str(data.email_verification) || str(data.email_certainty);
    const [dot, text] = certainty[status] ?? (data.email ? ["bg-lk-gray", "unverified"] : [null, ""]);
    if (!dot) return <span className="text-lk-dim">—</span>;
    return (
      <div className="flex items-center gap-2">
        <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
        {!!data.email && <span className="truncate font-mono text-[12px] text-lk-fg">{str(data.email)}</span>}
        <span className={`font-mono text-[11px] whitespace-nowrap ${certaintyText[dot]}`}>{text}</span>
      </div>
    );
  }
  const value = str(data[col.key]);
  if (col.kind === "ai") {
    if (!value) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded border border-ws-acc px-2 py-[3px] font-mono text-[11px] whitespace-nowrap text-ws-acc-ink">
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
          <span className={`grid size-[22px] shrink-0 place-items-center rounded font-mono text-[12px] font-semibold ${high ? "bg-ws-acc-soft text-ws-acc-ink" : "bg-ws-soft text-lk-muted"}`}>{score}</span>
          {why && <span className="line-clamp-2 text-[13px] text-lk-fg">{why}</span>}
        </div>
      );
    }
    return <span className="line-clamp-2 text-[13px] text-lk-fg">{value}</span>;
  }
  if (/^https?:\/\//.test(value)) {
    const host = (value.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] ?? "link").toLowerCase();
    return (
      <a href={value} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[13px] whitespace-nowrap text-ws-blue hover:underline">
        {host.endsWith("linkedin.com") ? "LinkedIn" : host} ↗
      </a>
    );
  }
  return <span className="line-clamp-2 text-[13px] text-lk-fg">{value || <span className="text-lk-dim">—</span>}</span>;
}

export function LeadsTable({ tableId, columns, rows, fields }: { tableId: string; columns: LeadColumn[]; rows: Row[]; fields: LeadField[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The lead open in the side panel.
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId);
  const close = useCallback(() => setOpenId(null), []);
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
        <div className="flex min-h-[42px] flex-wrap items-center gap-x-1 gap-y-2 border-b border-lk-line bg-lk-frame px-4 py-1.5 text-[13px]">
          {selected.size > 0 ? (
            <>
              <span className="font-semibold text-lk-fg">{selected.size} selected</span>
              <span className="mr-1 text-lk-dim">Move to</span>
              {STAGES.map((s) => (
                <button key={s} disabled={pending} onClick={() => move(s)} className={buttonClass("ghost", "sm")}>
                  {s}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-2">
                {confirming ? (
                  <>
                    <span className="text-[12.5px] text-lk-muted">Delete {selected.size} for good? Their sequences stop.</span>
                    <button disabled={pending} onClick={() => act(() => deleteRows(tableId, [...selected]))} className={buttonClass("danger", "sm")}>
                      Delete
                    </button>
                    <button disabled={pending} onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button disabled={pending} onClick={() => setConfirming(true)} className={`${buttonClass("ghost", "sm")} !text-ws-red hover:!bg-ws-red-soft`}>
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                )}
              </span>
            </>
          ) : (
            <span className="text-lk-muted">{message}</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead className="bg-ws-head">
            <tr className="border-b border-lk-line">
              <th className="w-10 py-2.5 pr-2 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-3.5 accent-lk-fg"
                />
              </th>
              {scored && (
                <th className={`py-2.5 pr-1 pl-2 ${thText}`} title="How well each lead fits your ideal customer. Hover a score for why.">
                  Fit
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} title={c.prompt} className={`px-3 py-2.5 whitespace-nowrap ${thText} ${c.kind === "ai" ? "!text-ws-acc-ink" : ""}`}>
                  <span className="inline-flex items-center gap-1.5">
                    {c.kind === "ai" && <Sparkles className="size-3" />}
                    {c.name.replace(/_/g, " ").replace(/\burl\b/i, "").trim()}
                  </span>
                </th>
              ))}
              <th className={`py-2.5 pr-4 pl-3 ${thText}`}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (scored ? 3 : 2)} className="px-3 py-14 text-center text-[13px] text-lk-dim">
                  No rows at this stage.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setOpenId(r.id)}
                tabIndex={0}
                className={`cursor-pointer border-b border-lk-line last:border-0 ${selected.has(r.id) || openId === r.id ? "bg-lk-frame" : "hover:bg-lk-frame"}`}
              >
                {/* The checkbox cell selects; anywhere else on the row opens the lead. */}
                <td className="py-2.5 pr-2 pl-4 align-middle" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label="Select row" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-3.5 accent-lk-fg" />
                </td>
                {scored && (
                  <td className="py-2.5 pr-1 pl-2 align-middle" onClick={(e) => e.stopPropagation()}>
                    <ScoreRing fit={r.icp} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className="max-w-[280px] px-3 py-2.5 align-middle">
                    <Cell col={c} data={r.data} />
                  </td>
                ))}
                <td className="py-2.5 pr-4 pl-3 align-middle">
                  <Pill tone={stageTone[r.stage]}>{r.stage}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <LeadPanel tableId={tableId} row={open} fields={fields} onClose={close} />}
    </div>
  );
}
