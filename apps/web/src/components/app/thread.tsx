import type { ThreadMessage } from "@meerko/sdk";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/**
 * The whole conversation as an email thread, oldest first, every message in full.
 * `highlightId` marks the reply being handled, where it sits in the conversation.
 */
export function Thread({ messages, prospect, highlightId }: { messages: ThreadMessage[]; prospect: string; highlightId?: string }) {
  const subject = messages.find((m) => m.subject)?.subject?.replace(/^re:\s*/i, "");
  return (
    <div className="flex flex-col gap-3">
      {subject && <h3 className="text-[15px] font-semibold">{subject}</h3>}
      <ol className="flex flex-col gap-3">
        {messages.map((m) => {
          const mine = m.direction === "out";
          const on = m.id === highlightId;
          return (
            <li
              key={m.id}
              className={`flex flex-col gap-2 rounded-lg border px-4 py-3.5 ${
                on ? "border-signal/60 bg-signal/5" : mine ? "border-line bg-raised" : "border-line"
              } ${mine ? "ml-10" : "mr-10"}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className={`font-semibold ${mine ? "text-fg" : "text-signal"}`}>{mine ? "You" : prospect}</span>
                {mine && m.step !== null && <span className="rounded border border-line px-1.5 font-mono text-[10px] text-muted">step {m.step + 1}</span>}
                {on && <span className="rounded bg-signal px-1.5 font-mono text-[10px] font-bold text-dark">needs reply</span>}
                <span className="ml-auto font-mono text-[11px] text-muted">{when(m.sentAt)}</span>
              </div>
              <p className="text-[14px] leading-relaxed whitespace-pre-line">{m.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
