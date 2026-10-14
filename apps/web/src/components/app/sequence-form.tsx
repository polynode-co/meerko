"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createSequence } from "@/app/app/actions";
import { buttonClass, Card } from "./ui";

type Step = { subject: string; body: string; delay_days: number };
export type FormTable = { id: string; name: string; rowCount: number; columns: { key: string; name: string }[] };
export type FormMailbox = { id: string; email: string; status: string };

const FIRST: Step = { subject: "", body: "Hi {{first_name}},\n\n", delay_days: 0 };
const FOLLOW_UP: Step = { subject: "", body: "Hi {{first_name}},\n\n", delay_days: 3 };
const HOURS = Array.from({ length: 25 }, (_, h) => h);
const box = "rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent/70";
const field = `w-full ${box}`;

/**
 * Writes a draft sequence: who it goes to (a table), who it comes from (a mailbox pool) and the emails.
 * Saving sends nothing; the sequence page then enrolls people and starts it.
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
      <Card raised className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5 text-[13px]">
          <span className="font-semibold">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fintech CTOs, October" className={field} />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-semibold">Send to the people in</span>
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className={field}>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.rowCount.toLocaleString("en")} {t.rowCount === 1 ? "row" : "rows"})
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1.5 text-[13px]">
            <legend className="pb-1.5 font-semibold">Send from</legend>
            {mailboxes.map((m) => (
              <label key={m.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mailboxIds.includes(m.id)}
                  onChange={(e) => setMailboxIds((ids) => (e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id)))}
                  className="accent-[var(--color-accent)]"
                />
                <span className="font-mono text-xs">{m.email}</span>
                {m.status !== "active" && <span className="text-xs text-[#e5795b]">needs reconnecting</span>}
              </label>
            ))}
            <span className="text-xs text-muted">With several, each person gets one mailbox and keeps it for every email.</span>
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-semibold">Sending hours</span>
          <span className="text-muted">weekdays from</span>
          <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} className={box}>
            {HOURS.slice(0, 24).map((h) => <option key={h} value={h}>{h}:00</option>)}
          </select>
          <span className="text-muted">to</span>
          <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} className={box}>
            {HOURS.slice(1).map((h) => <option key={h} value={h}>{h}:00</option>)}
          </select>
          <span className="text-muted">({timezone.replace(/_/g, " ")} time)</span>
        </div>
      </Card>

      {placeholders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Placeholders from {table?.name}, filled in per person. Click one to add it where you're typing:</span>
          {placeholders.map((key) => (
            <button
              key={key}
              type="button"
              // Keep the focus (and the cursor) in the box being edited.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(key)}
              className="rounded-md bg-accent-soft px-2 py-1 font-mono text-accent hover:brightness-125"
            >
              {`{{${key}}}`}
            </button>
          ))}
        </div>
      )}

      {steps.map((s, i) => (
        <Card key={i} className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2.5 text-[13px] font-semibold">
              <span className={`grid size-6 place-items-center rounded-full font-mono text-xs ${i === 0 ? "bg-accent text-dark" : "bg-line"}`}>{i + 1}</span>
              {i === 0 ? "First email" : "Follow-up, sent as a reply in the same thread"}
            </span>
            {i > 0 && (
              <span className="flex items-center gap-2 text-[13px] whitespace-nowrap text-muted">
                if no reply after
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={s.delay_days}
                  onChange={(e) => update(i, { delay_days: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                  className={`${box} w-16`}
                />
                days
                <button type="button" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} className="text-muted hover:text-[#e5795b]" aria-label={`Remove email ${i + 1}`}>
                  <Trash2 className="size-4" />
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
            rows={8}
            className={`${field} font-[inherit] leading-relaxed`}
          />
        </Card>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {steps.length < 10 ? (
          <button type="button" onClick={() => setSteps((all) => [...all, FOLLOW_UP])} className={buttonClass("ghost")}>
            <Plus className="size-[15px]" /> Add a follow-up
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {error && <span role="alert" className="max-w-sm text-xs text-[#e5795b]">{error}</span>}
          <button type="button" disabled={pending} onClick={submit} className={buttonClass("primary")}>
            {pending ? "Saving…" : "Save as draft"}
          </button>
        </div>
      </div>
      <p className="text-xs text-muted">
        Saving sends nothing. On the next page you check what each person receives, add the people and start sending. Every email gets a
        one-click unsubscribe link.
      </p>
    </div>
  );
}
