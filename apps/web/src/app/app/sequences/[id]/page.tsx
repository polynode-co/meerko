import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { MeerkoApiError } from "@meerko/sdk";
import { EnrollButton } from "@/components/app/enroll-button";
import { MailboxPoolCard } from "@/components/app/mailbox-pool";
import { PendingEmails } from "@/components/app/pending-emails";
import { SequenceToggle } from "@/components/app/sequence-toggle";
import { Card, CardHead, formatWhen, monoLabel, Page, PageHeader, PaperWindow, Pill, td, th, type PillTone } from "@/components/app/ui";
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
      return { text: "Replied", tone: "solid", detail: "emails stopped · see Inbox" };
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

  // One sentence on what is happening right now, and what (if anything) the user should do.
  const banner =
    seq.status === "draft"
      ? {
          tone: "outline-lk-lime/50 bg-lk-lime/[0.07]",
          title: "Not started yet",
          text: stats.enrolled
            ? "Check the emails below, then start sending. Nothing goes out until you do."
            : "Add the people below and check what they'll receive, then start sending. Nothing goes out until you do.",
        }
      : seq.status === "paused"
        ? { tone: "outline-lk-line bg-lk-box", title: "Paused", text: "No emails go out until you resume. People who reply are still detected." }
        : working.length === 0
          ? {
              tone: "outline-[#e5795b]/60 bg-[#e5795b]/10",
              title: pool.mailboxes.length === 1 ? "Stopped: the mailbox lost access" : "Stopped: every mailbox lost access",
              text: "Reconnect them in Connections and sending picks up where it left off.",
            }
          : seq.status === "active" && waiting.length > 0
            ? {
                tone: "outline-lk-lime/50 bg-lk-lime/[0.07]",
                title: `${waiting.length >= 200 ? "200+" : waiting.length} ${waiting.length === 1 ? "email waits" : "emails wait"} for your approval`,
                text: "Read them below and approve. Each goes when it's due, inside the send window. Choose automatic sending in Connections.",
              }
          : stats.remaining === 0
            ? {
                tone: "outline-lk-line bg-lk-box",
                title: "Nothing left to send",
                text: stats.enrolled ? "Everyone has replied, finished or stopped. Add more people to keep going." : "No one is in it yet. Add the people from the table below.",
              }
            : {
                tone: "outline-lk-lime/50 bg-lk-lime/[0.07]",
                title: `Sending to ${stats.remaining} ${stats.remaining === 1 ? "person" : "people"}`,
                text: nextSend ? `Next email around ${formatSendTime(nextSend)}. Anyone who replies stops getting emails automatically.` : "Anyone who replies stops getting emails automatically.",
              };

  const pct = (n: number) => (stats.enrolled ? `${Math.round((n / stats.enrolled) * 100)}%` : "");
  const results: { label: string; value: number; hint: string; rate?: string; tone?: string }[] = [
    { label: "People", value: stats.enrolled, hint: "enrolled in this sequence" },
    { label: "Emails sent", value: stats.emailsSent, hint: "across all steps" },
    { label: "Replied", value: stats.states.replied ?? 0, rate: pct(stats.states.replied ?? 0), tone: "text-lk-lime", hint: "their emails stop automatically" },
    { label: "Finished, no reply", value: stats.states.completed ?? 0, rate: pct(stats.states.completed ?? 0), hint: "got every email" },
    { label: "Bounced", value: stats.states.bounced ?? 0, rate: pct(stats.states.bounced ?? 0), hint: "address doesn't exist" },
    { label: "Unsubscribed", value: stats.states.unsubscribed ?? 0, rate: pct(stats.states.unsubscribed ?? 0), hint: "asked not to be emailed" },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow={`Sequences / ${seq.name}`}
        title={seq.name}
        meta={
          <span>
            Sends from{" "}
            <span className="text-lk-fg">{pool.mailboxes.length === 1 ? pool.mailboxes[0]!.email : `${pool.mailboxes.length} mailboxes`}</span> · up to{" "}
            {pool.capacityToday} emails today · weekdays {seq.windowStartHour}:00–{seq.windowEndHour}:00 ({seq.timezone.replace(/_/g, " ")} time) · people from{" "}
            <Link href={`/app/leads/${table.id}`} className="text-lk-fg underline decoration-lk-gray underline-offset-4 hover:decoration-lk-lime">
              {table.name}
            </Link>
          </span>
        }
      />

      <section className={`flex flex-wrap items-center justify-between gap-4 px-[18px] py-4 outline outline-1 -outline-offset-1 ${banner.tone}`}>
        <div className="flex flex-col gap-1">
          <p className="font-pixel text-[14px] text-lk-fg uppercase">{banner.title}</p>
          <p className="text-[15px] text-lk-muted">{banner.text}</p>
        </div>
        <SequenceToggle id={id} status={seq.status} />
      </section>

      {seq.status !== "draft" && waiting.length > 0 && <PendingEmails sequenceId={id} emails={waiting.slice(0, 20)} total={waiting.length} />}

      <div className="grid grid-cols-2 gap-px border border-lk-line bg-lk-line sm:grid-cols-3 xl:grid-cols-6">
        {results.map((r) => (
          <div key={r.label} className="flex flex-col gap-2 bg-lk-box px-[18px] py-4">
            <span className={monoLabel}>{r.label}</span>
            <span className="flex items-end gap-2">
              <span className={`text-[28px] leading-none font-semibold tracking-[-1px] ${r.tone ?? "text-lk-fg"}`}>{r.value}</span>
              {r.rate && <span className="font-plex text-[13px] text-lk-dim">{r.rate}</span>}
            </span>
            <span className="text-[14px] leading-snug text-lk-dim">{r.hint}</span>
          </div>
        ))}
      </div>

      <MailboxPoolCard
        sequenceId={id}
        pool={pool}
        domains={domains}
        mailboxes={mailboxes}
        nextSend={seq.status === "active" && next ? { at: formatSendTime(next.nextSendAt!), from: next.mailboxEmail ?? undefined } : undefined}
      />

      <Card>
        <CardHead title="People · who is in this sequence and what happens next">
          <EnrollButton sequenceId={id} tableName={table.name} />
        </CardHead>
        {recipients.length === 0 ? (
          <p className="px-[18px] py-6 text-[15px] text-lk-muted">
            Nobody yet. Add everyone from {table.name} who has an email, or ask your agent to “enroll the verified leads from {table.name}”.
            Nothing is sent until you start the sequence.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[15px]">
              <thead className="bg-lk-ink">
                <tr className="border-b border-lk-line">
                  <th className={th}>Person</th>
                  <th className={th}>Status</th>
                  <th className={th}>Emails received</th>
                  {pool.mailboxes.length > 1 && <th className={th}>From</th>}
                  <th className={`${th} !text-right`}>Last email</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const status = personStatus(r, seq.steps.length, seq.status === "active");
                  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={r.enrollmentId} className="border-b border-lk-line last:border-0">
                      <td className={td}>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-lk-fg">{name || r.email}</span>
                          <span className="font-plex text-[12.5px] text-lk-dim">{name ? r.email : ""}{r.company ? `${name ? " · " : ""}${r.company}` : ""}</span>
                        </span>
                      </td>
                      <td className={td}>
                        <span className="flex flex-wrap items-center gap-2">
                          <Pill tone={status.tone}>{status.text}</Pill>
                          {status.detail && <span className="text-[14px] text-lk-dim">{status.detail}</span>}
                        </span>
                      </td>
                      <td className={td}>
                        {r.stepsSent} / {seq.steps.length}
                      </td>
                      {pool.mailboxes.length > 1 && <td className={td}>{r.mailboxEmail ?? "—"}</td>}
                      <td className={`${td} text-right`}>{r.lastSentAt ? formatWhen(r.lastSentAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <Card>
          <CardHead title="The emails · sent in this order until they reply" />
          {seq.steps.map((s, i) => {
            const result = stats.steps.find((x) => x.position === s.position);
            return (
              <div key={s.position} className="flex flex-col gap-2 border-b border-lk-line px-[18px] py-4 last:border-0">
                <span className="flex flex-wrap items-center gap-3">
                  <Pill tone="signal">Email {i + 1}</Pill>
                  <span className="font-plex text-[12.5px] tracking-[0.4px] text-lk-dim">
                    {i === 0 ? "sent first" : `no reply? ${days(s.delayDays)}, in the same thread`}
                  </span>
                </span>
                <span className="text-[15.5px] font-semibold text-lk-fg">{s.subject ?? summaryLine(s.body)}</span>
                {s.subject && <span className="line-clamp-1 text-[15px] text-lk-dim">{summaryLine(s.body)}</span>}
                <span className="font-plex text-[12.5px] tracking-[0.4px] text-lk-dim">
                  {result?.sent ?? 0} sent · <span className={result?.repliedAfter ? "text-lk-lime" : ""}>{result?.repliedAfter ?? 0} replied after this one</span>
                </span>
              </div>
            );
          })}
        </Card>

        <div className="flex flex-col gap-3 pr-2.5 pb-2.5">
          <span className={monoLabel}>What they receive{preview ? ` · shown for ${preview.to ?? "a person without an email"}` : ""}</span>
          {!preview ? (
            <Card>
              <p className="p-[18px] text-[15px] text-lk-muted">Add people to {table.name} to see what they’ll receive.</p>
            </Card>
          ) : (
            <>
              <PaperWindow title={`To ${preview.to ?? "a person without an email"}`} bodyClassName="flex flex-col">
                {preview.steps.map((s) => (
                  <article key={s.position} className="flex flex-col gap-3 border-b border-lk-ink/25 px-[18px] py-4 last:border-0">
                    <div className="flex items-center justify-between gap-3 font-plex text-[12.5px] text-lk-gray uppercase">
                      <span>Email {s.position + 1}</span>
                      {s.position > 0 && <span>{days(s.delayDays)}, if no reply</span>}
                    </div>
                    <p className="font-plex text-[13.5px] text-lk-ink">
                      <span className="text-lk-gray">Subject: </span>
                      <span className="font-semibold">{s.subject}</span>
                    </p>
                    <p className="text-[15px] leading-relaxed whitespace-pre-line text-lk-ink">{s.body}</p>
                  </article>
                ))}
                <p className="px-[18px] pb-4 font-plex text-[12.5px] text-lk-gray">— Every email ends with a one-click unsubscribe link.</p>
              </PaperWindow>
              {preview.missingVars.length === 0 ? (
                <span className="flex items-center gap-2 pt-2 text-[15px] text-lk-lime">
                  <CircleCheck className="size-4" />
                  Every placeholder is filled in
                </span>
              ) : (
                <span className="flex items-center gap-2 pt-2 text-[15px] text-[#e5795b]">
                  <TriangleAlert className="size-4" />
                  Missing {preview.missingVars.join(", ")}, so this person is skipped
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
