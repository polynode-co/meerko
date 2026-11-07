"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import type { IcpFit } from "@meerko/sdk";

// A lead's ICP fit as a small ring: lime from 70, amber from 40, grey below. Hovering (or focusing) it opens a card
// with the checks behind the score and the agent's note (core/icp.ts).

export const fitTone = (score: number) => (score >= 70 ? "#a8f326" : score >= 40 ? "#e3a43a" : "#5b5b5f");

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
      className="pointer-events-none z-50 flex flex-col gap-3 bg-lk-box p-4 text-left shadow-[0_12px_40px_rgba(0,0,0,0.6)] outline outline-1 -outline-offset-1 outline-lk-lime/50"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">ICP fit</span>
        <span className="font-plex text-[22px] leading-none font-semibold tabular-nums" style={{ color: fitTone(fit.score) }}>
          {fit.score}
          <span className="text-[13px] text-lk-dim">/100</span>
        </span>
      </div>
      {fit.note && (
        <div className="flex gap-2 border-l-2 border-lk-lime bg-lk-lime/[0.06] px-3 py-2 text-[13.5px] leading-snug text-lk-fg">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-lk-lime" />
          <span>
            {fit.note}
            <span className="mt-1 block font-plex text-[11.5px] text-lk-dim">
              Your agent: {fit.adjust && fit.adjust > 0 ? "+" : ""}
              {fit.adjust} on the rules&apos; {fit.base}
            </span>
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {fit.checks.map((c) => (
          <li key={c.criterion} className="flex gap-2.5 text-[13.5px] leading-snug">
            {c.matched ? <Check className="mt-0.5 size-3.5 shrink-0 text-lk-lime" /> : <X className="mt-0.5 size-3.5 shrink-0 text-[#e5795b]" />}
            <span className="min-w-0">
              <span className="font-plex text-[11.5px] tracking-[0.5px] text-lk-dim uppercase">{LABEL[c.criterion]}</span>
              <span className={`block break-words ${c.matched ? "text-lk-fg" : "text-lk-muted"}`}>{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreRing({ fit, size = 32 }: { fit: IcpFit | undefined; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number; flip: boolean } | null>(null);
  if (!fit || fit.score === null) return <span className="font-plex text-[13px] text-lk-gray" title="Set an ideal customer in Connections to score leads">–</span>;
  const scored = fit as IcpFit & { score: number };
  const open = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Beside the ring, flipped left near the right edge, and kept on screen vertically (the card is ~260px tall).
    const flip = r.right + CARD_W + 24 > window.innerWidth;
    const y = Math.max(8, Math.min(r.top - 12, window.innerHeight - 300));
    setAt({ x: flip ? r.left : r.right, y, flip });
  };
  const stroke = 3.5;
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
      className="relative inline-flex shrink-0 cursor-help items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-lk-lime"
      style={{ width: size, height: size }}
      aria-label={`ICP fit ${fit.score} out of 100. ${fit.reason ?? ""}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-lk-line" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={fitTone(scored.score)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(scored.score / 100) * c} ${c}`} />
      </svg>
      <span className="absolute font-plex text-[11px] font-semibold text-lk-fg tabular-nums">{fit.score}</span>
      {fit.adjust ? <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-lk-lime" aria-hidden /> : null}
      {at && <FitCard fit={scored} at={at} />}
    </span>
  );
}
