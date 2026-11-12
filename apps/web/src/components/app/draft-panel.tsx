"use client";

import { CheckCheck, ChevronDown, Send, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { REPLY_INTENTS } from "@meerko/sdk/constants";
import { approveDraft, classifyReply, discardDraft, sendReply, type ActionResult } from "@/app/app/actions";
import { buttonClass, field, intentTone, label, monoLabel, type PillTone } from "./ui";

// "WS3 · Inbox" (xhEIF) in docs/design/meerko.pen: the draft docked under the conversation.

const toneText: Record<PillTone, string> = {
  neutral: "bg-ws-soft text-lk-muted",
  amber: "bg-ws-acc-soft text-ws-acc-ink",
  signal: "bg-ws-green-soft text-ws-green",
  solid: "bg-ws-acc text-lk-fg",
  blue: "bg-ws-blue-soft text-ws-blue",
  red: "bg-ws-red-soft text-ws-red",
};

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

  const options = REPLY_INTENTS.filter((i) => i !== "other");
  const known = !!current && (options as readonly string[]).includes(current);
  const intents = (
    <label className="flex shrink-0 items-center gap-2">
      <span className={monoLabel}>Intent</span>
      <span className="relative inline-flex">
        <select
          value={current ?? ""}
          disabled={pending}
          aria-label="Intent"
          onChange={(e) => {
            const i = e.target.value;
            setCurrent(i);
            act(() => classifyReply(replyId, i));
          }}
          className={`cursor-pointer appearance-none rounded border border-lk-line py-[3px] pr-6 pl-2 font-mono text-[11px] focus:border-lk-fg focus:outline-none disabled:opacity-60 ${
            toneText[current ? (intentTone[current] ?? "neutral") : "neutral"]
          }`}
        >
          {!known && (
            <option value={current ?? ""} disabled>
              {current ? label(current) : "unclassified"}
            </option>
          )}
          {options.map((i) => (
            <option key={i} value={i}>
              {label(i)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-lk-dim" />
      </span>
    </label>
  );

  const feedback = result && (
    <p role="status" className={`text-[12.5px] ${result.ok ? "text-ws-green" : "text-ws-red"}`}>
      {result.ok ? (result.message ?? "Saved") : result.error}
    </p>
  );

  if (!draft) {
    return (
      <div className="flex flex-col gap-3">
        {answered && !composing ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lk-line bg-lk-frame px-3.5 py-2.5 text-[13px]">
              <span className="flex items-center gap-2 text-lk-muted">
                <CheckCheck className="size-4 text-ws-green" /> You replied. The sequence is stopped for this lead.
              </span>
              <button onClick={() => setComposing(true)} className={buttonClass("secondary", "sm")}>
                Write a follow-up
              </button>
            </div>
            {intents}
          </>
        ) : (
          <section className="flex flex-col gap-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={Math.min(8, Math.max(3, body.split("\n").length + 1))}
              placeholder="Write your reply…"
              aria-label="Your reply"
              className={`${field} resize-y rounded-lg px-3.5 py-3 text-[13.5px] leading-[1.6]`}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {intents}
                <span className="font-mono text-[10.5px] text-lk-dim">your mailbox · same thread</span>
              </span>
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
                <Send /> {pending ? "Sending…" : "Send reply"}
              </button>
            </div>
          </section>
        )}
        {feedback}
      </div>
    );
  }

  // Docked under the conversation: the agent's draft, editable in place, then approve or discard.
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[1px] text-ws-acc-ink uppercase">
          <Sparkles className="size-3" /> Draft by your agent
        </span>
        <span className="text-[12px] text-lk-dim">Nothing sends until you approve</span>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={Math.min(10, Math.max(4, body.split("\n").length + 1))}
        aria-label="Draft reply"
        className={`${field} resize-y rounded-lg px-3.5 py-3 text-[13.5px] leading-[1.6]`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {intents}
          <span className="font-mono text-[10.5px] text-lk-dim">your mailbox · same thread</span>
        </span>
        <div className="flex gap-2">
          <button disabled={pending} onClick={() => act(() => discardDraft(draft.id))} className={buttonClass("secondary")}>
            Discard
          </button>
          <button disabled={pending || !body.trim()} onClick={() => act(() => approveDraft(draft.id, body))} className={buttonClass("primary")}>
            <Send /> {pending ? "Sending…" : "Approve & send"}
          </button>
        </div>
      </div>
      {feedback}
    </section>
  );
}
