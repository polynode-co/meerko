"use client";

import { Pause, Play } from "lucide-react";
import { useState, useTransition } from "react";
import { setSequenceRunning } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Start (or resume) and pause. Starting sends real emails, so it asks for confirmation. */
export function SequenceToggle({ id, status }: { id: string; status: "draft" | "active" | "paused" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const running = status === "active";
  const toggle = () => {
    if (!running && !window.confirm("Start sending? Emails go to real people from your mailbox, within the send window.")) return;
    start(async () => {
      const res = await setSequenceRunning(id, !running);
      setError(res.ok ? null : res.error);
    });
  };
  return (
    <div className="flex items-center gap-3">
      {error && <span className="max-w-xs text-sm text-[#e5795b]">{error}</span>}
      <button
        disabled={pending}
        onClick={toggle}
        // Pause gets a visible lime outline: the neutral secondary style disappears on dark backgrounds.
        className={buttonClass(running ? "lime" : "primary")}
      >
        {running ? <Pause className="size-[15px]" /> : <Play className="size-[15px]" />}
        {pending ? "Saving…" : running ? "Pause sending" : status === "draft" ? "Start sending" : "Resume sending"}
      </button>
    </div>
  );
}
