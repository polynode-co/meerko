import { CalendarClock, CircleCheck, Eye, Mail, Table2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { MeerkoApiError } from "@meerko/sdk";
import { SequenceToggle } from "@/components/app/sequence-toggle";
import { Card, PageHeader, Pill } from "@/components/app/ui";
import { load } from "@/lib/meerko";

export default async function SequencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ row?: string }> }) {
  const { id } = await params;
  const { row } = await searchParams;
  const [seq, stats, mailboxes] = await load((c) => Promise.all([c.getSequence(id), c.sequenceStats(id), c.listMailboxes()]));
  const table = await load((c) => c.getTable(seq.tableId));
  // The table may have no rows yet; the preview is optional.
  const preview = await load((c) => c.previewSequence(id, row).catch((e) => (e instanceof MeerkoApiError && e.status === 404 ? null : Promise.reject(e))));
  const mailbox = mailboxes.find((m) => m.id === seq.mailboxId);
  const pct = (n: number) => (stats.enrolled ? `${((n / stats.enrolled) * 100).toFixed(1)}%` : "");
  const tiles: [string, number, string, string?][] = [
    ["Enrolled", stats.enrolled, ""],
    ["Emails sent", stats.emailsSent, ""],
    ["Replied", stats.states.replied ?? 0, pct(stats.states.replied ?? 0), "text-signal"],
    ["Completed", stats.states.completed ?? 0, pct(stats.states.completed ?? 0)],
    ["Bounced", stats.states.bounced ?? 0, pct(stats.states.bounced ?? 0)],
    ["Unsubscribed", stats.states.unsubscribed ?? 0, pct(stats.states.unsubscribed ?? 0)],
  ];

  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageHeader
        eyebrow={`Sequences / ${seq.name}`}
        title={
          <span className="flex items-center gap-3">
            {seq.name}
            <Pill tone={seq.status === "active" ? "signal" : seq.status === "draft" ? "amber" : "neutral"}>
              {seq.status === "active" && <span className="size-[7px] rounded-full bg-signal" />}
              {seq.status === "active" ? "Sending" : seq.status === "draft" ? "Draft" : "Paused"}
            </Pill>
          </span>
        }
        meta={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{mailbox ? `${mailbox.email} · ${mailbox.dailyLimit}/day` : "mailbox removed"}</span>
            <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5" />Mon–Fri {seq.windowStartHour}:00–{seq.windowEndHour}:00 · {seq.timezone}</span>
            <Link href={`/app/leads/${table.id}`} className="flex items-center gap-1.5 hover:text-fg"><Table2 className="size-3.5" />{table.name}</Link>
          </span>
        }
        actions={<SequenceToggle id={id} status={seq.status} />}
      />

      <Card className="grid grid-cols-3 lg:grid-cols-6">
        {tiles.map(([l, v, rate, tone], i) => (
          <div key={l} className={`flex flex-col gap-1.5 px-4.5 py-4 ${i < tiles.length - 1 ? "border-r border-line" : ""}`}>
            <span className="text-xs text-muted">{l}</span>
            <span className="flex items-end gap-2">
              <span className={`font-display text-[28px] leading-none font-bold ${tone ?? ""}`}>{v}</span>
              {rate && <span className="font-mono text-xs text-muted">{rate}</span>}
            </span>
          </div>
        ))}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="flex flex-col">
          <p className="pb-3 font-mono text-[11px] tracking-[0.12em] text-muted">STEPS</p>
          {seq.steps.map((s, i) => (
            <div key={s.position}>
              {i > 0 && (
                <div className="flex h-11 items-center gap-3 pl-[15px]">
                  <span className="h-full w-0.5 bg-line" />
                  <span className="font-mono text-[11px] text-muted">wait {s.delayDays} {s.delayDays === 1 ? "day" : "days"}</span>
                </div>
              )}
              <div className={`flex items-start gap-3.5 rounded-[10px] border p-3.5 ${i === 0 ? "border-accent bg-raised" : "border-line"}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold ${i === 0 ? "bg-accent text-dark" : "bg-line text-muted"}`}>{i + 1}</span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-mono text-[11px] text-muted">{i === 0 ? "Day 0" : `+${s.delayDays} days · reply in thread`}</span>
                  <span className={`text-[13px] font-semibold ${i === 0 ? "" : "text-muted"}`}>{s.subject ?? `“${s.body.split("\n").find((l) => l.trim()) ?? ""}”`}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        <Card raised className="overflow-hidden">
          {!preview ? (
            <p className="p-6 text-[13px] text-muted">Add rows to {table.name} to preview this sequence.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4.5 py-3 text-[13px]">
                <span className="flex items-center gap-2 text-muted"><Eye className="size-3.5" />Preview for <span className="font-mono text-xs text-fg">{preview.to ?? "a row without email"}</span></span>
                {preview.missingVars.length === 0 ? (
                  <span className="flex items-center gap-1.5 text-xs text-signal"><CircleCheck className="size-3.5" />All variables filled</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-[#e5795b]"><TriangleAlert className="size-3.5" />Missing {preview.missingVars.join(", ")} (row is skipped)</span>
                )}
              </div>
              {preview.steps.map((s) => (
                <article key={s.position} className="flex flex-col gap-3 border-b border-line px-6 py-5 last:border-0">
                  <div className="flex items-center justify-between font-mono text-xs text-muted">
                    <span>Step {s.position + 1}</span>
                    {s.position > 0 && <span>+{s.delayDays} days</span>}
                  </div>
                  <p className="text-[13px] font-semibold">{s.subject}</p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{s.body}</p>
                </article>
              ))}
              <p className="px-6 pb-5 font-mono text-[11px] text-muted">Each email ends with a one-click unsubscribe line.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
