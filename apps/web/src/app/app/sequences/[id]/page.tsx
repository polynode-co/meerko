import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { MeerkoApiError } from "@meerko/sdk";
import { EnrollButton } from "@/components/app/enroll-button";
import { MailboxPoolCard } from "@/components/app/mailbox-pool";
import { PendingEmails } from "@/components/app/pending-emails";
import { DeleteSequence } from "@/components/app/delete-sequence";
import { SequenceToggle } from "@/components/app/sequence-toggle";
import { Card, CardHead, crumb, formatWhen, monoLabel, Page, PageHeader, Pill, td, th, type PillTone } from "@/components/app/ui";
import { load } from "@/lib/meerko";

// "WS3 · Sequence detail" (QXi5p) in the .pen file.

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
        text: `waiting for email ${r.stepsSent + 1}`,
        tone: "amber",
        detail: !sending ? "on hold while the sequence isn't sending" : r.nextSendAt ? `~${formatSendTime(r.nextSendAt)}` : undefined,
      };
    case "replied":
      return { text: "replied", tone: "signal", detail: "emails stopped · see Inbox" };
    case "completed":
      return { text: "finished, no reply", tone: "neutral", detail: `got all ${totalSteps} emails` };
    case "bounced":
      return { text: "bounced", tone: "red", detail: "address doesn't exist" };
    case "unsubscribed":
      return { text: "unsubscribed", tone: "neutral", detail: "won't be emailed again" };
    case "failed":
      return { text: "failed", tone: "red", detail: r.lastError ?? undefined };
    default:
      return { text: "stopped", tone: "neutral", detail: r.lastError ?? undefined };
  }
}

const statusTone: Record<string, PillTone> = { active: "signal", paused: "amber", draft: "neutral" };

export default async function SequencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ row?: string }> }) {
  const { id } = await params;
  const { row } = await searchParams;
  const [seq, stats, mailboxes, recipients, pool, domains, waiting] = await load((c) =>
    Promise.all([
      c.getSequence(id),
      c.sequenceStats(id),
      c.listMailboxes(),
      c.sequenceRecipients(id),
      c.sequencePool(id),
      c.mailboxHealth(),
      // Empty when the workspace sends sequence emails on its own.
      c.listPendingEmails({ sequenceId: id, limit: 200 }),
    ]),
  );
  const table = await load((c) => c.getTable(seq.tableId));
  // The table may have no rows yet; the preview is optional.
  const preview = await load((c) => c.previewSequence(id, row).catch((e) => (e instanceof MeerkoApiError && e.status === 404 ? null : Promise.reject(e))));
  const working = pool.mailboxes.filter((m) => m.status === "active");
  const next = recipients.filter((r) => r.state === "active" && r.nextSendAt).sort((a, b) => a.nextSendAt!.localeCompare(b.nextSendAt!))[0];
  const nextSend = next?.nextSendAt ?? undefined;

  // One line on what is happening, when it needs saying: the header, the approval card and the pool already show the rest.
  const banner: { tone: "amber" | "neutral" | "red"; title: string; text: string } | null =
    seq.status === "draft"
      ? {
          tone: "amber",
          title: "Not started yet",
          text: stats.enrolled ? "Check the emails below, then start sending. Nothing goes out until you do." : "Add the people below and check what they'll receive, then start sending.",
        }
      : seq.status === "paused"
        ? { tone: "neutral", title: "Paused", text: "No emails go out until you resume. Replies are still detected." }
        : working.length === 0
          ? {
              tone: "red",
              title: pool.mailboxes.length === 1 ? "Stopped: the mailbox lost access" : "Stopped: every mailbox lost access",
              text: "Reconnect in Connections and sending picks up where it left off.",
            }
          : waiting.length > 0
            ? null
            : stats.remaining === 0
              ? {
                  tone: "neutral",
                  title: "Nothing left to send",
                  text: stats.enrolled ? "Everyone has replied, finished or stopped. Add more people to keep going." : "No one is in it yet. Add the people from the table below.",
                }
              : {
                  tone: "neutral",
                  title: `Sending to ${stats.remaining} ${stats.remaining === 1 ? "person" : "people"}`,
                  text: nextSend ? `Next email around ${formatSendTime(nextSend)}. Anyone who replies stops getting emails.` : "Anyone who replies stops getting emails.",
                };
  const bannerTone = { amber: "border-[#f3e2a6] bg-ws-acc-soft", neutral: "border-lk-line bg-ws-head", red: "border-[#f3c9c9] bg-ws-red-soft" };

  const pct = (n: number) => (stats.enrolled ? `${Math.round((n / stats.enrolled) * 100)}%` : "");
  const results: { label: string; value: number; rate?: string; good?: boolean }[] = [
    { label: "People", value: stats.enrolled },
    { label: "Emails sent", value: stats.emailsSent },
    { label: "Replied", value: stats.states.replied ?? 0, rate: pct(stats.states.replied ?? 0), good: true },
    { label: "Finished, no reply", value: stats.states.completed ?? 0, rate: pct(stats.states.completed ?? 0) },
    { label: "Bounced", value: stats.states.bounced ?? 0, rate: pct(stats.states.bounced ?? 0) },
    { label: "Unsubscribed", value: stats.states.unsubscribed ?? 0, rate: pct(stats.states.unsubscribed ?? 0) },
  ];
  const firstSent = Math.max(1, ...stats.steps.map((x) => x.sent));
  const multiple = pool.mailboxes.length > 1;

  return (
    <Page>
      <PageHeader
        eyebrow={
          <span className={crumb}>
            <Link href="/app/sequences" className="hover:text-lk-fg">
              Sequences
            </Link>{" "}
            ›
          </span>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {seq.name}
            <Pill tone={statusTone[seq.status] ?? "neutral"}>{seq.status === "active" ? "sending" : seq.status}</Pill>
          </span>
        }
        meta={
          <span>
            {pool.mailboxes.length === 1 ? pool.mailboxes[0]!.email : `${pool.mailboxes.length} mailboxes`} · up to {pool.capacityToday} emails today · weekdays{" "}
            {seq.windowStartHour}:00–{seq.windowEndHour}:00 {seq.timezone.replace(/_/g, " ")} · people from{" "}
            <Link href={`/app/leads/${table.id}`} className="text-lk-fg underline decoration-lk-gray underline-offset-4 hover:decoration-lk-fg">
              {table.name}
            </Link>
          </span>
        }
        actions={
          <>
            <SequenceToggle id={id} status={seq.status} />
            {seq.status !== "active" && <DeleteSequence sequenceId={id} name={seq.name} />}
          </>
        }
      />

      {banner && (
        <p className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-4 py-2.5 text-[13px] ${bannerTone[banner.tone]}`} role={banner.tone === "red" ? "alert" : "status"}>
          <span className={`font-semibold ${banner.tone === "red" ? "text-ws-red" : "text-lk-fg"}`}>{banner.title}</span>
          <span className="text-lk-muted">{banner.text}</span>
        </p>
      )}

      {seq.status !== "draft" && waiting.length > 0 && <PendingEmails sequenceId={id} emails={waiting.slice(0, 20)} total={waiting.length} />}

      <section className="grid grid-cols-2 overflow-hidden rounded-lg border border-lk-line bg-lk-line [gap:1px] sm:grid-cols-3 xl:grid-cols-6">
        {results.map((r) => (
          <div key={r.label} className="flex flex-col gap-2.5 bg-white px-[18px] py-4">
            <span className={monoLabel}>{r.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-[28px] leading-none font-bold tracking-[-0.6px] text-lk-fg">{r.value.toLocaleString("en")}</span>
              {r.rate && <span className={`font-mono text-[11px] ${r.good && r.value ? "font-semibold text-ws-green" : "text-lk-dim"}`}>{r.rate}</span>}
            </span>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHead
              title={
                <>
                  Emails <span className="font-mono text-[11px] font-normal text-lk-dim">{seq.steps.length} · in one thread, stop on reply</span>
                </>
              }
            />
            {seq.steps.map((s, i) => {
              const result = stats.steps.find((x) => x.position === s.position);
              const sent = result?.sent ?? 0;
              return (
                <div key={s.position} className="grid gap-x-8 gap-y-3 border-b border-lk-line px-4 py-3.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <Pill tone="blue">Email {i + 1}</Pill>
                      <span className="font-mono text-[11px] text-lk-dim">{i === 0 ? "sent first" : `no reply? ${days(s.delayDays)}, same thread`}</span>
                    </span>
                    <span className="text-[13px] font-semibold text-lk-fg">{s.subject ?? summaryLine(s.body)}</span>
                    {s.subject && <span className="line-clamp-2 text-[13px] text-lk-muted">{summaryLine(s.body)}</span>}
                  </span>
                  <span className="flex flex-col gap-1.5 self-center">
                    <span className="flex items-center justify-between">
                      <span className={monoLabel}>Sent</span>
                      <span className="font-mono text-[12px] text-lk-fg">{sent.toLocaleString("en")}</span>
                    </span>
                    <span className="h-1 overflow-hidden rounded-full bg-ws-soft">
                      <span className="block h-full rounded-full bg-lk-gray" style={{ width: `${(sent / firstSent) * 100}%` }} />
                    </span>
                    <span className="flex items-center justify-between">
                      <span className={monoLabel}>Replied after</span>
                      <span className={`font-mono text-[12px] ${result?.repliedAfter ? "font-semibold text-ws-green" : "text-lk-dim"}`}>{result?.repliedAfter ?? 0}</span>
                    </span>
                  </span>
                </div>
              );
            })}
          </Card>

          <Card>
            <CardHead
              title={
                <>
                  People <span className="font-mono text-[11px] font-normal text-lk-dim">{recipients.length.toLocaleString("en")}</span>
                </>
              }
            >
              <EnrollButton sequenceId={id} tableName={table.name} />
            </CardHead>
            {recipients.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-lk-muted">
                Nobody yet. Add everyone from {table.name} who has an email, or ask your agent to “enroll the verified leads from {table.name}”. Nothing sends until
                you start.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr className="border-b border-lk-line">
                      <th className={th}>Person</th>
                      <th className={th}>Status</th>
                      <th className={th}>Emails</th>
                      {multiple && <th className={th}>From</th>}
                      <th className={`${th} !text-right`}>Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => {
                      const status = personStatus(r, seq.steps.length, seq.status === "active");
                      const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
                      const sub = [name ? r.email : "", r.company ?? ""].filter(Boolean).join(" · ");
                      return (
                        <tr key={r.enrollmentId} className="border-b border-lk-line last:border-0">
                          <td className={`${td} py-2.5`}>
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium text-lk-fg">{name || r.email}</span>
                              {sub && <span className="text-[12px] text-lk-dim">{sub}</span>}
                            </span>
                          </td>
                          <td className={`${td} py-2.5`}>
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <Pill tone={status.tone}>{status.text}</Pill>
                              {status.detail && <span className="text-[12px] text-lk-dim">{status.detail}</span>}
                            </span>
                          </td>
                          <td className={`${td} py-2.5 font-mono text-[12px] whitespace-nowrap`}>
                            {r.stepsSent} / {seq.steps.length}
                          </td>
                          {multiple && <td className={`${td} py-2.5 font-mono text-[11.5px] text-lk-muted`}>{r.mailboxEmail ?? "—"}</td>}
                          <td className={`${td} py-2.5 text-right font-mono text-[12px] whitespace-nowrap text-lk-muted`}>{r.lastSentAt ? formatWhen(r.lastSentAt) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <MailboxPoolCard
            sequenceId={id}
            pool={pool}
            domains={domains}
            mailboxes={mailboxes}
            nextSend={seq.status === "active" && next ? { at: formatSendTime(next.nextSendAt!), from: next.mailboxEmail ?? undefined } : undefined}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className={monoLabel}>What they receive</span>
              {preview && <span className="truncate font-mono text-[11px] text-lk-muted">{preview.to ?? "a person without an email"}</span>}
            </div>
            {!preview ? (
              <Card>
                <p className="p-4 text-[13px] text-lk-muted">Add people to {table.name} to see what they’ll receive.</p>
              </Card>
            ) : (
              <>
                <Card>
                  {preview.steps.map((s) => (
                    <article key={s.position} className="flex flex-col gap-2.5 border-b border-lk-line px-4 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className={monoLabel}>Email {s.position + 1}</span>
                        {s.position > 0 && <span className="font-mono text-[10.5px] text-lk-dim">{days(s.delayDays)}, if no reply</span>}
                      </div>
                      <p className="text-[13px] font-semibold text-lk-fg">{s.subject}</p>
                      <p className="text-[13px] leading-relaxed whitespace-pre-line text-lk-fg">{s.body}</p>
                    </article>
                  ))}
                  <p className="bg-ws-head px-4 py-2.5 font-mono text-[10.5px] text-lk-dim">Every email ends with a one-click unsubscribe link.</p>
                </Card>
                {preview.missingVars.length === 0 ? (
                  <span className="flex items-center gap-2 text-[13px] text-ws-green">
                    <CircleCheck className="size-4" />
                    Every placeholder filled in
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-[13px] text-ws-red">
                    <TriangleAlert className="size-4" />
                    Missing {preview.missingVars.join(", ")}, so this person is skipped
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
