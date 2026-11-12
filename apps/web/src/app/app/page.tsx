import { Mail, Waves } from "lucide-react";
import Link from "next/link";
import { STAGES } from "@meerko/sdk";
import { buttonClass, Card, CardHead, Count, EmptyState, headLink, intentTone, label, monoLabel, Page, PageHeader, Pill, type PillTone } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "WS · Overview v3 (Antwork v3 pattern, 2026-11-12)" (DzBNk) in docs/design/meerko.pen.

type Need = { who: string; sub: string; pill: [string, PillTone]; state: string; action: string; primary: boolean; warn?: boolean };

export default async function OverviewPage() {
  const [pipeline, sequences, replies, drafts, mailboxes] = await load((c) =>
    Promise.all([c.pipeline(), c.listSequences(), c.listReplies({ limit: 100 }), c.listDrafts(), c.listMailboxes()]),
  );
  const stats = await load((c) => Promise.all(sequences.map((s) => c.sequenceStats(s.id))));

  const draftFor = new Set(drafts.map((d) => d.replyId));
  const needs: Need[] = [
    ...drafts.map((d) => ({
      who: d.to,
      sub: d.intent ? label(d.intent) : "reply",
      pill: [d.intent ? label(d.intent) : "reply", d.intent ? intentTone[d.intent] ?? "neutral" : "neutral"] as [string, PillTone],
      state: "Draft ready",
      action: "Review",
      primary: true,
    })),
    ...replies
      .filter((r) => !draftFor.has(r.id))
      .map((r) => ({
        who: r.from,
        sub: r.sequenceName ?? "reply",
        pill: [r.intent ? label(r.intent) : "new reply", r.intent ? intentTone[r.intent] ?? "neutral" : "neutral"] as [string, PillTone],
        state: r.intent ? "Reply needed" : "Not sorted yet",
        action: "Reply",
        primary: false,
      })),
    ...mailboxes
      .filter((m) => m.status === "error")
      .map((m) => ({ who: m.email, sub: "Mailbox", pill: ["lost access", "red"] as [string, PillTone], state: "Sending paused", action: "Reconnect", primary: false, warn: true })),
  ];

  const sent = stats.reduce((n, s) => n + s.emailsSent, 0);
  const enrolled = stats.reduce((n, s) => n + s.enrolled, 0);
  const replied = stats.reduce((n, s) => n + (s.states.replied ?? 0), 0);
  const sending = sequences.filter((s) => s.status === "active").length;
  const max = Math.max(1, ...STAGES.map((s) => pipeline.stages[s]));
  const contacted = STAGES.filter((s) => s !== "new").reduce((n, s) => n + pipeline.stages[s], 0);
  const meetings = pipeline.stages.meeting + pipeline.stages.won;

  const metrics: [string, string, boolean][] = [
    ["Emails sent", sent.toLocaleString("en"), false],
    ["Replies", replied.toLocaleString("en"), false],
    ["Reply rate", enrolled ? `${((replied / enrolled) * 100).toFixed(1)}%` : "—", false],
    ["Meetings", pipeline.stages.meeting.toLocaleString("en"), true],
    ["Won", pipeline.stages.won.toLocaleString("en"), true],
  ];

  return (
    <Page>
      <PageHeader
        title="Overview"
        meta={`${sending} ${sending === 1 ? "sequence" : "sequences"} sending · ${mailboxes.length} ${mailboxes.length === 1 ? "mailbox" : "mailboxes"} · ${pipeline.total.toLocaleString("en")} leads`}
      />

      <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-lk-line bg-lk-line [gap:1px] sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map(([name, value, outcome]) => (
          <div key={name} className="flex flex-col gap-2.5 bg-white px-[18px] py-4">
            <span className={monoLabel}>{name}</span>
            <span className={`font-display text-[28px] leading-none font-bold tracking-[-0.6px] ${outcome && value !== "0" ? "text-ws-acc-ink" : "text-lk-fg"}`}>{value}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHead
            title={
              <>
                Needs you {needs.length > 0 && <Count>{needs.length}</Count>}
              </>
            }
          >
            <Link href="/app/inbox" className={headLink}>
              Open inbox →
            </Link>
          </CardHead>
          {needs.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-lk-muted">Nothing waiting. New replies show up here within a couple of minutes.</p>
          ) : (
            needs.slice(0, 6).map((n, i) => (
              <div key={i} className="flex min-h-14 items-center gap-3 border-b border-lk-line px-4 py-2.5 last:border-0">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${n.warn ? "bg-ws-red-soft text-ws-red" : "bg-ws-soft text-lk-muted"}`}
                >
                  {n.warn ? "!" : n.who.slice(0, 2).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-lk-fg">{n.who}</span>
                  <span className="truncate text-[12px] text-lk-dim">{n.sub}</span>
                </span>
                <span className="hidden w-[110px] sm:block">
                  <Pill tone={n.pill[1]}>{n.pill[0]}</Pill>
                </span>
                <span className="hidden w-[120px] font-mono text-[11px] text-lk-muted md:block">{n.state}</span>
                <Link href={n.warn ? "/app/settings" : "/app/inbox"} className={`${buttonClass(n.primary ? "primary" : "secondary", "sm")} w-[84px]`}>
                  {n.action}
                </Link>
              </div>
            ))
          )}
        </Card>

        <Card className="self-start">
          <CardHead title="Pipeline">
            <span className="text-[12.5px] text-lk-muted">{pipeline.total.toLocaleString("en")} leads</span>
          </CardHead>
          {pipeline.total === 0 ? (
            <EmptyState icon={Waves} title="No leads yet">
              Ask your agent to “find 50 social media agency founders in Spain” and they’ll land here.
            </EmptyState>
          ) : (
            <>
              <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4">
                {STAGES.map((s) => {
                  const n = pipeline.stages[s];
                  return (
                    <div key={s} className="flex items-center gap-2.5">
                      <span className="w-[70px] text-[12.5px] text-lk-muted capitalize">{s}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-sm bg-[#f3f0ea]">
                        <span
                          className={`block h-full rounded-sm ${s === "meeting" || s === "won" ? "bg-ws-acc" : s === "lost" ? "bg-lk-gray" : "bg-lk-fg"}`}
                          style={{ width: `${Math.max(n ? 2 : 1, (n / max) * 100)}%` }}
                        />
                      </span>
                      <span className="w-10 text-right font-mono text-[12px] text-lk-fg">{n.toLocaleString("en")}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between border-t border-lk-line px-4 py-2.5 text-[12px]">
                <span className="text-lk-dim">Contacted → meeting</span>
                <span className="font-mono font-semibold text-lk-fg">{contacted ? `${((meetings / contacted) * 100).toFixed(1)}%` : "—"}</span>
              </div>
            </>
          )}
        </Card>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-lk-line">
                  {["Sequence", "Enrolled", "Sent", "Replied", "Status"].map((h) => (
                    <th key={h} className={`bg-ws-head px-4 py-2.5 text-left font-mono text-[10px] font-normal tracking-[1px] text-lk-dim uppercase`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.id} className="border-b border-lk-line last:border-0 hover:bg-lk-frame">
                    <td className="px-4 py-3">
                      <Link href={`/app/sequences/${s.id}`} className="text-[13px] font-medium text-lk-fg hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-lk-fg">{s.enrolled.toLocaleString("en")}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-lk-fg">{s.emailsSent.toLocaleString("en")}</td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold text-lk-fg">{s.enrolled ? `${s.replyRate}%` : "—"}</td>
                    <td className="px-4 py-3">
                      <Pill tone={s.status === "active" ? "signal" : s.status === "paused" ? "red" : "neutral"}>{s.status === "active" ? "sending" : s.status}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
