import { ArrowLeft, CheckCheck, Inbox, Sparkles } from "lucide-react";
import Link from "next/link";
import type { Reply } from "@meerko/sdk";
import { DraftPanel } from "@/components/app/draft-panel";
import { Thread } from "@/components/app/thread";
import { AgentHint, EmptyState, formatWhen, headLink, intentTone, label, Page, PageHeader, Pill } from "@/components/app/ui";
import { conversations, needYouCount, preview } from "@/lib/inbox";
import { load } from "@/lib/meerko";

// "WS3 · Inbox" (xhEIF) and "WS3 · Inbox empty" (LyBVE) in docs/design/meerko.pen: one entry per conversation on the
// left, the thread as a chat on the right, and the draft docked under it.

const views = {
  needs: { label: "Needs you", opts: { needsYou: true } },
  interested: { label: "Interested", opts: { intent: "interested" } },
  all: { label: "All", opts: { unclassified: false } },
  automatic: {
    label: "Automatic",
    opts: { unclassified: false, includeAutomatic: true },
  },
} as const;
type View = keyof typeof views;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; reply?: string }> }) {
  const sp = await searchParams;
  const view: View = sp.view && sp.view in views ? (sp.view as View) : "needs";
  const [replies, drafts, waiting] = await load((c) =>
    Promise.all([
      c.listReplies({ ...views[view].opts, limit: 100 }),
      c.listDrafts(),
      // The "need you" number is the same in every tab, and the same as the sidebar's and the Overview's.
      view === "needs" ? null : c.listReplies({ ...views.needs.opts, limit: 100 }),
    ]),
  );
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
  const initials = (s: string) =>
    s
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  const needYou = needYouCount(waiting ?? replies);
  const ready = convs.filter((c) => c.draft).length;

  return (
    <Page className="lg:h-[calc(100dvh-52px)] lg:min-h-[640px]">
      <PageHeader
        title="Inbox"
        meta={`${needYou} need you · ${ready} ${ready === 1 ? "draft" : "drafts"} ready`}
        actions={
          <nav aria-label="Filter replies" className="flex flex-wrap gap-0.5 rounded-md border border-lk-line bg-white p-[3px]">
            {(Object.keys(views) as View[]).map((v) => (
              <Link
                key={v}
                href={href({ view: v })}
                aria-current={v === view ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded px-2.5 py-[5px] text-[12.5px] transition ${
                  v === view ? "bg-ws-soft font-semibold text-lk-fg" : "text-lk-muted hover:text-lk-fg"
                }`}
              >
                {views[v].label}
                {v === "needs" && needYou > 0 && <span className="font-mono text-[10.5px] font-normal text-lk-dim">{needYou}</span>}
              </Link>
            ))}
          </nav>
        }
      />

      <div className="flex min-h-[420px] flex-1 overflow-hidden rounded-lg border border-lk-line bg-white lg:min-h-0">
        {convs.length === 0 ? (
          <div className="grid flex-1 place-items-center">
            {view === "needs" ? (
              <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
                <span className="grid size-9 place-items-center rounded-lg bg-ws-acc-soft">
                  <CheckCheck className="size-[18px] text-ws-acc-ink" />
                </span>
                <p className="text-[14px] font-semibold text-lk-fg">All caught up</p>
                <p className="font-mono text-[11px] text-lk-muted">Meerko checks your inbox about every minute</p>
                <span className="mt-3 flex gap-6">
                  <Link href={href({ view: "all" })} className={`${headLink} font-medium`}>
                    All replies →
                  </Link>
                  <Link href={href({ view: "automatic" })} className={`${headLink} font-medium`}>
                    Automatic →
                  </Link>
                </span>
              </div>
            ) : (
              <EmptyState icon={Inbox} title="Nothing here yet">
                Replies to your sequences land here. Meerko stops the sequence for anyone who answers.
              </EmptyState>
            )}
          </div>
        ) : (
          <>
            <section
              aria-label="Conversations"
              className={`lk-scroll min-h-0 w-full shrink-0 flex-col overflow-y-auto border-lk-line lg:flex lg:w-[372px] lg:border-r ${picked ? "hidden" : "flex"}`}
            >
              {convs.map((c) => {
                const r = c.latest;
                const on = c.key === current?.key;
                const messages = r.thread.length || 1;
                const said = preview(r.body);
                return (
                  <Link
                    key={c.key}
                    href={href({ reply: r.id })}
                    aria-current={on ? "true" : undefined}
                    className={`relative flex flex-col gap-1.5 border-b border-lk-line py-3 pr-4 pl-[18px] transition ${on ? "bg-lk-frame" : "hover:bg-lk-frame"}`}
                  >
                    {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-lk-fg" />}
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className={`size-[5px] shrink-0 self-center rounded-full ${c.open > 0 ? "bg-lk-fg" : "bg-transparent"}`} />
                      <span className={`truncate text-[13.5px] text-lk-fg ${c.open ? "font-semibold" : "font-medium"}`}>{name(r)}</span>
                      {!!r.row?.company && <span className="truncate text-[12px] text-lk-dim">{String(r.row.company)}</span>}
                      <span className="ml-auto shrink-0 font-mono text-[10.5px] text-lk-dim">{formatWhen(r.receivedAt)}</span>
                    </span>
                    <span className={`line-clamp-2 pl-[13px] text-[12.5px] leading-[1.45] ${said && c.open ? "text-lk-fg" : "text-lk-muted"}`}>
                      {said ? `“${said}”` : <span className="italic">No message text{r.subject ? ` · ${r.subject}` : ""}</span>}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 pl-[13px]">
                      <Pill tone={r.intent ? intentTone[r.intent] : "neutral"}>{r.intent ? label(r.intent) : "unclassified"}</Pill>
                      {c.draft ? (
                        <Pill tone="amber">
                          <Sparkles className="size-[10px]" /> draft ready
                        </Pill>
                      ) : (
                        c.open > 0 && <Pill>reply needed</Pill>
                      )}
                      <span className="min-w-0 truncate font-mono text-[10.5px] text-lk-dim">
                        {messages} {messages === 1 ? "msg" : "msgs"}
                        {r.sequenceName && ` · ${r.sequenceName}`}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </section>

            <section aria-label="Conversation" className={`min-h-0 min-w-0 flex-1 flex-col lg:flex ${picked ? "flex" : "hidden"}`}>
              {!selected || !answerTo ? (
                <EmptyState icon={Inbox} title="No conversation selected">
                  Replies to your sequences land here. Meerko stops the sequence for anyone who answers.
                </EmptyState>
              ) : (
                <>
                  <header className="flex flex-col gap-3 border-b border-lk-line px-5 py-3.5 sm:px-6">
                    <Link href={href({})} className="flex items-center gap-1.5 text-[12.5px] text-lk-muted hover:text-lk-fg lg:hidden">
                      <ArrowLeft className="size-3.5" /> All conversations
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ws-soft font-mono text-[11px] font-semibold text-lk-muted">
                        {initials(name(selected))}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <h2 className="text-[15px] leading-snug font-semibold break-words text-lk-fg">
                          {name(selected)}
                          {who(selected) && <span className="ml-1.5 text-[13px] font-normal text-lk-muted">{who(selected)}</span>}
                        </h2>
                        <p className="truncate font-mono text-[10.5px] text-lk-dim">{[selected.from, selected.sequenceName].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Pill tone={selected.intent ? intentTone[selected.intent] : "neutral"}>
                          {selected.intent ? label(selected.intent) : "unclassified"}
                        </Pill>
                        {current.replies.length > 1 && <Pill>{current.replies.length} replies</Pill>}
                      </div>
                    </div>
                  </header>

                  <div className="lk-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    <Thread messages={selected.thread} prospect={name(selected)} highlightId={answerTo.handledAt ? undefined : answerTo.id} />
                  </div>

                  <footer className="lk-scroll max-h-[50%] shrink-0 overflow-y-auto border-t border-lk-line bg-white px-5 py-4 sm:px-6">
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
          </>
        )}
      </div>
    </Page>
  );
}
