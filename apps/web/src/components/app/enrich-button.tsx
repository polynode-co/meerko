"use client";

import { MailSearch, Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { enrichEmailsBatch, findPhones, type ActionResult } from "@/app/app/actions";
import { useRouter } from "next/navigation";
import { buttonClass } from "./ui";

const PER_CLICK = 25;

/**
 * Finds and verifies emails for up to 25 rows per click, in batches of 5 so the button can count up and the table
 * fills in as emails are found (each row takes a few seconds). With an ICP, it offers to spend credits on good fits
 * (70+) only, on by default.
 */
export function EnrichButton({ tableId, scored = false }: { tableId: string; scored?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; found: number } | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [goodFitsOnly, setGoodFitsOnly] = useState(true);

  const run = async () => {
    setRunning(true);
    setResult(null);
    const minScore = scored && goodFitsOnly ? 70 : undefined;
    let done = 0;
    let found = 0;
    let notFound = 0;
    let total = PER_CLICK;
    try {
      while (done < PER_CLICK) {
        const r = await enrichEmailsBatch(tableId, minScore, Math.min(5, PER_CLICK - done));
        if (!r.ok) {
          setResult({ ok: false, error: r.error });
          return;
        }
        done += r.processed;
        found += r.found;
        notFound += r.notFound;
        total = Math.min(PER_CLICK, done + r.remaining);
        setProgress({ done, total, found });
        router.refresh();
        if (r.outOfCredits) {
          setResult({ ok: false, error: `Out of credits after ${done} rows: ${found} emails found` });
          return;
        }
        if (r.processed === 0 || r.remaining === 0) break;
      }
      setResult({
        ok: true,
        message:
          done === 0
            ? minScore
              ? "No leads at 70+ fit still need an email"
              : "Every row already has an email or a result"
            : `${found} ${found === 1 ? "email" : "emails"} found, ${notFound} not found. Misses are free.`,
      });
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {(progress || result) && (
        <span role="status" aria-live="polite" className={`max-w-xs text-sm ${result && !result.ok ? "text-[#e5795b]" : progress ? "text-lk-fg" : "text-lk-dim"}`}>
          {progress ? `${progress.done} of ${progress.total} checked · ${progress.found} found` : result?.ok ? result.message : result?.error}
        </span>
      )}
      {scored && (
        <label className="flex items-center gap-2 font-plex text-[12px] tracking-[0.6px] text-lk-muted uppercase" title="Only leads whose ICP fit is 70 or more">
          <input type="checkbox" checked={goodFitsOnly} disabled={running} onChange={(e) => setGoodFitsOnly(e.target.checked)} className="size-3.5 accent-lk-lime" />
          Fit 70+ only
        </label>
      )}
      <button disabled={running} onClick={run} className={buttonClass("secondary")}>
        <MailSearch className={`size-[15px] ${running ? "animate-pulse text-lk-lime" : ""}`} />
        {running ? (progress ? `Finding emails… ${progress.done}/${progress.total}` : "Finding emails…") : "Find & verify emails"}
      </button>
    </div>
  );
}

/** Finds phone numbers for up to 25 rows per click: 80 credits per number found, on Pro or your own Generect key. */
export function PhoneButton({ tableId }: { tableId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="flex items-center gap-3">
      {result && (
        <span role="status" className={`max-w-xs text-sm ${result.ok ? "text-lk-dim" : "text-[#e5795b]"}`}>
          {result.ok ? result.message : result.error}
        </span>
      )}
      <button
        disabled={pending}
        onClick={() => start(async () => setResult(await findPhones(tableId)))}
        className={buttonClass("ghost")}
        title="80 credits per number found; misses are free"
      >
        <Phone className="size-[15px]" />
        {pending ? "Finding phones…" : "Find phones"}
      </button>
    </div>
  );
}
