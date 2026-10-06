import { Inbox } from "lucide-react";
import Link from "next/link";
import type { Reply } from "@meerko/sdk";
import { DraftPanel } from "@/components/app/draft-panel";
import { Thread } from "@/components/app/thread";
import { AgentHint, EmptyState, formatWhen, intentTone, label, Pill } from "@/components/app/ui";
import { load } from "@/lib/meerko";

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

  return (
    <div className="flex h-dvh">
      <section className="flex w-[380px] shrink-0 flex-col border-r border-line">
        <div className="flex flex-col gap-3.5 px-5 pt-7 pb-4">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">Inbox</h1>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(views) as View[]).map((v) => (
              <Link
                key={v}
                href={href({ view: v })}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v === view ? "bg-fg text-dark" : "border border-line text-muted hover:text-fg"}`}
              >
                {views[v].label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {replies.length === 0 && (
            <p className="px-5 py-10 text-[13px] text-muted">
              {view === "needs" ? "No replies waiting. Meerko checks your inbox about every minute." : "Nothing here yet."}
            </p>
          )}
          {replies.map((r) => {
            const on = r.id === selected?.id;
            return (
              <Link
                key={r.id}
                href={href({ reply: r.id })}
                className={`relative flex flex-col gap-1.5 border-b border-line px-5 py-3.5 ${on ? "bg-raised" : "hover:bg-raised/50"}`}
              >
                {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" />}
                <span className="flex items-center gap-2">
                  {!r.intent && <span className="size-[7px] rounded-full bg-signal" />}
                  <span className={`flex-1 truncate text-[13px] ${r.intent ? "font-medium" : "font-bold"}`}>{r.row?.first_name ? `${r.row.first_name} ${r.row.last_name ?? ""}` : r.from}</span>
                  <span className="font-mono text-[11px] text-muted">{formatWhen(r.receivedAt)}</span>
                </span>
                <span className="text-xs text-muted">{String(r.row?.company ?? r.sequenceName ?? "")}</span>
                <span className={`line-clamp-2 text-[13px] leading-snug ${r.intent ? "text-muted" : ""}`}>{r.body}</span>
                <span className="flex gap-1.5">
                  <Pill tone={r.intent ? intentTone[r.intent] : "neutral"}>{r.intent ? label(r.intent) : "unclassified"}</Pill>
                  {drafts.some((d) => d.replyId === r.id) && <Pill tone="amber">draft ready</Pill>}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-10 py-7">
        {!selected ? (
          <EmptyState icon={Inbox} title="No reply selected">
            Replies to your sequences land here. Meerko stops the sequence for anyone who answers.
          </EmptyState>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  {selected.row?.first_name ? `${selected.row.first_name} ${selected.row.last_name ?? ""}` : selected.from}
                </h2>
                <p className="text-[13px] text-muted">
                  {[selected.row?.title, selected.row?.company, selected.from].filter(Boolean).map(String).join(" · ")}
                </p>
              </div>
              {selected.sequenceName && <Pill>{selected.sequenceName}</Pill>}
            </header>

            <Thread
              messages={selected.thread}
              prospect={selected.row?.first_name ? `${selected.row.first_name} ${selected.row.last_name ?? ""}`.trim() : selected.from}
              highlightId={selected.handledAt ? undefined : selected.id}
            />

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
  );
}
