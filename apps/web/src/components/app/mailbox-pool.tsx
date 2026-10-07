"use client";

import { Check, GitBranch, Globe, Repeat, Settings2, Timer, TriangleAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { DomainHealth, Mailbox, MailboxAssignment, SequencePool } from "@meerko/sdk";
import { updatePool } from "@/app/app/actions";
import { buttonClass, Card } from "@/components/app/ui";

const RED = "#e5795b";
const domainOf = (email: string) => email.split("@")[1]!;

function StatusPill({ status, rampDay }: { status: "active" | "error"; rampDay: number | null }) {
  const [text, cls] =
    status === "error"
      ? ["Reconnect", "bg-[#e5795b]/12 text-[#e5795b]"]
      : rampDay
        ? [`Ramping · day ${rampDay}/21`, "bg-accent-soft text-accent"]
        : ["Ready", "bg-signal/12 text-signal"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

function DomainChecks({ d }: { d: DomainHealth }) {
  if (d.spf === "managed") return <span className="text-xs text-muted">Gmail address: Google handles SPF, DKIM and DMARC</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {(["spf", "dkim", "dmarc"] as const).map((k) => {
        const ok = d[k] === "pass";
        return (
          <span key={k} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] ${ok ? "bg-signal/10 text-signal" : "bg-[#e5795b]/10 text-[#e5795b]"}`}>
            {ok ? <Check className="size-3" /> : <X className="size-3" />}
            {k.toUpperCase()}
          </span>
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
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Repeat className="size-4 text-accent" />
          <h2 className="text-[15px] font-semibold">Sending from</h2>
          {pool.mailboxes.length > 1 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent">Rotation on</span>}
        </div>
        <button type="button" onClick={() => setEditing(true)} className={buttonClass()}>
          <Settings2 className="size-3.5" /> Edit pool
        </button>
      </div>

      <div className="flex flex-col gap-2.5 border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <span className="flex items-end gap-2">
            <span className="font-display text-[28px] leading-none font-bold">{pool.sentToday}</span>
            <span className="text-[13px] text-muted">of {pool.capacityToday} sends today</span>
          </span>
          {nextSend && (
            <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
              <Timer className="size-3.5" /> Next send {nextSend.at}
              {nextSend.from ? ` · ${nextSend.from}` : ""}
            </span>
          )}
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-ink">
          {pool.mailboxes.map((m, i) => (
            <span
              key={m.id}
              style={{ width: `${(m.sentToday / total) * 100}%`, opacity: m.status === "error" ? 1 : 1 - i * 0.2 }}
              className={m.status === "error" ? "bg-[#e5795b]/60" : "bg-accent"}
            />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="bg-ink font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">
            <tr>
              <th className="px-5 py-2.5 font-normal">Mailbox</th>
              <th className="px-3 py-2.5 font-normal">Status</th>
              <th className="px-3 py-2.5 font-normal">Today</th>
              <th className="px-5 py-2.5 text-right font-normal">Leads</th>
            </tr>
          </thead>
          <tbody>
            {pool.mailboxes.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <span className="flex flex-col">
                    <span className="font-mono text-[13px]">{m.email}</span>
                    <span className="text-[11px] text-muted">{domainOf(m.email)}</span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={m.status} rampDay={m.rampDay} />
                </td>
                <td className="w-[180px] px-3 py-3">
                  <span className="flex flex-col gap-1.5">
                    <span className="font-mono text-xs">
                      {m.sentToday} / {m.effectiveLimit}
                    </span>
                    <span className="h-1 overflow-hidden rounded-full bg-ink">
                      <span
                        className={`block h-full ${m.status === "error" ? "bg-[#e5795b]" : "bg-accent"}`}
                        style={{ width: `${Math.min(100, (m.sentToday / Math.max(m.effectiveLimit, 1)) * 100)}%` }}
                      />
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono">{m.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex gap-3 border-t border-line px-5 py-3.5 text-[12.5px] leading-normal text-muted">
        <GitBranch className="mt-0.5 size-4 shrink-0 text-accent" />
        {pool.assignment === "even" ? "New leads are split evenly across the mailboxes." : "New leads go to the mailbox with the most room today."} Follow-ups
        always come from the lead&apos;s mailbox, in the same thread. If a mailbox needs reconnecting, its leads wait; the others keep sending.
      </p>

      {poolDomains.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line px-5 py-4">
          <p className="font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">Domain health</p>
          {poolDomains.map((d) => (
            <div key={d.domain} className="flex flex-wrap items-center gap-3">
              <span className="w-[170px] font-mono text-[12.5px]">{d.domain}</span>
              <DomainChecks d={d} />
              {missingOf(d).length > 0 && (
                <a href="/guides/email-deliverability" className="text-xs font-semibold text-accent hover:underline">
                  Add {listOf(missingOf(d))} →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditPoolModal sequenceId={sequenceId} pool={pool} mailboxes={mailboxes} domains={domains} onClose={() => setEditing(false)} />
      )}
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
    <div role="dialog" aria-modal aria-label="Mailbox pool" className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex flex-col gap-1">
            <p className="font-display text-[22px] font-bold">Mailbox pool</p>
            <p className="text-[13.5px] text-muted">This sequence sends from every mailbox you tick.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-fg">
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-4">
          {byDomain.map(([domain, list]) => (
            <div key={domain} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 font-mono text-[11.5px] text-muted">
                <Globe className="size-3.5" /> {domain}
              </p>
              <div className="overflow-hidden rounded-[10px] border border-line">
                {list.map((m) => {
                  const on = selected.has(m.id);
                  return (
                    <label key={m.id} className={`flex cursor-pointer items-center gap-3 border-line px-3.5 py-2.5 [&:not(:first-child)]:border-t ${on ? "bg-accent/5" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(m.id)} className="size-4 accent-[#f2a93b]" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{m.email}</span>
                      <span className="font-mono text-xs text-muted">
                        {m.rampDay ? `${m.effectiveLimit}/day → ${m.dailyLimit}` : `${m.dailyLimit}/day`}
                      </span>
                      <StatusPill status={m.status} rampDay={m.rampDay} />
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2 pt-1">
            <p className="font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">Assign new leads</p>
            <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-ink p-1">
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
                  className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left ${assignment === value ? "border-accent/35 bg-raised" : "border-transparent"}`}
                >
                  <span className={`text-[13.5px] font-semibold ${assignment === value ? "text-accent" : ""}`}>{title}</span>
                  <span className="text-xs text-muted">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {badDomains.map((d) => (
            <p key={d.domain} className="flex items-center gap-2.5 rounded-[10px] border border-[#e5795b]/25 bg-[#e5795b]/8 px-3 py-2.5 text-[13px]">
              <TriangleAlert className="size-4 shrink-0" style={{ color: RED }} />
              <span className="flex-1">
                {d.domain} has no {listOf(missingOf(d), "or")} record, so Gmail may send its mail to spam.
              </span>
              <a href="/guides/email-deliverability" className="font-semibold text-accent hover:underline">
                Fix it
              </a>
            </p>
          ))}
          {error && (
            <p role="alert" className="text-[13px]" style={{ color: RED }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ink px-6 py-4">
          <span className="flex flex-col">
            <span className="text-sm font-semibold">
              {chosen.length} {chosen.length === 1 ? "mailbox" : "mailboxes"} · up to {capacity} emails today
            </span>
            <span className="text-xs text-muted">Leads already emailed keep their mailbox.</span>
          </span>
          <span className="flex gap-2.5">
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
