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
      {subject && <h3 className="text-[15.5px] font-semibold text-lk-fg">{subject}</h3>}
      <ol className="flex flex-col gap-3">
        {messages.map((m) => {
          const mine = m.direction === "out";
          const on = m.id === highlightId;
          return (
            <li
              key={m.id}
              className={`flex flex-col gap-2 p-4 outline outline-1 -outline-offset-1 ${on ? "bg-lk-lime/[0.05] outline-lk-lime/60" : mine ? "outline-lk-line" : "bg-lk-bg outline-lk-line"}`}
            >
              <div className="flex flex-wrap items-center gap-2 font-plex text-[12.5px] tracking-[0.4px] uppercase">
                <span className={mine ? "text-lk-dim" : "text-lk-lime"}>{mine ? "You" : prospect}</span>
                {mine && m.step !== null && <span className="text-lk-dim">· step {m.step + 1}</span>}
                {on && <span className="bg-lk-lime px-1.5 text-[12px] font-semibold text-lk-ink">needs reply</span>}
                <span className="ml-auto text-[12px] text-lk-dim normal-case">{when(m.sentAt)}</span>
              </div>
              <p className={`text-[15.5px] leading-[24px] break-words whitespace-pre-line ${mine ? "text-lk-muted" : "text-lk-fg"}`}>{m.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
