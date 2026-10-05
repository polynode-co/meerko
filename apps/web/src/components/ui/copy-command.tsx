"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(command).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-2.5 rounded-[10px] border border-line bg-raised px-5 py-4 font-mono text-[15px] transition hover:border-muted"
      aria-label={`Copy "${command}"`}
    >
      <span className="text-accent">$</span>
      <span>{command}</span>
      {copied ? <Check className="size-4 text-signal" /> : <Copy className="size-4 text-muted" />}
    </button>
  );
}
