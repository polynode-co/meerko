"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** The start panel's terminal command, with a copy button. */
export function LookoutCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex w-full items-center justify-between gap-4 px-[18px] py-4 outline outline-1 -outline-offset-1 outline-lk-gray">
      <code className="min-w-0 overflow-x-auto font-plex text-[13.5px] whitespace-nowrap text-lk-fg sm:text-[14px]">$ {command}</code>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy command"}
        onClick={() =>
          navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          })
        }
        className="shrink-0 text-lk-muted transition hover:text-lk-fg"
      >
        {copied ? <Check className="size-4 text-lk-lime" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}

/** A lime button that copies a prompt to paste into an agent. */
export function CopyPromptButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
      }
      className="inline-flex items-center gap-2.5 bg-lk-lime px-4 py-[13px] font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-bg uppercase transition hover:brightness-110"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied: paste it into your agent" : label}
    </button>
  );
}
