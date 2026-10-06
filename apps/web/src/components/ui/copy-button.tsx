"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A primary button that copies `text` (e.g. a setup prompt to paste into an agent). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="inline-flex items-center gap-2.5 rounded-[10px] bg-accent px-[22px] py-[15px] text-base font-semibold text-dark transition hover:brightness-110"
    >
      {copied ? <Check className="size-[17px]" /> : <Copy className="size-[17px]" />}
      {copied ? "Copied — paste it into your agent" : label}
    </button>
  );
}
