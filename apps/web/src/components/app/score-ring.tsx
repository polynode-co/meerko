import type { IcpFit } from "@meerko/sdk";

// A lead's ICP fit as a small ring: lime from 70, amber from 40, grey below. Hovering shows the checks behind it
// and the agent's adjustment (core/icp.ts).

export const fitTone = (score: number) => (score >= 70 ? "#a8f326" : score >= 40 ? "#e3a43a" : "#5b5b5f");

const LABEL: Record<IcpFit["checks"][number]["criterion"], string> = {
  industry: "Industry",
  title: "Title",
  headcount: "Size",
  country: "Country",
  keywords: "Keywords",
  exclude: "Excluded",
};

/** The tooltip: one line per check, then the agent's note. */
export function fitExplanation(fit: IcpFit) {
  const lines = fit.checks.map((c) => `${c.matched ? "✓" : "✗"} ${LABEL[c.criterion]}: ${c.detail}`);
  if (fit.adjust) lines.push(`${fit.adjust > 0 ? "+" : ""}${fit.adjust} from your agent${fit.note ? `: ${fit.note}` : ""}`);
  return `Fit ${fit.score}/100\n${lines.join("\n")}`;
}

export function ScoreRing({ fit, size = 32 }: { fit: IcpFit | undefined; size?: number }) {
  if (!fit || fit.score === null) return <span className="font-plex text-[13px] text-lk-gray" title="Set an ICP in Settings to score leads">–</span>;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={fitExplanation(fit)} aria-label={`ICP fit ${fit.score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-lk-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fitTone(fit.score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(fit.score / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute font-plex text-[11px] font-semibold text-lk-fg tabular-nums">{fit.score}</span>
      {fit.adjust ? <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-lk-lime" aria-hidden /> : null}
    </span>
  );
}
