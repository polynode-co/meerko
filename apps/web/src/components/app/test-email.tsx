"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { sendTestEmail, type ActionResult } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Sends a short test email from a mailbox, to check it's connected and see how it lands. */
export function TestEmail({ mailboxId, defaultTo }: { mailboxId: string; defaultTo?: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo ?? "");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={buttonClass("ghost")}>
        <Send className="size-3.5" /> Send test
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await sendTestEmail(mailboxId, to)));
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="you@company.com" required className="w-56 bg-lk-ink px-3 py-1.5 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime font-plex text-sm" />
      <button disabled={pending} className={buttonClass()}>{pending ? "Sending…" : "Send"}</button>
      {result && <span role="status" className={`text-sm ${result.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{result.ok ? result.message : result.error}</span>}
    </form>
  );
}
