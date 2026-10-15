"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A titled code block; the copy button copies `code` (the commands without prompts). */
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
    <div className="overflow-hidden rounded-xl border border-line bg-raised">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-xs text-muted">{title}</span>
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
            className="text-muted hover:text-fg"
          >
            {copied ? <Check className="size-3.5 text-signal" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </div>
      <pre className={`${wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto"} px-[18px] py-4 font-mono text-[13.5px] leading-normal`}>
        {lines.map((l, i) => (
          <div key={i} className={l.tone === "muted" ? "text-muted" : l.tone === "accent" ? "text-accent" : "text-fg"}>
            {l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
