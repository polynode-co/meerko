"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import type { IcpFit } from "@meerko/sdk";
import { monoLabel } from "./ui";

// A lead's ICP fit as a small ring: green from 70, saffron from 40, grey below. Hovering (or focusing) it opens a card
// with the checks behind the score and the agent's note (core/icp.ts).

export const fitTone = (score: number) => (score >= 70 ? "#15803d" : score >= 40 ? "#f4b400" : "#cfc9be");
/** The score as text: saffron is too light on white, so the 40–69 band uses its ink. */
const fitText = (score: number) => (score >= 70 ? "#15803d" : score >= 40 ? "#8a6100" : "#8c857d");

const LABEL: Record<IcpFit["checks"][number]["criterion"], string> = {
  industry: "Industry",
  title: "Title",
  headcount: "Size",
  country: "Country",
  keywords: "Keywords",
  exclude: "Ruled out",
};

const CARD_W = 320;

function FitCard({ fit, at }: { fit: IcpFit & { score: number }; at: { x: number; y: number; flip: boolean } }) {
  return (
    <div
      role="tooltip"
      style={{ position: "fixed", top: at.y, left: at.flip ? at.x - CARD_W - 12 : at.x + 12, width: CARD_W }}
      className="pointer-events-none z-50 flex flex-col gap-3 rounded-lg border border-lk-line bg-white p-4 text-left shadow-[0_12px_40px_rgba(22,22,26,0.15)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={monoLabel}>ICP fit</span>
        <span className="font-display text-[24px] leading-none font-bold tabular-nums" style={{ color: fitText(fit.score) }}>
          {fit.score}
          <span className="font-mono text-[11px] font-normal text-lk-dim">/100</span>
        </span>
      </div>
      {fit.note && (
        <div className="flex gap-2 rounded-md bg-ws-acc-soft px-3 py-2 text-[13px] leading-snug text-lk-fg">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-ws-acc-ink" />
          <span>
            {fit.note}
            <span className="mt-1 block font-mono text-[10.5px] text-ws-acc-ink">
              Your agent: {fit.adjust && fit.adjust > 0 ? "+" : ""}
              {fit.adjust} on the rules&apos; {fit.base}
            </span>
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {fit.checks.map((c) => (
          <li key={c.criterion} className="flex items-start gap-2.5 text-[13px] leading-snug">
            {c.matched ? <Check className="mt-0.5 size-3.5 shrink-0 text-ws-green" /> : <X className="mt-0.5 size-3.5 shrink-0 text-ws-red" />}
            <span className={`mt-[3px] w-[76px] shrink-0 ${monoLabel}`}>{LABEL[c.criterion]}</span>
            <span className={`min-w-0 break-words ${c.matched ? "text-lk-fg" : "text-lk-muted"}`}>{c.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreRing({ fit, size = 32 }: { fit: IcpFit | undefined; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number; flip: boolean } | null>(null);
  if (!fit || fit.score === null) return <span className="font-mono text-[12px] text-lk-gray" title="Set an ideal customer in Connections to score leads">–</span>;
  const scored = fit as IcpFit & { score: number };
  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Beside the ring, flipped left near the right edge, and kept on screen vertically (the card is ~260px tall).
    const flip = r.right + CARD_W + 24 > window.innerWidth;
    const y = Math.max(8, Math.min(r.top - 12, window.innerHeight - 300));
    setAt({ x: flip ? r.left : r.right, y, flip });
  };
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  return (
    <span
      ref={ref}
      tabIndex={0}
      onMouseEnter={open}
      onMouseLeave={() => setAt(null)}
      onFocus={open}
      onBlur={() => setAt(null)}
      className="relative inline-flex shrink-0 cursor-help items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-lk-fg"
      style={{ width: size, height: size }}
      aria-label={`ICP fit ${fit.score} out of 100. ${fit.reason ?? ""}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-lk-line" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={fitTone(scored.score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(scored.score / 100) * c} ${c}`} />
      </svg>
      <span className="absolute font-mono text-[10.5px] font-semibold text-lk-fg tabular-nums">{fit.score}</span>
      {fit.adjust ? <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-ws-acc" aria-hidden /> : null}
      {at && <FitCard fit={scored} at={at} />}
    </span>
  );
}
