import { CircleHelp, Mail, MessageSquare, Sparkles, TriangleAlert, Waves } from "lucide-react";
import Link from "next/link";
import { STAGES } from "@meerko/sdk";
import { Card, EmptyState, label, PageHeader } from "@/components/app/ui";
import { load } from "@/lib/meerko";

const barColor: Record<string, string> = {
  new: "bg-line",
  contacted: "bg-accent",
  replied: "bg-signal",
  meeting: "bg-signal/60",
  won: "bg-fg",
  lost: "bg-line",
};

export default async function OverviewPage() {
  const [pipeline, sequences, replies, drafts, mailboxes] = await load((c) =>
    Promise.all([c.pipeline(), c.listSequences(), c.listReplies({ limit: 100 }), c.listDrafts(), c.listMailboxes()]),
  );
  const stats = await load((c) => Promise.all(sequences.map((s) => c.sequenceStats(s.id))));

  const draftFor = new Set(drafts.map((d) => d.replyId));
  const needs = [
    ...drafts.map((d) => ({ icon: Sparkles, tone: "text-accent", line: `Draft ready for ${d.to}`, sub: `${d.intent ? label(d.intent) : "reply"} · approve or edit` })),
    ...replies
      .filter((r) => !draftFor.has(r.id))
      .map((r) => ({
        icon: r.intent === "question" ? CircleHelp : MessageSquare,
        tone: "text-signal",
        line: `${r.from} replied`,
        sub: `${r.intent ? label(r.intent) : "unclassified"} · ${r.sequenceName ?? "sequence"}`,
      })),
    ...mailboxes
      .filter((m) => m.status === "error")
      .map((m) => ({ icon: TriangleAlert, tone: "text-[#e5795b]", line: `${m.email} lost access`, sub: "reconnect it in Settings" })),
  ];
  const max = Math.max(1, ...STAGES.map((s) => pipeline.stages[s]));
  const sent = stats.reduce((n, s) => n + s.emailsSent, 0);
  const enrolled = stats.reduce((n, s) => n + s.enrolled, 0);
  const replied = stats.reduce((n, s) => n + (s.states.replied ?? 0), 0);

  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageHeader
        eyebrow="Overview"
        title={needs.length ? `${needs.length} ${needs.length === 1 ? "thing needs" : "things need"} you.` : "All caught up."}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Pipeline</h2>
            <span className="font-mono text-xs text-muted">{pipeline.total.toLocaleString("en")} leads</span>
          </div>
          {pipeline.total === 0 ? (
            <EmptyState icon={Waves} title="No leads yet">
              Ask your agent to “find 50 social media agency founders in Spain” and they’ll land here.
            </EmptyState>
          ) : (
            <>
              {STAGES.map((s) => (
                <div key={s} className="flex items-center gap-3.5">
                  <span className="w-20 text-[13px] text-muted capitalize">{s}</span>
                  <div className="h-[22px] flex-1 rounded bg-white/[0.03]">
                    <div className={`h-full rounded ${barColor[s]}`} style={{ width: `${Math.max(pipeline.stages[s] ? 1 : 0, (pipeline.stages[s] / max) * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right font-mono text-[13px] font-bold">{pipeline.stages[s]}</span>
                </div>
              ))}
              <p className="text-xs text-muted">
                {enrolled ? `Reply rate ${((replied / enrolled) * 100).toFixed(1)}% · ${sent} emails sent across ${sequences.length} ${sequences.length === 1 ? "sequence" : "sequences"}` : "No emails sent yet"}
              </p>
            </>
          )}
        </Card>

        <Card raised className="flex flex-col p-5">
          <div className="flex items-center justify-between pb-2.5">
            <h2 className="text-[15px] font-semibold">Needs you</h2>
            <Link href="/app/inbox" className="text-xs text-accent hover:underline">Open inbox →</Link>
          </div>
          {needs.length === 0 ? (
            <p className="py-6 text-[13px] text-muted">Nothing waiting. New replies show up here within a couple of minutes.</p>
          ) : (
            needs.slice(0, 6).map((n, i) => (
              <Link key={i} href="/app/inbox" className="flex items-start gap-3 border-b border-line py-2.5 last:border-0 hover:opacity-80">
                <n.icon className={`mt-0.5 size-4 shrink-0 ${n.tone}`} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium">{n.line}</span>
                  <span className="text-xs text-muted">{n.sub}</span>
                </span>
              </Link>
            ))
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold">Sequences</h2>
          <Link href="/app/sequences" className="text-xs text-accent hover:underline">All sequences →</Link>
        </div>
        {sequences.length === 0 ? (
          <EmptyState icon={Mail} title="No sequences yet">
            Ask your agent to “write a 3-step sequence for this table and show me a preview”.
          </EmptyState>
        ) : (
          stats.map((s) => (
            <Link key={s.id} href={`/app/sequences/${s.id}`} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0 hover:bg-raised">
              <span className={`size-2 rounded-full ${s.status === "active" ? "bg-signal" : s.status === "paused" ? "bg-muted" : "bg-accent"}`} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-semibold">{s.name}</span>
                <span className="text-xs text-muted capitalize">{s.status === "active" ? "sending" : s.status}</span>
              </span>
              <span className="font-mono text-xs text-muted">{s.emailsSent} sent</span>
              <span className={`w-24 text-right font-mono text-xs ${s.replyRate ? "text-signal" : "text-muted"}`}>{s.replyRate}% replied</span>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
