import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import type { Reply } from "@meerko/sdk";
import { DraftPanel } from "@/components/app/draft-panel";
import { Thread } from "@/components/app/thread";
import { AgentHint, EmptyState, formatWhen, intentTone, label, Page, PageHeader, Pill } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "LK · App Inbox" (MisNc) in the .pen file: the replies, the thread, and the draft.

const views = {
  needs: { label: "Needs you", opts: {} },
  interested: { label: "Interested", opts: { intent: "interested" } },
  all: { label: "All", opts: { unclassified: false } },
  automatic: { label: "Automatic", opts: { unclassified: false, includeAutomatic: true } },
} as const;
type View = keyof typeof views;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; reply?: string }> }) {
  const sp = await searchParams;
  const view: View = sp.view && sp.view in views ? (sp.view as View) : "needs";
  const [replies, drafts] = await load((c) => Promise.all([c.listReplies({ ...views[view].opts, limit: 100 }), c.listDrafts()]));
  const selected: Reply | undefined = replies.find((r) => r.id === sp.reply) ?? replies[0];
  const draft = selected ? drafts.find((d) => d.replyId === selected.id) : undefined;
  // The user's own email is the latest in the conversation: nothing is waiting on them.
  const answered = selected?.thread.at(-1)?.direction === "out";
  const href = (o: { view?: View; reply?: string }) => `?${new URLSearchParams({ view: o.view ?? view, ...(o.reply ? { reply: o.reply } : {}) })}`;
  // On a phone the list and the conversation take turns: a picked reply shows its thread, with a way back.
  const picked = !!sp.reply && !!selected;
  const name = (r: Reply) => (r.row?.first_name ? `${r.row.first_name} ${r.row.last_name ?? ""}`.trim() : r.from);

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
          {replies.length === 0 && (
            <p className="px-[18px] py-10 text-[15px] text-lk-muted">
              {view === "needs" ? "No replies waiting. Meerko checks your inbox about every minute." : "Nothing here yet."}
            </p>
          )}
          {replies.map((r) => {
            const on = r.id === selected?.id;
            return (
              <Link
                key={r.id}
                href={href({ reply: r.id })}
                className={`relative flex flex-col gap-2 border-b border-lk-line px-[18px] py-3.5 transition ${on ? "bg-lk-lime/[0.06]" : "hover:bg-lk-frame"}`}
              >
                {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-lk-lime" />}
                <span className="flex items-center gap-2">
                  {!r.intent && <span className="size-[7px] shrink-0 bg-lk-lime" />}
                  <span className={`flex-1 truncate text-[15.5px] text-lk-fg ${r.intent ? "font-medium" : "font-bold"}`}>{name(r)}</span>
                  <span className="font-plex text-[12px] text-lk-dim">{formatWhen(r.receivedAt)}</span>
                </span>
                {!!(r.row?.company ?? r.sequenceName) && <span className="truncate font-plex text-[12.5px] tracking-[0.4px] text-lk-dim">{String(r.row?.company ?? r.sequenceName ?? "")}</span>}
                <span className={`line-clamp-2 text-[15px] leading-snug ${r.intent ? "text-lk-muted" : "text-lk-fg"}`}>{r.body}</span>
                <span className="flex flex-wrap gap-2">
                  <Pill tone={r.intent ? intentTone[r.intent] : "neutral"}>{r.intent ? label(r.intent) : "unclassified"}</Pill>
                  {drafts.some((d) => d.replyId === r.id) && <Pill tone="solid">draft ready</Pill>}
                </span>
              </Link>
            );
          })}
        </section>

        <section className={`min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6 lg:flex ${picked ? "flex" : "hidden"}`}>
          {!selected ? (
            <EmptyState icon={Inbox} title="No reply selected">
              Replies to your sequences land here. Meerko stops the sequence for anyone who answers.
            </EmptyState>
          ) : (
            <>
              <Link href={href({})} className="flex items-center gap-2 font-plex text-[13px] tracking-[0.6px] text-lk-muted uppercase hover:text-lk-fg lg:hidden">
                <ArrowLeft className="size-4" /> All replies
              </Link>
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h2 className="text-[20px] font-semibold tracking-[-0.5px] break-words text-lk-fg">{name(selected)}</h2>
                  <p className="font-plex text-[12.5px] tracking-[0.4px] break-words text-lk-dim">
                    {[selected.row?.title, selected.row?.company, selected.from].filter(Boolean).map(String).join(" · ")}
                  </p>
                </div>
                {selected.sequenceName && <Pill>{selected.sequenceName}</Pill>}
              </header>

              <Thread messages={selected.thread} prospect={name(selected)} highlightId={selected.handledAt ? undefined : selected.id} />

              <DraftPanel
                key={selected.id}
                replyId={selected.id}
                intent={selected.intent}
                draft={draft ? { id: draft.id, body: draft.body } : null}
                answered={answered}
              />
              {!draft && !answered && <AgentHint command="draft replies to my new replies">Or let your agent draft it.</AgentHint>}
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
