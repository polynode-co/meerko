"use client";

import { CheckCheck, Send, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { REPLY_INTENTS } from "@meerko/sdk/constants";
import { approveDraft, classifyReply, discardDraft, sendReply, type ActionResult } from "@/app/app/actions";
import { buttonClass, field, label, monoLabel } from "./ui";

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
  const [composing, setComposing] = useState(false);
  const [current, setCurrent] = useState(intent);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  const intents = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`${monoLabel} mr-1`}>Intent</span>
      {REPLY_INTENTS.filter((i) => i !== "other").map((i) => (
        <button
          key={i}
          disabled={pending}
          onClick={() => {
            setCurrent(i);
            act(() => classifyReply(replyId, i));
          }}
          className={`px-2 py-1 font-plex text-[12.5px] tracking-[0.4px] uppercase outline outline-1 -outline-offset-1 ${current === i ? "bg-lk-ink font-semibold text-lk-lime outline-lk-lime" : "text-lk-dim outline-lk-line hover:text-lk-fg hover:outline-lk-gray"}`}
        >
          {label(i)}
        </button>
      ))}
    </div>
  );

  const feedback = result && (
    <p role="status" className={`text-[15px] ${result.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>
      {result.ok ? (result.message ?? "Saved") : result.error}
    </p>
  );

  if (!draft) {
    return (
      <div className="flex flex-col gap-3.5">
        {answered && !composing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[15px] outline outline-1 -outline-offset-1 outline-lk-line">
            <span className="flex items-center gap-2 text-lk-muted">
              <CheckCheck className="size-4 text-lk-lime" /> You replied. The sequence is stopped for this lead.
            </span>
            <button onClick={() => setComposing(true)} className={buttonClass()}>
              Write a follow-up
            </button>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={Math.min(8, Math.max(3, body.split("\n").length + 1))}
              placeholder="Write your reply…"
              aria-label="Your reply"
              className={`${field} resize-y px-4 py-3.5 leading-relaxed`}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[14px] text-lk-dim">Sent from your mailbox, in this thread.</span>
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
        {intents}
        {feedback}
      </div>
    );
  }

  // Docked under the conversation: the agent's draft, editable in place, then approve or discard.
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-plex text-[12.5px] tracking-[0.6px] text-lk-lime uppercase">
          <Sparkles className="size-3.5" /> Draft by your agent · edit before sending
        </span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={Math.min(10, Math.max(4, body.split("\n").length + 1))}
        aria-label="Draft reply"
        className={`${field} resize-y px-4 py-3 text-[15.5px] leading-relaxed`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[14px] text-lk-dim">Nothing is sent until you approve. It goes from your mailbox, in this thread.</span>
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => act(() => discardDraft(draft.id))} className={buttonClass()}>
            <Trash2 className="size-[15px]" /> Discard
          </button>
          <button disabled={pending || !body.trim()} onClick={() => act(() => approveDraft(draft.id, body))} className={buttonClass("primary")}>
            <Send className="size-[15px]" /> {pending ? "Sending…" : "Approve & send"}
          </button>
        </div>
      </div>
      {intents}
      {feedback}
    </section>
  );
}
