"use client";

import { Info, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createSequence } from "@/app/app/actions";
import { buttonClass, Card, CardHead, crumb, field, fieldLabel, monoLabel, PageHeader, Pill } from "./ui";

type Step = { subject: string; body: string; delay_days: number };
export type FormTable = { id: string; name: string; rowCount: number; columns: { key: string; name: string }[] };
export type FormMailbox = { id: string; email: string; status: string };

const FIRST: Step = { subject: "", body: "Hi {{first_name}},\n\n", delay_days: 0 };
const FOLLOW_UP: Step = { subject: "", body: "Hi {{first_name}},\n\n", delay_days: 3 };
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const box = "rounded-md border border-lk-line bg-white px-2.5 py-[7px] font-mono text-[12.5px] text-lk-fg focus:border-lk-fg focus:outline-none";

/**
 * Writes a draft sequence: who it goes to (a table), who it comes from (a mailbox pool) and the emails.
 * Saving sends nothing; the sequence page then enrolls people and starts it. Renders the page header too, since its
 * save button sits there.
 */
export function SequenceForm({ tables, mailboxes, defaultTableId }: { tables: FormTable[]; mailboxes: FormMailbox[]; defaultTableId?: string }) {
  const [name, setName] = useState("");
  const [tableId, setTableId] = useState(defaultTableId ?? tables[0]?.id ?? "");
  const [mailboxIds, setMailboxIds] = useState(() => mailboxes.filter((m) => m.status === "active").slice(0, 1).map((m) => m.id));
  const [steps, setSteps] = useState<Step[]>([FIRST]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // The box a placeholder chip is inserted into: the last subject or body the user was in.
  const focused = useRef<{ step: number; key: "subject" | "body"; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const table = tables.find((t) => t.id === tableId);
  const placeholders = useMemo(() => table?.columns.map((c) => c.key) ?? [], [table]);
  // The browser's time zone; set after hydration, since the server renders in its own (UTC on Cloud Run).
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const update = (i: number, patch: Partial<Step>) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const insert = (key: string) => {
    const f = focused.current;
    if (!f) return;
    const value = f.el.value;
    const at = f.el.selectionStart ?? value.length;
    const token = `{{${key}}}`;
    update(f.step, { [f.key]: value.slice(0, at) + token + value.slice(f.el.selectionEnd ?? at) });
    requestAnimationFrame(() => {
      f.el.focus();
      f.el.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const track = (step: number, key: "subject" | "body") => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    focused.current = { step, key, el: e.currentTarget };
  };

  const submit = () =>
    start(async () => {
      const res = await createSequence({ name, tableId, mailboxIds, steps, timezone, windowStartHour: startHour, windowEndHour: endHour });
      // Success redirects to the new sequence, so only a refusal comes back.
      if (res && !res.ok) setError(res.error);
    });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={
          <span className={crumb}>
            <Link href="/app/sequences" className="hover:text-lk-fg">
              Sequences
            </Link>{" "}
            ›
          </span>
        }
        title="New sequence"
        meta="Saved as a draft · nothing sends until you start it"
        actions={
          <>
            {error && (
              <span role="alert" className="max-w-sm text-[12.5px] text-ws-red">
                {error}
              </span>
            )}
            <Link href="/app/sequences" className={buttonClass("ghost")}>
              Cancel
            </Link>
            <button type="button" disabled={pending} onClick={submit} className={buttonClass("primary")}>
              {pending ? "Saving…" : "Save as draft"}
            </button>
          </>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHead title="Setup" />
          <div className="flex flex-col gap-5 p-4 text-[13px]">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fintech CTOs, October" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Send to the people in</span>
              <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={field}>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.rowCount.toLocaleString("en")} {t.rowCount === 1 ? "row" : "rows"}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className={`${fieldLabel} pb-1.5`}>Send from</legend>
              {mailboxes.map((m) => (
                <label key={m.id} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={mailboxIds.includes(m.id)}
                    onChange={(e) => setMailboxIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id)))}
                    className="size-4 accent-lk-fg"
                  />
                  <span className={`min-w-0 flex-1 truncate font-mono text-[12px] ${m.status === "active" ? "text-lk-fg" : "text-lk-dim"}`}>{m.email}</span>
                  {m.status !== "active" && <Pill tone="red">reconnect</Pill>}
                </label>
              ))}
              <span className="text-[12px] text-lk-dim">Each person keeps one mailbox for every email.</span>
            </fieldset>
            <div className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Sending hours</span>
              <div className="flex flex-wrap items-center gap-2 text-lk-muted">
                <span>Weekdays</span>
                <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} aria-label="From" className={box}>
                  {HOURS.slice(0, 24).map((h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} aria-label="To" className={box}>
                  {HOURS.slice(1).map((h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
              <span className="font-mono text-[11px] text-lk-dim">{timezone}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead
            title={
              <>
                Emails <span className="font-mono text-[11px] font-normal text-lk-dim">{steps.length}</span>
              </>
            }
          />
          {placeholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-lk-line bg-ws-head px-4 py-2.5">
              <span className={`${monoLabel} pr-2`} title="Filled in per person. Click one to add it where you're typing.">
                From {table?.name}
              </span>
              {placeholders.map((key) => (
                <button
                  key={key}
                  type="button"
                  // Keep the focus (and the cursor) in the box being edited.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(key)}
                  className="rounded border border-lk-line bg-white px-1.5 py-[2px] font-mono text-[11px] text-ws-blue transition hover:border-ws-blue"
                >
                  {`{{${key}}}`}
                </button>
              ))}
            </div>
          )}

          {steps.map((s, i) => (
            <div key={i} className="flex flex-col gap-2.5 border-b border-lk-line p-4">
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Pill tone="blue">Email {i + 1}</Pill>
                  <span className="font-mono text-[11px] text-lk-dim">{i === 0 ? "first email" : "follow-up · same thread"}</span>
                </span>
                {i > 0 && (
                  <span className="flex items-center gap-2 text-[12.5px] whitespace-nowrap text-lk-muted">
                    if no reply after
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={s.delay_days}
                      onChange={(e) => update(i, { delay_days: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                      aria-label="Days"
                      className={`${box} w-14`}
                    />
                    days
                    <button
                      type="button"
                      onClick={() => setSteps((all) => all.filter((_, j) => j !== i))}
                      className="rounded p-1 text-lk-dim transition hover:bg-ws-red-soft hover:text-ws-red"
                      aria-label={`Remove email ${i + 1}`}
                    >
                      <Trash2 className="size-[14px]" />
                    </button>
                  </span>
                )}
              </div>
              {i === 0 && (
                <input value={s.subject} onChange={(e) => update(i, { subject: e.target.value })} onFocus={track(i, "subject")} placeholder="Subject" className={field} />
              )}
              <textarea
                value={s.body}
                onChange={(e) => update(i, { body: e.target.value })}
                onFocus={track(i, "body")}
                rows={i === 0 ? 7 : 5}
                aria-label={`Email ${i + 1}`}
                className={`${field} p-3 font-mono !text-[12.5px] leading-[21px]`}
              />
            </div>
          ))}

          {steps.length < 10 && (
            <button
              type="button"
              onClick={() => setSteps((all) => [...all, FOLLOW_UP])}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 text-[12.5px] font-semibold text-lk-muted transition hover:bg-lk-frame hover:text-lk-fg"
            >
              <Plus className="size-[14px]" /> Add a follow-up
            </button>
          )}
        </Card>
      </div>

      <p className="flex items-center gap-2 text-[12.5px] text-lk-dim">
        <Info className="size-[14px]" /> Every email gets a one-click unsubscribe link.
      </p>
    </div>
  );
}
