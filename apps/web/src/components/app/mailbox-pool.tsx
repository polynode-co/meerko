"use client";

import { Check, Globe, Mail, Settings2, TriangleAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { DomainHealth, Mailbox, MailboxAssignment, SequencePool } from "@meerko/sdk";
import { updatePool } from "@/app/app/actions";
import { buttonClass, Card, CardHead, monoLabel, Pill, th } from "@/components/app/ui";

const domainOf = (email: string) => email.split("@")[1]!;

function StatusPill({ status, rampDay, held }: { status: "active" | "error"; rampDay: number | null; held?: boolean }) {
  if (status === "error") return <Pill tone="red">reconnect</Pill>;
  if (held) return <Pill tone="red">paused · see Settings</Pill>;
  if (rampDay) return <Pill tone="amber">ramping · {rampDay}/21</Pill>;
  return <Pill tone="signal">ready</Pill>;
}

/** The provider's mark, in the provider's colour: Gmail red, Outlook blue, anything else neutral. */
function MailIcon({ provider }: { provider?: Mailbox["provider"] }) {
  const tone = provider === "gmail" || provider === "gmail_imap" ? "bg-ws-red-soft text-ws-red" : provider === "outlook" ? "bg-ws-blue-soft text-ws-blue" : "bg-ws-soft text-lk-muted";
  return (
    <span className={`grid size-[18px] shrink-0 place-items-center rounded ${tone}`}>
      <Mail className="size-[11px]" />
    </span>
  );
}

function DomainChecks({ d }: { d: DomainHealth }) {
  if (d.spf === "managed") return <span className="text-[12px] text-lk-dim">Gmail address: Google handles SPF, DKIM and DMARC</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {(["spf", "dkim", "dmarc"] as const).map((k) => {
        const ok = d[k] === "pass";
        return (
          <Pill key={k} tone={ok ? "signal" : "red"}>
            {ok ? <Check className="size-3" /> : <X className="size-3" />}
            {k.toUpperCase()}
          </Pill>
        );
      })}
    </span>
  );
}

/** "SPF", "SPF and DMARC", "SPF, DKIM and DMARC" (with `or` for the last joiner if asked). */
const listOf = (items: string[], last = "and") => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${last} ${items.at(-1)}`);

const missingOf = (d: DomainHealth) => (["spf", "dkim", "dmarc"] as const).filter((k) => d[k] === "missing").map((k) => k.toUpperCase());

/** "Sending from": the sequence's mailbox pool, today's sending, and its domains' health. */
export function MailboxPoolCard({
  sequenceId,
  pool,
  domains,
  mailboxes,
  nextSend,
}: {
  sequenceId: string;
  pool: SequencePool;
  domains: DomainHealth[];
  mailboxes: Mailbox[];
  nextSend?: { at: string; from?: string };
}) {
  const [editing, setEditing] = useState(false);
  const poolDomains = domains.filter((d) => pool.mailboxes.some((m) => domainOf(m.email) === d.domain));
  const total = Math.max(pool.capacityToday, 1);
  const providerOf = (id: string) => mailboxes.find((m) => m.id === id)?.provider;
  const assignmentText =
    (pool.assignment === "even" ? "New leads are split evenly across the mailboxes." : "New leads go to the mailbox with the most room today.") +
    " Follow-ups always come from the lead's mailbox, in the same thread. If a mailbox needs reconnecting, its leads wait; the others keep sending.";
  return (
    <Card>
      <CardHead
        title={
          <>
            Sending from
            {pool.mailboxes.length > 1 && (
              <span title={assignmentText}>
                <Pill>rotation on</Pill>
              </span>
            )}
          </>
        }
      >
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "sm")}>
          <Settings2 /> Edit pool
        </button>
      </CardHead>

      <div className="flex flex-col gap-3 border-b border-lk-line px-4 py-3.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="font-display text-[26px] leading-none font-bold tracking-[-0.6px] text-lk-fg">{pool.sentToday}</span>
            <span className="text-[13px] text-lk-muted">of {pool.capacityToday} today</span>
          </span>
          {nextSend && (
            <span className="font-mono text-[11px] text-lk-muted">
              next {nextSend.at}
              {nextSend.from ? ` · ${nextSend.from}` : ""}
            </span>
          )}
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-ws-soft">
          {pool.mailboxes.map((m, i) => (
            <span
              key={m.id}
              style={{ width: `${(m.sentToday / total) * 100}%`, opacity: m.status === "error" ? 1 : Math.max(0.3, 1 - i * 0.35) }}
              className={m.status === "error" ? "bg-ws-red" : "bg-lk-fg"}
            />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-left">
          <thead>
            <tr className="border-b border-lk-line">
              <th className={th}>Mailbox</th>
              <th className={th}>Status</th>
              <th className={`${th} !text-right`}>Today</th>
              <th className={`${th} !text-right`}>Leads</th>
            </tr>
          </thead>
          <tbody>
            {pool.mailboxes.map((m) => (
              <tr key={m.id} className="border-b border-lk-line last:border-0">
                <td className="px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <MailIcon provider={providerOf(m.id)} />
                    <span className="truncate font-mono text-[12px] text-lk-fg">{m.email}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={m.status} rampDay={m.rampDay} held={m.held} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-[12px] whitespace-nowrap text-lk-fg">
                  {m.sentToday} / {m.effectiveLimit}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[12px] text-lk-fg">{m.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {poolDomains.map((d) => (
        <div key={d.domain} className="flex flex-wrap items-center gap-3 border-t border-lk-line bg-ws-head px-4 py-2.5">
          <span className={monoLabel}>Domain</span>
          <span className="flex-1 font-mono text-[12px] text-lk-fg">{d.domain}</span>
          <DomainChecks d={d} />
          {missingOf(d).length > 0 && (
            <a href="/guides/email-deliverability" className="text-[12.5px] font-semibold text-ws-red hover:underline">
              Add {listOf(missingOf(d))} →
            </a>
          )}
        </div>
      ))}

      {editing && <EditPoolModal sequenceId={sequenceId} pool={pool} mailboxes={mailboxes} domains={domains} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function EditPoolModal({
  sequenceId,
  pool,
  mailboxes,
  domains,
  onClose,
}: {
  sequenceId: string;
  pool: SequencePool;
  mailboxes: Mailbox[];
  domains: DomainHealth[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(new Set(pool.mailboxes.map((m) => m.id)));
  const [assignment, setAssignment] = useState<MailboxAssignment>(pool.assignment);
  const [error, setError] = useState<string>();
  const [saving, start] = useTransition();

  const byDomain = Object.entries(
    mailboxes.reduce<Record<string, Mailbox[]>>((acc, m) => ((acc[domainOf(m.email)] ??= []).push(m), acc), {}),
  );
  const chosen = mailboxes.filter((m) => selected.has(m.id));
  const capacity = chosen.filter((m) => m.status === "active").reduce((n, m) => n + m.effectiveLimit, 0);
  const badDomains = domains.filter((d) => chosen.some((m) => domainOf(m.email) === d.domain) && missingOf(d).length > 0);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div role="dialog" aria-modal aria-label="Mailbox pool" className="fixed inset-0 z-50 grid place-items-center bg-[rgba(22,22,26,0.35)] p-4" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-lk-line bg-white shadow-[0_12px_40px_rgba(22,22,26,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-lk-line px-5 py-4">
          <p className="text-[15px] font-semibold text-lk-fg">Mailbox pool</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-lk-dim transition hover:bg-lk-frame hover:text-lk-fg">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-5 py-4">
          <p className="text-[13px] text-lk-muted">This sequence sends from every mailbox you tick.</p>
          {byDomain.map(([domain, list]) => (
            <div key={domain} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 font-mono text-[11px] text-lk-muted">
                <Globe className="size-3.5" /> {domain}
              </p>
              <div className="overflow-hidden rounded-md border border-lk-line">
                {list.map((m) => {
                  const on = selected.has(m.id);
                  return (
                    <label key={m.id} className={`flex cursor-pointer items-center gap-2.5 border-lk-line px-3 py-2.5 transition [&:not(:first-child)]:border-t ${on ? "bg-lk-frame" : "hover:bg-lk-frame"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(m.id)} className="size-4 accent-lk-fg" />
                      <MailIcon provider={m.provider} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-lk-fg">{m.email}</span>
                      <span className="hidden font-mono text-[11px] text-lk-dim sm:inline">
                        {m.rampDay ? `${m.effectiveLimit}/day → ${m.dailyLimit}` : `${m.dailyLimit}/day`}
                      </span>
                      <StatusPill status={m.status} rampDay={m.rampDay} held={m.heldAt !== null} />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-1">
            <p className={monoLabel}>Assign new leads</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-ws-soft p-1">
              {(
                [
                  ["capacity", "Most room today", "Fills the emptiest mailbox first"],
                  ["even", "Even split", "Same number of leads each"],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAssignment(value)}
                  aria-pressed={assignment === value}
                  className={`flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition ${assignment === value ? "border-lk-line bg-white shadow-[0_1px_2px_rgba(22,22,26,0.06)]" : "border-transparent hover:bg-white/60"}`}
                >
                  <span className={`text-[13px] font-semibold ${assignment === value ? "text-lk-fg" : "text-lk-muted"}`}>{title}</span>
                  <span className="text-[12px] text-lk-dim">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {badDomains.map((d) => (
            <p key={d.domain} className="flex items-center gap-2.5 rounded-md border border-[#f3c9c9] bg-ws-red-soft px-3 py-2.5 text-[13px] text-ws-red">
              <TriangleAlert className="size-4 shrink-0" />
              <span className="flex-1">
                {d.domain} has no {listOf(missingOf(d), "or")} record, so Gmail may send its mail to spam.
              </span>
              <a href="/guides/email-deliverability" className="font-semibold whitespace-nowrap hover:underline">
                Fix it →
              </a>
            </p>
          ))}
          {error && (
            <p role="alert" className="text-[13px] text-ws-red">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lk-line bg-ws-head px-5 py-3.5">
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-lk-fg">
              {chosen.length} {chosen.length === 1 ? "mailbox" : "mailboxes"} · up to {capacity} emails today
            </span>
            <span className="text-[12px] text-lk-dim">Leads already emailed keep their mailbox.</span>
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={onClose} className={buttonClass()}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || chosen.length === 0}
              onClick={() =>
                start(async () => {
                  const res = await updatePool(sequenceId, [...selected], assignment);
                  if (res.ok) onClose();
                  else setError(res.error);
                })
              }
              className={buttonClass("primary")}
            >
              {saving ? "Saving…" : "Save pool"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
