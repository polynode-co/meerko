"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A titled code block (ink box, gray frame); the copy button copies `code` (the commands without prompts). */
export function CodeBlock({
  title,
  lines,
  code,
  wrap = false,
}: {
  title: string;
  lines: { text: string; tone?: "muted" | "accent" }[];
  code?: string;
  /** Wrap long lines (prose like a prompt) instead of scrolling sideways. */
  wrap?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0 bg-lk-ink outline outline-1 -outline-offset-1 outline-lk-gray">
      <div className="flex items-center justify-between gap-3 border-b border-lk-gray px-3.5 py-2">
        <span className="font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">{title}</span>
        {code && (
          <button
            type="button"
            aria-label="Copy"
            onClick={() =>
              navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            className="inline-flex items-center gap-1.5 font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase hover:text-lk-fg"
          >
            {copied ? <Check className="size-3.5 text-lk-lime" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className={`${wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto"} p-4 font-plex text-[13.5px] leading-[1.6]`}>
        {lines.map((l, i) => (
          <div key={i} className={l.tone === "muted" ? "text-lk-dim" : l.tone === "accent" ? "text-lk-lime" : "text-lk-fg"}>
            {l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
