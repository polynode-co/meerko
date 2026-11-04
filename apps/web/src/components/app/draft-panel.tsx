"use client";

import { CheckCheck, Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { REPLY_INTENTS } from "@meerko/sdk/constants";
import { approveDraft, classifyReply, discardDraft, sendReply, type ActionResult } from "@/app/app/actions";
import { buttonClass, field, label, monoLabel, PaperWindow } from "./ui";

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
              rows={Math.max(5, body.split("\n").length + 1)}
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

  // The draft sits on paper: it's the email the person will receive, once approved.
  const paperButton = "inline-flex items-center justify-center gap-2 px-3 py-2.5 font-plex text-[12px] font-semibold tracking-[1px] uppercase transition disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <section className="flex flex-col gap-4 pr-2 pb-2">
      <PaperWindow title={<span className="flex items-center gap-2"><Sparkles className="size-3.5" />Draft · needs you</span>} bodyClassName="flex flex-col gap-3 p-4">
        {editing ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={Math.max(6, body.split("\n").length + 1)}
            aria-label="Draft reply"
            className="w-full resize-y bg-lk-paper-hi px-3 py-2.5 text-[15px] leading-relaxed text-lk-ink outline outline-[1.5px] -outline-offset-1 outline-lk-ink"
          />
        ) : (
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-line text-lk-ink">{body}</p>
        )}
        <p className="font-plex text-[12px] text-lk-gray">Drafted by your agent · nothing is sent until you approve</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={pending || !body.trim()} onClick={() => act(() => approveDraft(draft.id, body))} className={`${paperButton} flex-1 bg-lk-ink text-lk-lime hover:brightness-125`}>
            <Send className="size-3.5" /> {pending ? "Sending…" : "Approve & send"}
          </button>
          <button disabled={pending} onClick={() => setEditing((e) => !e)} className={`${paperButton} text-lk-ink outline outline-[1.5px] -outline-offset-1 outline-lk-ink hover:bg-lk-paper-hi`}>
            <Pencil className="size-3.5" /> {editing ? "Done" : "Edit"}
          </button>
          <button disabled={pending} onClick={() => act(() => discardDraft(draft.id))} className={`${paperButton} text-lk-ink outline outline-[1.5px] -outline-offset-1 outline-lk-ink hover:bg-lk-paper-hi`}>
            <Trash2 className="size-3.5" /> Discard
          </button>
        </div>
      </PaperWindow>
      {intents}
      {feedback}
    </section>
  );
}
