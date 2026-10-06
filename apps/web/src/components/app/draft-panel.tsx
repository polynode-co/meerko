"use client";

import { CheckCheck, Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { REPLY_INTENTS } from "@meerko/sdk/constants";
import { approveDraft, classifyReply, discardDraft, sendReply, type ActionResult } from "@/app/app/actions";
import { buttonClass, label } from "./ui";

/**
 * The agent's draft answer (edit, set intent, approve or discard), or, with no draft, a box to write the
 * reply yourself. Either way it's sent from the user's mailbox in the same thread.
 * `answered`: the user's email is already the latest in the thread.
 */
export function DraftPanel({
  replyId,
  intent,
  draft,
  answered,
}: {
  replyId: string;
  intent: string | null;
  draft: { id: string; body: string } | null;
  answered: boolean;
}) {
  const [body, setBody] = useState(draft?.body ?? "");
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
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

  if (!draft) {
    return (
      <div className="flex flex-col gap-3">
        {intents}
        {answered && !composing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-[13px]">
            <span className="flex items-center gap-2 text-muted">
              <CheckCheck className="size-4 text-signal" /> You replied. The sequence is stopped for this lead.
            </span>
            <button onClick={() => setComposing(true)} className={buttonClass()}>
              Write a follow-up
            </button>
          </div>
        ) : (
          <section className="flex flex-col gap-3 rounded-[10px] border border-line bg-raised p-4.5">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={Math.max(5, body.split("\n").length + 1)}
              placeholder="Write your reply…"
              aria-label="Your reply"
              className="w-full resize-y rounded-lg border border-line bg-ink px-4 py-3.5 text-sm leading-relaxed outline-none focus:border-accent"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">Sent from your mailbox, in this thread.</span>
              <button
                disabled={pending || !body.trim()}
                onClick={() =>
                  act(async () => {
                    const res = await sendReply(replyId, body);
                    if (res.ok) {
                      setBody("");
                      setComposing(false);
                    }
                    return res;
                  })
                }
                className={buttonClass("primary")}
              >
                <Send className="size-[15px]" /> {pending ? "Sending…" : "Send reply"}
              </button>
            </div>
          </section>
        )}
        {feedback}
      </div>
    );
  }

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
