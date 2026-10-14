import { CircleCheck, Eye, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { MeerkoApiError } from "@meerko/sdk";
import { EnrollButton } from "@/components/app/enroll-button";
import { MailboxPoolCard } from "@/components/app/mailbox-pool";
import { SequenceToggle } from "@/components/app/sequence-toggle";
import { Card, formatWhen, PageHeader, Pill, type PillTone } from "@/components/app/ui";
import { load } from "@/lib/meerko";

type Recipient = Awaited<ReturnType<import("@meerko/sdk").MeerkoClient["sequenceRecipients"]>>[number];

// Greetings make useless step summaries ("Hi {{first_name}},"), so skip them.
const GREETING = /^(hi|hello|hey|hola|dear|buenas|bonjour|hallo|ciao|ol[aá])\b/i;
const summaryLine = (body: string) => body.split("\n").map((l) => l.trim()).find((l) => l && !GREETING.test(l)) ?? body.trim();

const days = (n: number) => (n === 0 ? "the same day" : n === 1 ? "1 day later" : `${n} days later`);

function formatSendTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** What happens next for one person, in plain words. */
function personStatus(r: Recipient, totalSteps: number, sending: boolean): { text: string; tone: PillTone; detail?: string } {
  switch (r.state) {
    case "active":
      return {
        text: `Waiting for email ${r.stepsSent + 1}`,
        tone: "amber",
        detail: !sending ? "on hold while the sequence isn't sending" : r.nextSendAt ? `around ${formatSendTime(r.nextSendAt)}` : undefined,
      };
    case "replied":
      return { text: "Replied", tone: "signal", detail: "emails stopped · see Inbox" };
    case "completed":
      return { text: "Finished, no reply", tone: "neutral", detail: `got all ${totalSteps} emails` };
    case "bounced":
      return { text: "Bounced", tone: "neutral", detail: "address doesn't exist" };
    case "unsubscribed":
      return { text: "Unsubscribed", tone: "neutral", detail: "won't be emailed again" };
    case "failed":
      return { text: "Failed", tone: "neutral", detail: r.lastError ?? undefined };
    default:
      return { text: "Stopped", tone: "neutral", detail: r.lastError ?? undefined };
  }
}

export default async function SequencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ row?: string }> }) {
  const { id } = await params;
  const { row } = await searchParams;
  const [seq, stats, mailboxes, recipients, pool, domains] = await load((c) =>
    Promise.all([c.getSequence(id), c.sequenceStats(id), c.listMailboxes(), c.sequenceRecipients(id), c.sequencePool(id), c.mailboxHealth()]),
  );
  const table = await load((c) => c.getTable(seq.tableId));
  // The table may have no rows yet; the preview is optional.
  const preview = await load((c) => c.previewSequence(id, row).catch((e) => (e instanceof MeerkoApiError && e.status === 404 ? null : Promise.reject(e))));
  const working = pool.mailboxes.filter((m) => m.status === "active");
  const next = recipients.filter((r) => r.state === "active" && r.nextSendAt).sort((a, b) => a.nextSendAt!.localeCompare(b.nextSendAt!))[0];
  const nextSend = next?.nextSendAt ?? undefined;

  // One sentence on what is happening right now, and what (if anything) the user should do.
  const banner =
    seq.status === "draft"
      ? {
          tone: "border-accent/60 bg-accent-soft",
          title: "Not started yet",
          text: stats.enrolled
            ? "Check the emails below, then start sending. Nothing goes out until you do."
            : "Add the people below and check what they'll receive, then start sending. Nothing goes out until you do.",
        }
      : seq.status === "paused"
        ? { tone: "border-line bg-raised", title: "Paused", text: "No emails go out until you resume. People who reply are still detected." }
        : working.length === 0
          ? {
              tone: "border-[#e5795b]/60 bg-[#e5795b]/10",
              title: pool.mailboxes.length === 1 ? "Stopped: the mailbox lost access" : "Stopped: every mailbox lost access",
              text: "Reconnect them in Settings and sending picks up where it left off.",
            }
          : stats.remaining === 0
            ? {
                tone: "border-line bg-raised",
                title: "Nothing left to send",
                text: stats.enrolled ? "Everyone has replied, finished or stopped. Add more people to keep going." : "No one is in it yet. Add the people from the table below.",
              }
            : {
                tone: "border-signal/50 bg-signal/5",
                title: `Sending to ${stats.remaining} ${stats.remaining === 1 ? "person" : "people"}`,
                text: nextSend ? `Next email around ${formatSendTime(nextSend)}. Anyone who replies stops getting emails automatically.` : "Anyone who replies stops getting emails automatically.",
              };

  const pct = (n: number) => (stats.enrolled ? `${Math.round((n / stats.enrolled) * 100)}%` : "");
  const results: { label: string; value: number; hint: string; rate?: string; tone?: string }[] = [
    { label: "People", value: stats.enrolled, hint: "enrolled in this sequence" },
    { label: "Emails sent", value: stats.emailsSent, hint: "across all steps" },
    { label: "Replied", value: stats.states.replied ?? 0, rate: pct(stats.states.replied ?? 0), tone: "text-signal", hint: "their emails stop automatically" },
    { label: "Finished, no reply", value: stats.states.completed ?? 0, rate: pct(stats.states.completed ?? 0), hint: "got every email" },
    { label: "Bounced", value: stats.states.bounced ?? 0, rate: pct(stats.states.bounced ?? 0), hint: "address doesn't exist" },
    { label: "Unsubscribed", value: stats.states.unsubscribed ?? 0, rate: pct(stats.states.unsubscribed ?? 0), hint: "asked not to be emailed" },
  ];

  return (
    <div className="flex flex-col gap-6 px-8 py-7">
      <PageHeader
        eyebrow={`Sequences / ${seq.name}`}
        title={seq.name}
        meta={
          <span>
            Sends from{" "}
            <span className="text-fg">{pool.mailboxes.length === 1 ? pool.mailboxes[0]!.email : `${pool.mailboxes.length} mailboxes`}</span> · up to{" "}
            {pool.capacityToday} emails today · weekdays {seq.windowStartHour}:00–{seq.windowEndHour}:00 ({seq.timezone.replace(/_/g, " ")} time) · people from{" "}
            <Link href={`/app/leads/${table.id}`} className="text-fg underline decoration-line underline-offset-2 hover:decoration-fg">
              {table.name}
            </Link>
          </span>
        }
      />

      <section className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4 ${banner.tone}`}>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold">{banner.title}</p>
          <p className="text-[13px] text-muted">{banner.text}</p>
        </div>
        <SequenceToggle id={id} status={seq.status} />
      </section>

      <Card className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {results.map((r) => (
          <div key={r.label} className="flex flex-col gap-1 border-line px-4.5 py-4 [&:not(:last-child)]:border-r">
            <span className="text-[13px] font-medium">{r.label}</span>
            <span className="flex items-end gap-2">
              <span className={`font-display text-[28px] leading-none font-bold ${r.tone ?? ""}`}>{r.value}</span>
              {r.rate && <span className="font-mono text-xs text-muted">{r.rate}</span>}
            </span>
            <span className="text-xs text-muted">{r.hint}</span>
          </div>
        ))}
      </Card>

      <MailboxPoolCard
        sequenceId={id}
        pool={pool}
        domains={domains}
        mailboxes={mailboxes}
        nextSend={seq.status === "active" && next ? { at: formatSendTime(next.nextSendAt!), from: next.mailboxEmail ?? undefined } : undefined}
      />

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <Users className="size-4 text-accent" />
          <h2 className="text-[15px] font-semibold">People</h2>
          <span className="flex-1 text-xs text-muted">who is in this sequence and what happens next</span>
          <EnrollButton sequenceId={id} tableName={table.name} />
        </div>
        {recipients.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-muted">
            Nobody yet. Add everyone from {table.name} who has an email, or ask your agent to “enroll the verified leads from {table.name}”.
            Nothing is sent until you start the sequence.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">
                <tr className="border-b border-line">
                  <th className="px-5 py-2.5 font-normal">Person</th>
                  <th className="px-3 py-2.5 font-normal">Status</th>
                  <th className="px-3 py-2.5 font-normal">Emails received</th>
                  {pool.mailboxes.length > 1 && <th className="px-3 py-2.5 font-normal">From</th>}
                  <th className="px-5 py-2.5 text-right font-normal">Last email</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const status = personStatus(r, seq.steps.length, seq.status === "active");
                  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={r.enrollmentId} className="border-b border-line last:border-0">
                      <td className="px-5 py-3">
                        <span className="flex flex-col">
                          <span className="font-medium">{name || r.email}</span>
                          <span className="font-mono text-[11px] text-muted">{name ? r.email : ""}{r.company ? `${name ? " · " : ""}${r.company}` : ""}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex flex-wrap items-center gap-2">
                          <Pill tone={status.tone}>{status.text}</Pill>
                          {status.detail && <span className="text-xs text-muted">{status.detail}</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted">
                        {r.stepsSent} of {seq.steps.length}
                      </td>
                      {pool.mailboxes.length > 1 && <td className="px-3 py-3 font-mono text-xs text-muted">{r.mailboxEmail ?? "—"}</td>}
                      <td className="px-5 py-3 text-right font-mono text-xs text-muted">{r.lastSentAt ? formatWhen(r.lastSentAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="flex flex-col">
          <h2 className="pb-1 text-[15px] font-semibold">The emails</h2>
          <p className="pb-4 text-xs text-muted">Sent in this order to each person, until they reply.</p>
          {seq.steps.map((s, i) => {
            const result = stats.steps.find((x) => x.position === s.position);
            return (
              <div key={s.position}>
                {i > 0 && (
                  <div className="flex h-10 items-center gap-3 pl-[15px]">
                    <span className="h-full w-0.5 bg-line" />
                    <span className="text-xs text-muted">no reply? next email {days(s.delayDays)}</span>
                  </div>
                )}
                <div className={`flex items-start gap-3.5 rounded-[10px] border p-3.5 ${i === 0 ? "border-accent/70" : "border-line"}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold ${i === 0 ? "bg-accent text-dark" : "bg-line text-fg"}`}>{i + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-xs text-muted">{i === 0 ? "Email 1 · sent first" : `Email ${i + 1} · a reply in the same thread`}</span>
                    <span className="text-[13px] font-semibold">{s.subject ?? summaryLine(s.body)}</span>
                    {s.subject && <span className="line-clamp-1 text-xs text-muted">{summaryLine(s.body)}</span>}
                    <span className="pt-0.5 font-mono text-[11px] text-muted">
                      {result?.sent ?? 0} sent · <span className={result?.repliedAfter ? "text-signal" : ""}>{result?.repliedAfter ?? 0} replied after this one</span>
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <Card raised className="overflow-hidden">
          {!preview ? (
            <p className="p-6 text-[13px] text-muted">Add people to {table.name} to see what they’ll receive.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-[13px]">
                <span className="flex items-center gap-2">
                  <Eye className="size-3.5 text-muted" />
                  <span className="font-semibold">What they receive</span>
                  <span className="text-muted">shown for</span>
                  <span className="font-mono text-xs">{preview.to ?? "a person without an email"}</span>
                </span>
                {preview.missingVars.length === 0 ? (
                  <span className="flex items-center gap-1.5 text-xs text-signal"><CircleCheck className="size-3.5" />Every placeholder is filled in</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-[#e5795b]"><TriangleAlert className="size-3.5" />Missing {preview.missingVars.join(", ")}, so this person is skipped</span>
                )}
              </div>
              {preview.steps.map((s) => (
                <article key={s.position} className="flex flex-col gap-3 border-b border-line px-6 py-5 last:border-0">
                  <div className="flex items-center justify-between font-mono text-xs text-muted">
                    <span>Email {s.position + 1}</span>
                    {s.position > 0 && <span>{days(s.delayDays)}, if no reply</span>}
                  </div>
                  <p className="text-[13px]"><span className="text-muted">Subject: </span><span className="font-semibold">{s.subject}</span></p>
                  <p className="text-sm leading-relaxed whitespace-pre-line">{s.body}</p>
                </article>
              ))}
              <p className="px-6 pb-5 text-xs text-muted">Every email ends with a one-click unsubscribe link.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
