"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** The start panel's terminal command, with a copy button. `prefix` is shown but not copied: "" for a URL. */
export function LookoutCommand({ command, prefix = "$ ", label = "Copy command" }: { command: string; prefix?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex w-full items-center justify-between gap-4 px-[18px] py-4 outline outline-1 -outline-offset-1 outline-lk-gray">
      <code className="min-w-0 overflow-x-auto font-plex text-[13.5px] whitespace-nowrap text-lk-fg sm:text-[14px]">
        {prefix}
        {command}
      </code>
      <button
        type="button"
        aria-label={copied ? "Copied" : label}
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
