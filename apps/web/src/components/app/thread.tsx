import type { ThreadMessage } from "@meerko/sdk";
import { splitQuoted } from "@/lib/inbox";

// "Inbox A · Threads + chat" in the .pen file: the conversation as a chat. Your emails are quiet cards on the
// right with their step; the lead's replies sit on paper on the left. Quoted text and signatures fold away.

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Folded({ quoted, light }: { quoted: string; light?: boolean }) {
  if (!quoted) return null;
  return (
    <details className="group">
      <summary
        className={`inline-flex cursor-pointer list-none items-center gap-2 px-2 py-1 font-plex text-[12px] tracking-[0.4px] uppercase outline outline-1 -outline-offset-1 [&::-webkit-details-marker]:hidden ${
          light ? "text-lk-gray outline-lk-ink/20 hover:text-lk-ink" : "text-lk-dim outline-lk-line hover:text-lk-fg"
        }`}
      >
        <span className="group-open:hidden">··· Quoted text and signature</span>
        <span className="hidden group-open:inline">Hide quoted text</span>
      </summary>
      <p className={`mt-2 text-[14px] leading-[22px] break-words whitespace-pre-line ${light ? "text-lk-gray" : "text-lk-dim"}`}>{quoted}</p>
    </details>
  );
}

export function Thread({ messages, prospect, highlightId }: { messages: ThreadMessage[]; prospect: string; highlightId?: string }) {
  const firstIn = messages.findIndex((m) => m.direction === "in");
  const sequenced = messages.some((m) => m.direction === "out" && m.step !== null);
  const first = prospect.split(" ")[0];
  return (
    <ol className="flex flex-col gap-4">
      {messages.map((m, i) => {
        const mine = m.direction === "out";
        const { text, quoted } = splitQuoted(m.body);
        const subject = m.subject && i === messages.findIndex((x) => x.subject) ? m.subject.replace(/^re:\s*/i, "") : null;
        return (
          <li key={m.id} className="flex flex-col gap-4">
            {mine ? (
              <div className="flex justify-end">
                <div className="flex w-full max-w-[560px] flex-col gap-2 px-4 py-3 outline outline-1 -outline-offset-1 outline-lk-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-plex text-[12px] tracking-[0.4px] text-lk-dim uppercase">
                    <span>You{m.step !== null && ` · step ${m.step + 1}`}</span>
                    <span>{when(m.sentAt)}</span>
                  </div>
                  {subject && <p className="text-[15px] font-semibold text-lk-fg">{subject}</p>}
                  <p className="text-[15px] leading-[23px] break-words whitespace-pre-line text-lk-muted">{text}</p>
                  <Folded quoted={quoted} />
                </div>
              </div>
            ) : (
              <div className={`flex w-full max-w-[640px] flex-col gap-2 bg-lk-paper px-[18px] py-3.5 text-lk-ink ${m.id === highlightId ? "outline-2 outline-offset-2 outline-lk-lime outline" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 font-plex text-[12px] tracking-[0.4px] uppercase">
                  <span className="flex items-center gap-2 font-semibold">
                    {prospect}
                    {m.id === highlightId && <span className="bg-lk-ink px-1.5 text-lk-lime">needs reply</span>}
                  </span>
                  <span className="text-lk-gray">{when(m.sentAt)}</span>
                </div>
                {subject && <p className="text-[15px] font-semibold">{subject}</p>}
                <p className="text-[16px] leading-[25px] break-words whitespace-pre-line">{text}</p>
                <Folded quoted={quoted} light />
              </div>
            )}
            {/* Meerko stops a sequence for anyone who answers. */}
            {i === firstIn && sequenced && (
              <div className="flex items-center gap-3 font-plex text-[12px] tracking-[0.6px] text-lk-dim uppercase">
                <span className="h-px flex-1 bg-lk-line" />
                Sequence stopped: {first} replied
                <span className="h-px flex-1 bg-lk-line" />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
