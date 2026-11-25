import type { ThreadMessage } from "@meerko/sdk";
import { splitQuoted } from "@/lib/inbox";

// "WS3 · Inbox" (xhEIF) in docs/design/meerko.pen: the conversation as a chat. Your emails are white cards on the
// right with their step; the lead's replies sit on the left, the one waiting on you ringed in saffron. Quoted text
// and signatures fold away.

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function Folded({ quoted }: { quoted: string }) {
  if (!quoted) return null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded border border-lk-line bg-white px-1.5 py-px font-mono text-[10px] text-lk-dim hover:text-lk-fg [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">··· quoted text and signature</span>
        <span className="hidden group-open:inline">hide quoted text</span>
      </summary>
      <p className="mt-2 text-[12.5px] leading-[1.6] break-words whitespace-pre-line text-lk-dim">{quoted}</p>
    </details>
  );
}

export function Thread({ messages, prospect, highlightId }: { messages: ThreadMessage[]; prospect: string; highlightId?: string }) {
  const firstIn = messages.findIndex((m) => m.direction === "in");
  const sequenced = messages.some((m) => m.direction === "out" && m.step !== null);
  const first = prospect.split(" ")[0];
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m, i) => {
        const mine = m.direction === "out";
        const waiting = m.id === highlightId;
        const { text, quoted } = splitQuoted(m.body);
        const subject = m.subject && i === messages.findIndex((x) => x.subject) ? m.subject.replace(/^re:\s*/i, "") : null;
        return (
          <li key={m.id} className="flex flex-col gap-3">
            {mine ? (
              <div className="flex justify-end">
                <div className="flex w-full max-w-[500px] flex-col gap-1.5 rounded-lg border border-lk-line bg-white px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-[0.5px] text-lk-dim uppercase">
                    <span>You{m.step !== null && ` · step ${m.step + 1}`}</span>
                    <span>{when(m.sentAt)}</span>
                  </div>
                  {subject && <p className="text-[13px] font-semibold text-lk-fg">{subject}</p>}
                  <p className="text-[13px] leading-[1.55] break-words whitespace-pre-line text-lk-muted">{text}</p>
                  <Folded quoted={quoted} />
                </div>
              </div>
            ) : (
              <div
                className={`flex w-full max-w-[560px] flex-col gap-1.5 rounded-lg border px-4 py-3 text-lk-fg ${
                  waiting ? "border-ws-acc bg-[#faf6ea] ring-1 ring-ws-acc" : "border-lk-line bg-lk-frame"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-[0.5px] uppercase">
                  <span className="flex items-center gap-2 font-semibold text-lk-fg">
                    {prospect}
                    {waiting && (
                      <span className="rounded-sm bg-lk-fg px-1 py-px text-[9.5px] font-medium tracking-normal text-ws-acc normal-case">needs reply</span>
                    )}
                  </span>
                  <span className="text-lk-dim">{when(m.sentAt)}</span>
                </div>
                {subject && <p className="text-[13.5px] font-semibold">{subject}</p>}
                {text ? (
                  <p className="text-[14px] leading-[1.6] break-words whitespace-pre-line">{text}</p>
                ) : (
                  <p className="text-[13px] text-lk-muted italic">No message text</p>
                )}
                <Folded quoted={quoted} />
              </div>
            )}
            {/* Meerko stops a sequence for anyone who answers. */}
            {i === firstIn && sequenced && (
              <div className="flex items-center gap-3 font-mono text-[10px] tracking-[1px] text-lk-dim uppercase">
                <span className="h-px flex-1 bg-lk-line" />
                Sequence stopped · {first} replied
                <span className="h-px flex-1 bg-lk-line" />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
