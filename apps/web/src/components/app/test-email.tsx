"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { sendTestEmail, type ActionResult } from "@/app/app/actions";
import { buttonClass, field } from "./ui";

/** Sends a short test email from a mailbox, to check it's connected and see how it lands. */
export function TestEmail({ mailboxId, defaultTo }: { mailboxId: string; defaultTo?: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo ?? "");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={buttonClass("ghost", "sm")}>
        <Send /> Send test
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await sendTestEmail(mailboxId, to)));
      }}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        type="email"
        placeholder="you@company.com"
        required
        aria-label="Send the test to"
        className={`${field} w-56 py-[5px] font-mono text-[12px]`}
      />
      <button disabled={pending} className={buttonClass("secondary", "sm")}>
        {pending ? "Sending…" : "Send"}
      </button>
      {result && (
        <span role="status" className={`basis-full text-right text-[12px] ${result.ok ? "text-ws-green" : "text-ws-red"}`}>
          {result.ok ? result.message : result.error}
        </span>
      )}
    </form>
  );
}
