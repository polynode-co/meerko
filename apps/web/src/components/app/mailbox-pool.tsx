"use client";

import { Check, GitBranch, Globe, Settings2, Timer, TriangleAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import type { DomainHealth, Mailbox, MailboxAssignment, SequencePool } from "@meerko/sdk";
import { updatePool } from "@/app/app/actions";
import { buttonClass, Card, CardHead, monoLabel, th } from "@/components/app/ui";

const RED = "#e5795b";
const domainOf = (email: string) => email.split("@")[1]!;

function StatusPill({ status, rampDay }: { status: "active" | "error"; rampDay: number | null }) {
  const [text, cls] =
    status === "error"
      ? ["Reconnect", "text-[#e5795b] outline-[#e5795b]/60"]
      : rampDay
        ? [`Ramping · day ${rampDay}/21`, "text-lk-fg outline-lk-muted"]
        : ["Ready", "bg-lk-ink text-lk-lime outline-lk-line"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] font-plex text-[12px] tracking-[0.6px] whitespace-nowrap uppercase outline outline-1 -outline-offset-1 ${cls}`}>
      <span className="size-1.5 bg-current" />
      {text}
    </span>
  );
}

function DomainChecks({ d }: { d: DomainHealth }) {
  if (d.spf === "managed") return <span className="text-sm text-lk-dim">Gmail address: Google handles SPF, DKIM and DMARC</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {(["spf", "dkim", "dmarc"] as const).map((k) => {
        const ok = d[k] === "pass";
        return (
          <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 font-plex text-[12px] ${ok ? "bg-lk-lime/10 text-lk-lime" : "bg-[#e5795b]/10 text-[#e5795b]"}`}>
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
      <CardHead
        title={
          <span className="flex flex-wrap items-center gap-3">
            Sending from
            {pool.mailboxes.length > 1 && <span className="bg-lk-lime px-2 py-0.5 font-plex text-[12px] font-semibold tracking-[0.6px] text-lk-ink">ROTATION ON</span>}
          </span>
        }
      >
        <button type="button" onClick={() => setEditing(true)} className={buttonClass("secondary", "sm")}>
          <Settings2 className="size-3.5" /> Edit pool
        </button>
      </CardHead>

      <div className="flex flex-col gap-2.5 border-b border-lk-line px-[18px] py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <span className="flex items-end gap-2">
            <span className="text-[28px] leading-none font-semibold tracking-[-1px] text-lk-fg">{pool.sentToday}</span>
            <span className="text-[15px] text-lk-dim">of {pool.capacityToday} sends today</span>
          </span>
          {nextSend && (
            <span className="flex items-center gap-1.5 font-plex text-sm text-lk-dim">
              <Timer className="size-3.5" /> Next send {nextSend.at}
              {nextSend.from ? ` · ${nextSend.from}` : ""}
            </span>
          )}
        </div>
        <div className="flex h-2 overflow-hidden bg-lk-ink">
          {pool.mailboxes.map((m, i) => (
            <span
              key={m.id}
              style={{ width: `${(m.sentToday / total) * 100}%`, opacity: m.status === "error" ? 1 : 1 - i * 0.2 }}
              className={m.status === "error" ? "bg-[#e5795b]/60" : "bg-lk-lime"}
            />
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[15px]">
          <thead className="bg-lk-ink">
            <tr>
              <th className={th}>Mailbox</th>
              <th className={th}>Status</th>
              <th className={th}>Today</th>
              <th className={`${th} !text-right`}>Leads</th>
            </tr>
          </thead>
          <tbody>
            {pool.mailboxes.map((m) => (
              <tr key={m.id} className="border-t border-lk-line">
                <td className="px-[18px] py-3">
                  <span className="flex flex-col">
                    <span className="font-plex text-[15px]">{m.email}</span>
                    <span className="text-[14px] text-lk-dim">{domainOf(m.email)}</span>
                  </span>
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={m.status} rampDay={m.rampDay} />
                </td>
                <td className="w-[180px] px-3 py-3">
                  <span className="flex flex-col gap-1.5">
                    <span className="font-plex text-sm">
                      {m.sentToday} / {m.effectiveLimit}
                    </span>
                    <span className="h-1 overflow-hidden bg-lk-ink">
                      <span
                        className={`block h-full ${m.status === "error" ? "bg-[#e5795b]" : "bg-lk-lime"}`}
                        style={{ width: `${Math.min(100, (m.sentToday / Math.max(m.effectiveLimit, 1)) * 100)}%` }}
                      />
                    </span>
                  </span>
                </td>
                <td className="px-[18px] py-3 text-right font-plex">{m.leads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="flex gap-3 border-t border-lk-line px-[18px] py-3.5 text-[14px] leading-normal text-lk-dim">
        <GitBranch className="mt-0.5 size-4 shrink-0 text-lk-lime" />
        {pool.assignment === "even" ? "New leads are split evenly across the mailboxes." : "New leads go to the mailbox with the most room today."} Follow-ups
        always come from the lead&apos;s mailbox, in the same thread. If a mailbox needs reconnecting, its leads wait; the others keep sending.
      </p>

      {poolDomains.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-lk-line px-[18px] py-4">
          <p className={monoLabel}>Domain health</p>
          {poolDomains.map((d) => (
            <div key={d.domain} className="flex flex-wrap items-center gap-3">
              <span className="w-[170px] font-plex text-[14px]">{d.domain}</span>
              <DomainChecks d={d} />
              {missingOf(d).length > 0 && (
                <a href="/guides/email-deliverability" className="text-sm font-semibold text-lk-lime hover:underline">
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
    <div role="dialog" aria-modal aria-label="Mailbox pool" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" onClick={onClose}>
      <div className="flex max-h-[90dvh] w-full max-w-[600px] flex-col overflow-hidden border border-lk-gray bg-lk-box shadow-[10px_10px_0_#000]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-lk-line px-6 py-5">
          <div className="flex flex-col gap-1">
            <p className="font-pixel text-[16px] text-lk-fg uppercase">Mailbox pool</p>
            <p className="text-[15px] text-lk-dim">This sequence sends from every mailbox you tick.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lk-dim hover:text-lk-fg">
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-4">
          {byDomain.map(([domain, list]) => (
            <div key={domain} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 font-plex text-[12px] text-lk-dim">
                <Globe className="size-3.5" /> {domain}
              </p>
              <div className="overflow-hidden border border-lk-line">
                {list.map((m) => {
                  const on = selected.has(m.id);
                  return (
                    <label key={m.id} className={`flex cursor-pointer items-center gap-3 border-lk-line px-3.5 py-2.5 [&:not(:first-child)]:border-t ${on ? "bg-lk-lime/5" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(m.id)} className="size-4 accent-lk-lime" />
                      <span className="min-w-0 flex-1 truncate font-plex text-[15px]">{m.email}</span>
                      <span className="font-plex text-sm text-lk-dim">
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
            <p className={monoLabel}>Assign new leads</p>
            <div className="grid grid-cols-2 gap-1 bg-lk-ink p-1">
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
                  className={`flex flex-col gap-0.5 border px-3 py-2 text-left ${assignment === value ? "border-lk-lime/35 bg-lk-box" : "border-transparent"}`}
                >
                  <span className={`text-[15px] font-semibold ${assignment === value ? "text-lk-lime" : ""}`}>{title}</span>
                  <span className="text-sm text-lk-dim">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {badDomains.map((d) => (
            <p key={d.domain} className="flex items-center gap-2.5 border border-[#e5795b]/25 bg-[#e5795b]/8 px-3 py-2.5 text-[15px]">
              <TriangleAlert className="size-4 shrink-0" style={{ color: RED }} />
              <span className="flex-1">
                {d.domain} has no {listOf(missingOf(d), "or")} record, so Gmail may send its mail to spam.
              </span>
              <a href="/guides/email-deliverability" className="font-semibold text-lk-lime hover:underline">
                Fix it
              </a>
            </p>
          ))}
          {error && (
            <p role="alert" className="text-[15px]" style={{ color: RED }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-lk-line bg-lk-ink px-6 py-4">
          <span className="flex flex-col">
            <span className="text-sm font-semibold">
              {chosen.length} {chosen.length === 1 ? "mailbox" : "mailboxes"} · up to {capacity} emails today
            </span>
            <span className="text-sm text-lk-dim">Leads already emailed keep their mailbox.</span>
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
