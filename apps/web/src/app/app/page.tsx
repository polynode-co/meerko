import { Mail, Waves } from "lucide-react";
import Link from "next/link";
import { STAGES } from "@meerko/sdk";
import { buttonClass, Card, CardHead, EmptyState, headLink, intentTone, label, monoLabel, Page, PageHeader, Pill, type PillTone } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "LK · App Overview" (rhl3j) in the .pen file.

export default async function OverviewPage() {
  const [pipeline, sequences, replies, drafts, mailboxes] = await load((c) =>
    Promise.all([c.pipeline(), c.listSequences(), c.listReplies({ limit: 100 }), c.listDrafts(), c.listMailboxes()]),
  );
  const stats = await load((c) => Promise.all(sequences.map((s) => c.sequenceStats(s.id))));

  const draftFor = new Set(drafts.map((d) => d.replyId));
  const needs: { line: string; sub: string; pills: [string, PillTone][] }[] = [
    ...drafts.map((d) => ({
      line: `Draft ready for ${d.to}`,
      sub: `${d.intent ? label(d.intent) : "reply"} · approve or edit`,
      pills: [["draft ready", "solid"]] as [string, PillTone][],
    })),
    ...replies
      .filter((r) => !draftFor.has(r.id))
      .map((r) => ({
        line: `${r.from} replied`,
        sub: `${r.intent ? label(r.intent) : "unclassified"} · ${r.sequenceName ?? "sequence"}`,
        pills: [[r.intent ? label(r.intent) : "unclassified", r.intent ? intentTone[r.intent] : "neutral"]] as [string, PillTone][],
      })),
    ...mailboxes
      .filter((m) => m.status === "error")
      .map((m) => ({ line: `${m.email} lost access`, sub: "reconnect it in Connections", pills: [["reconnect", "amber"]] as [string, PillTone][] })),
  ];
  const max = Math.max(1, ...STAGES.map((s) => pipeline.stages[s]));
  const sent = stats.reduce((n, s) => n + s.emailsSent, 0);
  const enrolled = stats.reduce((n, s) => n + s.enrolled, 0);
  const replied = stats.reduce((n, s) => n + (s.states.replied ?? 0), 0);

  return (
    <Page>
      <PageHeader
        eyebrow="Overview"
        title={needs.length ? `${needs.length} ${needs.length === 1 ? "thing needs" : "things need"} you.` : "All caught up."}
        actions={
          <>
            <a href="/docs/quick-start" className={buttonClass("secondary")}>
              Connect your agent
            </a>
            <Link href="/app/leads/find" className={buttonClass("primary")}>
              Find leads →
            </Link>
          </>
        }
      />

      <Card>
        <CardHead title="Pipeline">
          <span className={monoLabel}>{pipeline.total.toLocaleString("en")} leads</span>
        </CardHead>
        {pipeline.total === 0 ? (
          <EmptyState icon={Waves} title="No leads yet">
            Ask your agent to “find 50 social media agency founders in Spain” and they’ll land here.
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-px bg-lk-line sm:grid-cols-3 xl:grid-cols-6">
              {STAGES.map((s) => (
                <div key={s} className="flex flex-col gap-2.5 bg-lk-box px-[18px] py-[18px]">
                  <span className={monoLabel}>{s}</span>
                  <span className={`text-[32px] leading-none font-semibold tracking-[-1px] ${s === "meeting" || s === "won" ? "text-lk-lime" : "text-lk-fg"}`}>
                    {pipeline.stages[s].toLocaleString("en")}
                  </span>
                  <div className="h-1 bg-lk-line">
                    <div
                      className={`h-full ${s === "lost" ? "bg-lk-gray" : "bg-lk-lime"}`}
                      style={{ width: `${Math.max(pipeline.stages[s] ? 2 : 0, (pipeline.stages[s] / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t border-lk-line px-[18px] py-3 font-plex text-[13px] tracking-[0.4px] text-lk-dim">
              {enrolled
                ? `Reply rate ${((replied / enrolled) * 100).toFixed(1)}% · ${sent} emails sent across ${sequences.length} ${sequences.length === 1 ? "sequence" : "sequences"}`
                : "No emails sent yet"}
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHead title="Needs you">
            <Link href="/app/inbox" className={headLink}>
              Open inbox →
            </Link>
          </CardHead>
          {needs.length === 0 ? (
            <p className="px-[18px] py-6 text-[15px] text-lk-muted">Nothing waiting. New replies show up here within a couple of minutes.</p>
          ) : (
            needs.slice(0, 6).map((n, i) => (
              <Link key={i} href="/app/inbox" className="flex items-center gap-3.5 border-b border-lk-line px-[18px] py-3.5 transition last:border-0 hover:bg-lk-frame">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[15.5px] font-semibold text-lk-fg">{n.line}</span>
                  <span className="truncate text-[15px] text-lk-muted">{n.sub}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-2">
                  {n.pills.map(([text, tone]) => (
                    <Pill key={text} tone={tone}>
                      {text}
                    </Pill>
                  ))}
                </span>
              </Link>
            ))
          )}
        </Card>

        <Card>
          <CardHead title="Sequences">
            <Link href="/app/sequences" className={headLink}>
              All sequences →
            </Link>
          </CardHead>
          {sequences.length === 0 ? (
            <EmptyState icon={Mail} title="No sequences yet">
              Ask your agent to “write a 3-step sequence for this table and show me a preview”.
            </EmptyState>
          ) : (
            stats.map((s) => (
              <Link key={s.id} href={`/app/sequences/${s.id}`} className="flex flex-col gap-2.5 border-b border-lk-line px-[18px] py-3.5 transition last:border-0 hover:bg-lk-frame">
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15.5px] font-semibold text-lk-fg">{s.name}</span>
                  <Pill tone={s.status === "active" ? "solid" : "neutral"}>{s.status === "active" ? "sending" : s.status}</Pill>
                </span>
                <span className="font-plex text-[13px] tracking-[0.6px] text-lk-dim uppercase">
                  {s.emailsSent} sent · <span className={s.replyRate ? "text-lk-lime" : ""}>{s.replyRate}% replied</span>
                </span>
              </Link>
            ))
          )}
        </Card>
      </div>
    </Page>
  );
}
