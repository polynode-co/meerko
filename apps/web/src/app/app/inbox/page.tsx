import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import type { Reply } from "@meerko/sdk";
import { DraftPanel } from "@/components/app/draft-panel";
import { Thread } from "@/components/app/thread";
import { AgentHint, EmptyState, formatWhen, intentTone, label, Page, PageHeader, Pill } from "@/components/app/ui";
import { conversations, splitQuoted } from "@/lib/inbox";
import { load } from "@/lib/meerko";

// "Inbox A · Threads + chat" in the .pen file: one entry per conversation, the thread as a chat, and the
// draft docked under it.

const views = {
  needs: { label: "Needs you", opts: { needsYou: true } },
  interested: { label: "Interested", opts: { intent: "interested" } },
  all: { label: "All", opts: { unclassified: false } },
  automatic: { label: "Automatic", opts: { unclassified: false, includeAutomatic: true } },
} as const;
type View = keyof typeof views;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; reply?: string }> }) {
  const sp = await searchParams;
  const view: View = sp.view && sp.view in views ? (sp.view as View) : "needs";
  const [replies, drafts] = await load((c) => Promise.all([c.listReplies({ ...views[view].opts, limit: 100 }), c.listDrafts()]));
  const convs = conversations(replies, drafts);
  // `?reply=` (also what Slack links to) opens the conversation that reply belongs to.
  const current = convs.find((c) => c.replies.some((r) => r.id === sp.reply)) ?? convs[0];
  const selected: Reply | undefined = current?.latest;
  const draft = current?.draft;
  // The user's own email is the latest in the conversation: nothing is waiting on them.
  const answered = selected?.thread.at(-1)?.direction === "out";
  // An answer goes to the newest reply nobody has handled yet, else the newest.
  const answerTo = current ? ([...current.replies].reverse().find((r) => !r.handledAt) ?? current.latest) : undefined;
  const href = (o: { view?: View; reply?: string }) => `?${new URLSearchParams({ view: o.view ?? view, ...(o.reply ? { reply: o.reply } : {}) })}`;
  // On a phone the list and the conversation take turns: a picked conversation shows its thread, with a way back.
  const picked = !!sp.reply && !!selected;
  const name = (r: Reply) => (r.row?.first_name ? `${r.row.first_name} ${r.row.last_name ?? ""}`.trim() : r.from);
  const who = (r: Reply) => [r.row?.title, r.row?.company].filter(Boolean).map(String).join(" @ ");

  return (
    <Page className="lg:h-dvh lg:min-h-[640px]">
      <PageHeader
        eyebrow="Inbox"
        title="Inbox"
        actions={
          <nav aria-label="Filter replies" className="flex flex-wrap outline outline-1 -outline-offset-1 outline-lk-line">
            {(Object.keys(views) as View[]).map((v) => (
              <Link
                key={v}
                href={href({ view: v })}
                aria-current={v === view ? "page" : undefined}
                className={`border-l border-lk-line px-4 py-[9px] font-plex text-[13px] tracking-[0.6px] uppercase first:border-l-0 ${
                  v === view ? "bg-lk-lime font-semibold text-lk-ink" : "text-lk-muted hover:text-lk-fg"
                }`}
              >
                {views[v].label}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="flex min-h-0 flex-1 border border-lk-line bg-lk-box">
        <section className={`min-h-0 w-full shrink-0 flex-col overflow-y-auto border-lk-line lg:flex lg:w-[380px] lg:border-r ${picked ? "hidden" : "flex"}`}>
          {convs.length === 0 && (
            <p className="px-[18px] py-10 text-[15px] text-lk-muted">
              {view === "needs" ? "No replies waiting. Meerko checks your inbox about every minute." : "Nothing here yet."}
            </p>
          )}
          {convs.map((c) => {
            const r = c.latest;
            const on = c.key === current?.key;
            const messages = r.thread.length || 1;
            return (
              <Link
                key={c.key}
                href={href({ reply: r.id })}
                className={`relative flex flex-col gap-2 border-b border-lk-line px-[18px] py-3.5 transition ${on ? "bg-lk-lime/[0.06]" : "hover:bg-lk-frame"}`}
              >
                {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-lk-lime" />}
                <span className="flex items-baseline gap-2">
                  {c.open > 0 && <span className="size-[7px] shrink-0 self-center bg-lk-lime" />}
                  <span className={`truncate text-[15.5px] text-lk-fg ${c.open ? "font-bold" : "font-medium"}`}>{name(r)}</span>
                  {!!r.row?.company && <span className="truncate text-[13.5px] text-lk-dim">{String(r.row.company)}</span>}
                  <span className="ml-auto shrink-0 font-plex text-[12px] text-lk-dim">{formatWhen(r.receivedAt)}</span>
                </span>
                <span className={`line-clamp-2 text-[15px] leading-snug ${c.open ? "text-lk-fg" : "text-lk-muted"}`}>“{splitQuoted(r.body).text}”</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone={r.intent ? intentTone[r.intent] : "neutral"}>{r.intent ? label(r.intent) : "unclassified"}</Pill>
                  {c.draft ? <Pill tone="solid">draft ready</Pill> : c.open > 0 && <Pill>reply needed</Pill>}
                </span>
                <span className="font-plex text-[12px] tracking-[0.4px] text-lk-dim uppercase">
                  {messages} {messages === 1 ? "message" : "messages"}
                  {r.sequenceName && ` · ${r.sequenceName}`}
                </span>
              </Link>
            );
          })}
        </section>

        <section className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${picked ? "flex" : "hidden"}`}>
          {!selected || !answerTo ? (
            <div className="p-6">
              <EmptyState icon={Inbox} title="No conversation selected">
                Replies to your sequences land here. Meerko stops the sequence for anyone who answers.
              </EmptyState>
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-3 border-b border-lk-line px-5 py-4 sm:px-7">
                <Link href={href({})} className="flex items-center gap-2 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase hover:text-lk-fg lg:hidden">
                  <ArrowLeft className="size-4" /> All conversations
                </Link>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <h2 className="text-[21px] font-semibold tracking-[-0.5px] break-words text-lk-fg">
                      {name(selected)}
                      {who(selected) && <span className="font-normal text-lk-muted"> · {who(selected)}</span>}
                    </h2>
                    <p className="font-plex text-[12.5px] tracking-[0.4px] break-words text-lk-dim uppercase">
                      {[selected.from, selected.sequenceName].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={selected.intent ? intentTone[selected.intent] : "neutral"}>{selected.intent ? label(selected.intent) : "unclassified"}</Pill>
                    {current.replies.length > 1 && <Pill>{current.replies.length} replies</Pill>}
                  </div>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                <Thread messages={selected.thread} prospect={name(selected)} highlightId={answerTo.handledAt ? undefined : answerTo.id} />
              </div>

              <footer className="max-h-[48%] shrink-0 overflow-y-auto border-t border-lk-line bg-lk-box px-5 py-4 sm:px-7">
                <DraftPanel
                  key={answerTo.id}
                  replyId={answerTo.id}
                  intent={answerTo.intent}
                  draft={draft ? { id: draft.id, body: draft.body } : null}
                  answered={answered}
                />
                {!draft && !answered && (
                  <div className="pt-3">
                    <AgentHint command="draft replies to my new replies">Or let your agent draft it.</AgentHint>
                  </div>
                )}
              </footer>
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
