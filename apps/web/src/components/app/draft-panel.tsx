"use client";

import { Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { REPLY_INTENTS } from "@meerko/sdk/constants";
import { approveDraft, classifyReply, discardDraft, type ActionResult } from "@/app/app/actions";
import { buttonClass, label } from "./ui";

/** The agent's draft answer: edit, set intent, approve (sends in the same thread) or discard. */
export function DraftPanel({ replyId, intent, draft }: { replyId: string; intent: string | null; draft: { id: string; body: string } | null }) {
  const [body, setBody] = useState(draft?.body ?? "");
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(intent);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  const intents = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted">Intent</span>
      {REPLY_INTENTS.filter((i) => i !== "other").map((i) => (
        <button
          key={i}
          disabled={pending}
          onClick={() => {
            setCurrent(i);
            act(() => classifyReply(replyId, i));
          }}
          className={`rounded-full border px-2.5 py-1 text-xs ${current === i ? "border-signal bg-signal/12 font-semibold text-signal" : "border-line text-muted hover:text-fg"}`}
        >
          {label(i)}
        </button>
      ))}
    </div>
  );

  const feedback = result && (
    <p role="status" className={`text-[13px] ${result.ok ? "text-signal" : "text-[#e5795b]"}`}>
      {result.ok ? (result.message ?? "Saved") : result.error}
    </p>
  );

  if (!draft) return <div className="flex flex-col gap-3">{intents}{feedback}</div>;

  return (
    <section className="flex flex-col gap-3.5 rounded-[10px] border border-accent bg-raised p-4.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px]">
          <Sparkles className="size-[15px] text-accent" />
          <span className="font-semibold">Draft reply</span>
          <span className="text-xs text-muted">by your agent</span>
        </span>
        <span className="font-mono text-[11px] text-muted">Nothing is sent until you approve</span>
      </div>
      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={Math.max(6, body.split("\n").length + 1)}
          className="w-full resize-y rounded-lg border border-accent/60 bg-ink px-4 py-3.5 text-sm leading-relaxed outline-none"
        />
      ) : (
        <p className="rounded-lg border border-line bg-ink px-4 py-3.5 text-sm leading-relaxed whitespace-pre-line">{body}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {intents}
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => act(() => discardDraft(draft.id))} className={buttonClass("ghost")}>
            <Trash2 className="size-[15px]" /> Discard
          </button>
          <button disabled={pending} onClick={() => setEditing((e) => !e)} className={buttonClass()}>
            <Pencil className="size-[15px]" /> {editing ? "Done" : "Edit"}
          </button>
          <button disabled={pending || !body.trim()} onClick={() => act(() => approveDraft(draft.id, body))} className={buttonClass("primary")}>
            <Send className="size-[15px]" /> {pending ? "Sending…" : "Approve & send"}
          </button>
        </div>
      </div>
      {feedback}
    </section>
  );
}
