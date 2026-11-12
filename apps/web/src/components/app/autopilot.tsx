"use client";

import { ArrowUpRight, Asterisk, CalendarClock, Copy, MessageCircle, Plus, Webhook, X, type LucideIcon } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { Routine, RoutineRun, RoutineTrigger } from "@meerko/sdk";
import { createRoutine, deleteRoutine, runRoutine, setRoutineStatus, setRoutineTrigger, updateRoutine, type ActionResult } from "@/app/app/actions";
import { buttonClass, Card, CardHead, field, fieldLabel, formatWhen, headLink, monoLabel, Notice, Pill, th, type PillTone } from "@/components/app/ui";

// "WS3 · Autopilot" (XDlOc) and "WS3 · Modal · New routine" (cwNDc) in docs/design/meerko.pen: every routine in one
// table, the picked one's details and runs below it, and what starts it on the right.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const OUTCOME: Record<RoutineRun["outcome"], { text: string; tone: PillTone; dot: string }> = {
  firing: { text: "starting", tone: "neutral", dot: "bg-lk-gray" },
  fired: { text: "started", tone: "blue", dot: "bg-ws-green/50" },
  ran: { text: "ran", tone: "signal", dot: "bg-ws-green" },
  fire_failed: { text: "failed to start", tone: "red", dot: "bg-ws-red" },
  missed: { text: "missed", tone: "red", dot: "bg-ws-red" },
  no_callback: { text: "no check-in", tone: "amber", dot: "bg-ws-red/50" },
};

const STARTED_BY: Record<RoutineTrigger, string> = {
  own_scheduler: "your AI's own schedule",
  claude_routine: "Meerko, through a Claude routine",
  chatgpt_events: "Meerko, through ChatGPT",
  webhook: "Meerko, through a webhook",
};

/** The table's short form, with a mark. */
const TRIGGER: Record<RoutineTrigger, { text: string; icon: LucideIcon; tint: string }> = {
  own_scheduler: {
    text: "Your AI's schedule",
    icon: CalendarClock,
    tint: "text-lk-muted",
  },
  claude_routine: {
    text: "Claude routine",
    icon: Asterisk,
    tint: "text-[#d97757]",
  },
  chatgpt_events: {
    text: "ChatGPT task",
    icon: MessageCircle,
    tint: "text-lk-fg",
  },
  webhook: { text: "Webhook", icon: Webhook, tint: "text-lk-muted" },
};

/** In the routine's own zone (UTC for a replies routine), so the server and the browser render the same text. */
function when(iso: string, timeZone = "UTC") {
  const text = new Date(iso).toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return timeZone === "UTC" ? `${text} UTC` : text;
}

function useCopy() {
  const [copied, setCopied] = useState<string>();
  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => setCopied(what),
      () => setCopied(undefined),
    );
  return { copied, copy };
}

const choiceRow =
  "flex cursor-pointer items-center gap-2.5 border-b border-lk-line px-3 py-2.5 text-[13px] text-lk-fg last:border-0 has-[:checked]:bg-lk-frame";
const radio = "size-3.5 accent-lk-fg";

/** Name, brief and when. Used to create a routine and to edit one. */
function RoutineForm({ routine, hasReplies, onDone, panel = false }: { routine?: Routine; hasReplies: boolean; onDone: () => void; panel?: boolean }) {
  const [state, submit, pending] = useActionState<ActionResult | null, FormData>(routine ? updateRoutine : createRoutine, null);
  const [when, setWhen] = useState<Routine["when"]>(routine?.when ?? (hasReplies ? "schedule" : "replies"));
  const [timezone, setTimezone] = useState(routine?.cadence?.timezone ?? "");
  // The browser's zone, filled after hydration so the server render doesn't differ.
  useEffect(() => {
    if (!timezone) setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [timezone]);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const days = routine?.cadence?.days ?? [1, 2, 3, 4, 5];
  const repliesTaken = hasReplies && routine?.when !== "replies";

  return (
    <form action={submit} className={`flex flex-col text-[13px] ${panel ? "min-h-0 flex-1" : ""}`}>
      <div className={`flex flex-col gap-4 px-5 py-4 ${panel ? "lk-scroll min-h-0 flex-1 overflow-y-auto" : ""}`}>
        {routine && <input type="hidden" name="id" value={routine.id} />}
        <input type="hidden" name="when" value={when} />
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Name</span>
          <input name="name" required maxLength={80} defaultValue={routine?.name} placeholder="Answer new replies" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Brief</span>
          <textarea
            name="brief"
            required
            maxLength={4000}
            rows={5}
            defaultValue={routine?.brief}
            placeholder="Find 10 new leads that match my ICP, find their emails, and add the ones with verified emails to my Q4 sequence. Tell me what you added."
            className={`${field} leading-[1.55]`}
          />
          <span className="text-[12px] text-lk-dim">Your AI gets it from start_routine_run on every run, with nobody to ask.</span>
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${fieldLabel} mb-1.5`}>When</legend>
          <div className="overflow-hidden rounded-md border border-lk-line">
            <label className={`${choiceRow} ${repliesTaken ? "cursor-not-allowed text-lk-dim" : ""}`}>
              <input
                type="radio"
                name="when-choice"
                checked={when === "replies"}
                disabled={repliesTaken}
                onChange={() => setWhen("replies")}
                className={radio}
              />
              When new replies arrive
              {repliesTaken && <span className="font-mono text-[10.5px] text-lk-dim">this workspace has one</span>}
            </label>
            <label className={choiceRow}>
              <input type="radio" name="when-choice" checked={when === "schedule"} onChange={() => setWhen("schedule")} className={radio} />
              On a schedule
            </label>
          </div>
        </fieldset>
        {when === "schedule" && (
          <>
            <fieldset className="flex flex-col gap-1.5">
              <legend className={`${fieldLabel} mb-1.5`}>Days</legend>
              <span className="flex flex-wrap gap-1">
                {DAYS.map((d, i) => (
                  <label
                    key={d}
                    className="cursor-pointer rounded-md border border-lk-line bg-white px-2.5 py-[5px] text-[12.5px] text-lk-muted transition has-[:checked]:border-lk-fg has-[:checked]:bg-lk-fg has-[:checked]:font-semibold has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ws-acc"
                  >
                    <input type="checkbox" name="days" value={i + 1} defaultChecked={days.includes(i + 1)} className="sr-only" />
                    {d}
                  </label>
                ))}
              </span>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>Time</span>
                <input type="time" name="time" required defaultValue={routine?.cadence?.time ?? "09:00"} className={`${field} w-32 font-mono`} />
              </label>
              <label className="flex min-w-48 flex-1 flex-col gap-1.5">
                <span className={fieldLabel}>Time zone</span>
                <input
                  name="timezone"
                  required
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Europe/Madrid"
                  className={`${field} font-mono`}
                />
              </label>
            </div>
          </>
        )}
        {state && !state.ok && <Notice ok={false}>{state.error}</Notice>}
      </div>
      <div className={`flex justify-end gap-2 px-5 py-3 ${panel ? "border-t border-lk-line bg-lk-frame" : "pt-0 pb-4"}`}>
        <button type="button" onClick={onDone} className={buttonClass("secondary")}>
          Cancel
        </button>
        <button disabled={pending} className={buttonClass("primary")}>
          {pending ? "Saving…" : routine ? "Save" : "Create routine"}
        </button>
      </div>
    </form>
  );
}

export function NewRoutine({ hasReplies }: { hasReplies: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        <Plus /> New routine
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-lk-fg/30" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="New routine"
            className="flex h-full w-full max-w-[540px] flex-col border-l border-lk-line bg-white shadow-[0_12px_40px_rgba(22,22,26,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-lk-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold text-lk-fg">New routine</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-lk-dim hover:bg-lk-frame hover:text-lk-fg">
                <X className="size-4" />
              </button>
            </div>
            <RoutineForm hasReplies={hasReplies} onDone={() => setOpen(false)} panel />
          </div>
        </div>
      )}
    </>
  );
}

/** What starts the routine, and the exact text to give the AI. */
function HowItRuns({ routine, canSetTrigger }: { routine: Routine; canSetTrigger: boolean }) {
  const [saved, save, saving] = useActionState(setRoutineTrigger, null);
  const [kind, setKind] = useState<RoutineTrigger>(routine.trigger === "own_scheduler" && routine.when === "replies" ? "claude_routine" : routine.trigger);
  const { copied, copy } = useCopy();
  const choices = (
    [
      ["own_scheduler", "My AI's own schedule", ""],
      ["claude_routine", "Claude routine", "started by Meerko"],
      ["chatgpt_events", "ChatGPT task", "routine.due event"],
      ["webhook", "Webhook", "signed POST"],
    ] as const
  ).filter(([value]) => !(value === "own_scheduler" && routine.when === "replies"));
  const setup = routine.setup;
  const changed = kind !== routine.trigger;
  const link = "text-ws-acc-ink underline-offset-2 hover:underline";
  // Hidden while a different trigger is picked but not saved: it describes the saved one.
  const promptBlock = !changed && (
    <>
      {setup.prompt && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between gap-3">
            <span className={monoLabel}>
              {routine.trigger === "claude_routine"
                ? "The Claude routine's prompt"
                : routine.trigger === "chatgpt_events"
                  ? "Paste into ChatGPT"
                  : "Prompt for your AI"}
            </span>
            <button
              type="button"
              onClick={() => copy(setup.prompt!, "prompt")}
              className="flex items-center gap-1 text-[12px] font-medium text-lk-fg hover:text-lk-muted"
            >
              <Copy className="size-3" /> {copied === "prompt" ? "Copied" : "Copy"}
            </button>
          </span>
          <p className="lk-scroll max-h-40 overflow-y-auto rounded-md border border-lk-line bg-lk-frame px-3 py-2.5 font-mono text-[11px] leading-[1.6] whitespace-pre-wrap text-lk-muted">
            {setup.prompt}
          </p>
        </div>
      )}
      {setup.steps && (
        <ul className="flex flex-col gap-1.5 text-[12.5px] text-lk-muted">
          {setup.steps.map((s) => (
            <li key={s.client}>
              <span className="font-medium text-lk-fg">{s.client}:</span> {s.text}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <Card className="self-start">
      <CardHead title="How it runs">
        {kind === "claude_routine" && setup.setupPrompt && (
          <button type="button" onClick={() => copy(setup.setupPrompt!, "setup")} className={headLink}>
            {copied === "setup" ? "Copied" : "Copy setup prompt"}
          </button>
        )}
      </CardHead>
      <div className="flex flex-col gap-4 px-4 py-4 text-[13px]">
        <p className="leading-[1.55] text-lk-muted">{setup.howItRuns}</p>

        {canSetTrigger ? (
          <form action={save} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={routine.id} />
            <input type="hidden" name="kind" value={kind} />
            <fieldset className="flex flex-col gap-1.5">
              <legend className={`${monoLabel} mb-1.5`}>Started by</legend>
              <div className="overflow-hidden rounded-md border border-lk-line">
                {choices.map(([value, text, hint]) => {
                  const Icon = TRIGGER[value].icon;
                  return (
                    <label key={value} className={choiceRow}>
                      <input type="radio" name="trigger-choice" checked={kind === value} onChange={() => setKind(value)} className={radio} />
                      <Icon className={`size-3.5 shrink-0 ${TRIGGER[value].tint}`} />
                      <span className={kind === value ? "font-semibold" : ""}>{text}</span>
                      {hint && <span className="font-mono text-[10.5px] text-lk-dim">{hint}</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {kind === "claude_routine" && (
              <>
                <ol className="flex list-decimal flex-col gap-1 pl-4 text-[12.5px] leading-[1.5] text-lk-muted">
                  <li>
                    Paste the setup prompt into a Claude chat, or create the routine at{" "}
                    <a href="https://claude.ai/code/routines" target="_blank" rel="noreferrer" className={link}>
                      claude.ai/code/routines
                    </a>
                    .
                  </li>
                  <li>Add an API trigger there, generate its token, and paste both here.</li>
                </ol>
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>Trigger URL</span>
                  <input
                    name="url"
                    required
                    defaultValue={routine.trigger === "claude_routine" ? (routine.triggerUrl ?? "") : ""}
                    placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire"
                    className={`${field} font-mono text-[12px]`}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>Token</span>
                  <input
                    name="token"
                    type="password"
                    autoComplete="off"
                    required={routine.trigger !== "claude_routine"}
                    placeholder={
                      routine.trigger === "claude_routine" && routine.secretLast4 ? `•••• ${routine.secretLast4} · leave empty to keep` : "Trigger token"
                    }
                    className={`${field} font-mono text-[12px]`}
                  />
                </label>
              </>
            )}
            {kind === "chatgpt_events" && changed && (
              <p className="text-[12.5px] leading-[1.5] text-lk-muted">
                Save, then paste the prompt shown here into a ChatGPT chat with the Meerko app on. ChatGPT subscribes to this routine&apos;s{" "}
                <span className="font-mono">routine.due</span> event, and Meerko sends it each time the routine should run. Needs a ChatGPT plan with
                event-triggered tasks.
              </p>
            )}
            {kind === "webhook" && (
              <>
                <p className="text-[12.5px] leading-[1.5] text-lk-muted">
                  Meerko POSTs a signed <span className="font-mono">{routine.when === "replies" ? "replies.waiting" : "routine.due"}</span> event with the
                  routine and its brief. Point it at the Claude Agent SDK, a CI job or n8n; for replies, give that agent a drafts-only API key (Connections →
                  API keys).
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>Webhook URL</span>
                  <input
                    name="url"
                    type="url"
                    required
                    defaultValue={routine.trigger === "webhook" ? (routine.triggerUrl ?? "") : ""}
                    placeholder="https://your-agent.example.com/meerko"
                    className={`${field} font-mono text-[12px]`}
                  />
                </label>
              </>
            )}

            {promptBlock}

            <span className="flex justify-end">
              <button disabled={saving} className={buttonClass(changed ? "primary" : "secondary")}>
                {saving ? "Saving…" : "Save"}
              </button>
            </span>
          </form>
        ) : (
          <>
            {promptBlock}
            <p className="text-[12.5px] text-lk-dim">Sign in with your account, not an API key, to choose what starts it.</p>
          </>
        )}
        {saved?.ok && saved.secret && (
          <div className="flex flex-col gap-2 rounded-md border border-[#f3e2a6] bg-ws-acc-soft p-3">
            <p className="text-[12.5px] font-semibold text-lk-fg">
              Signing secret. Copy it now: it won&apos;t be shown again. Check the meerko-signature header with it.
            </p>
            <code className="rounded border border-lk-line bg-white px-3 py-2 font-mono text-[12px] break-all text-lk-fg">{saved.secret}</code>
          </div>
        )}
        {saved && <Notice ok={saved.ok}>{saved.ok ? (saved.message ?? "Saved") : saved.error}</Notice>}
      </div>
    </Card>
  );
}

function statusPill(r: Routine) {
  if (r.needsSetup) return <Pill tone="amber">needs setup</Pill>;
  if (r.status === "paused") return r.statusReason === "failing" ? <Pill tone="red">paused: failing</Pill> : <Pill>paused</Pill>;
  if (r.lastError) return <Pill tone="red">failing</Pill>;
  return <Pill tone="signal">on</Pill>;
}

/** The latest runs as dots, oldest on the left. */
function RunDots({ r }: { r: Routine }) {
  if (r.runs.length === 0) return <span className="font-mono text-[11px] text-lk-dim">—</span>;
  return (
    <span className="flex gap-1" aria-label="Latest runs">
      {[...r.runs]
        .slice(0, 5)
        .reverse()
        .map((run) => (
          <span
            key={run.id}
            title={`${OUTCOME[run.outcome].text}, ${when(run.createdAt, r.cadence?.timezone)}`}
            className={`size-2.5 rounded-sm ${OUTCOME[run.outcome].dot}`}
          />
        ))}
    </span>
  );
}

/** On/off: the same pause and resume as the routine's buttons. */
function Toggle({ r }: { r: Routine }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const on = r.status === "active";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? `Pause ${r.name}` : `Resume ${r.name}`}
      title={error}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        start(async () => {
          const res = await setRoutineStatus(r.id, on ? "paused" : "active");
          setError(res.ok ? undefined : res.error);
        });
      }}
      className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition disabled:opacity-50 ${on ? "bg-lk-fg" : "bg-lk-gray"}`}
    >
      <span className={`absolute top-[2px] size-[14px] rounded-full bg-white transition-all ${on ? "left-[14px]" : "left-[2px]"}`} />
    </button>
  );
}

function nextRun(r: Routine) {
  if (r.status !== "active") return "—";
  if (r.nextDueAt) return when(r.nextDueAt, r.cadence?.timezone);
  return r.when === "replies" ? "on arrival" : "—";
}

/** The picked routine: what it does, its actions, and its latest runs. */
function RoutineCard({ routine: r, hasReplies }: { routine: Routine; hasReplies: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>();
  const act = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(await fn());
    });
  const meerkoStarts = r.trigger !== "own_scheduler";
  const facts: [string, string][] = [
    ["When", r.schedule],
    ["Started by", STARTED_BY[r.trigger].replace(/^./, (c) => c.toUpperCase())],
    ...(r.lastFiredAt ? [["Last started", formatWhen(r.lastFiredAt)] as [string, string]] : []),
    ...(r.nextDueAt ? [["Next run", when(r.nextDueAt, r.cadence?.timezone)] as [string, string]] : []),
  ];

  return (
    <Card className="self-start">
      <CardHead
        title={
          <>
            {r.name} {statusPill(r)}
          </>
        }
      >
        {!editing && (
          <span className="flex flex-wrap items-center gap-1.5">
            {meerkoStarts && r.status === "active" && (
              <button type="button" disabled={pending} onClick={() => act(() => runRoutine(r.id))} className={buttonClass("secondary", "sm")}>
                Run it now
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => setRoutineStatus(r.id, r.status === "active" ? "paused" : "active"))}
              className={buttonClass("secondary", "sm")}
            >
              {r.status === "active" ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete "${r.name}"? Its run history goes with it.`)) act(() => deleteRoutine(r.id));
              }}
              className={buttonClass("ghost", "sm")}
            >
              Delete
            </button>
          </span>
        )}
      </CardHead>

      {editing ? (
        <RoutineForm routine={r} hasReplies={hasReplies} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-3.5 px-4 py-4">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,max-content))]">
            {facts.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className={monoLabel}>{k}</dt>
                <dd className="text-[13px] text-lk-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-1">
            <span className={monoLabel}>Brief</span>
            <p className="text-[13px] leading-[1.6] whitespace-pre-wrap text-lk-fg">{r.brief}</p>
          </div>
          {r.lastError && <Notice ok={false}>{r.lastError}</Notice>}
          {result && <Notice ok={result.ok}>{result.ok ? (result.message ?? "Done") : result.error}</Notice>}
        </div>
      )}

      {r.runs.length > 0 && (
        <div className="overflow-x-auto border-t border-lk-line">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-lk-line">
                <th className={`${th} w-[130px]`}>Run</th>
                <th className={th} colSpan={3}>
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody>
              {r.runs.slice(0, 5).map((run) => (
                <tr key={run.id} className="border-b border-lk-line last:border-0">
                  <td className="px-4 py-3 font-mono text-[11.5px] whitespace-nowrap text-lk-muted">{formatWhen(run.createdAt)}</td>
                  <td className="w-[120px] px-2 py-3">
                    <Pill tone={OUTCOME[run.outcome].tone}>{OUTCOME[run.outcome].text}</Pill>
                  </td>
                  <td className="px-2 py-3 text-[13px] text-lk-fg">
                    {run.reason === "replies"
                      ? `${run.replies ?? 0} ${run.replies === 1 ? "reply" : "replies"}`
                      : run.reason === "manual"
                        ? "run by hand"
                        : run.reason === "ai"
                          ? "started by your AI"
                          : "scheduled"}
                    {run.error && <span className="ml-3 text-ws-red">{run.error}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {run.sessionUrl && (
                      <a href={run.sessionUrl} target="_blank" rel="noreferrer" className={`${headLink} inline-flex items-center gap-1 whitespace-nowrap`}>
                        Watch in Claude <ArrowUpRight className="size-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Every routine in a table; picking one shows its details, runs and setup below. */
export function Routines({ routines, canSetTrigger, hasReplies }: { routines: Routine[]; canSetTrigger: boolean; hasReplies: boolean }) {
  const [picked, setPicked] = useState(routines[0]?.id);
  const r = routines.find((x) => x.id === picked) ?? routines[0];

  return (
    <>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-lk-line">
                {["Routine", "When", "Started by", "Last runs", "Next run", "Status"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routines.map((x) => {
                const on = x.id === r?.id;
                const T = TRIGGER[x.trigger];
                return (
                  <tr
                    key={x.id}
                    onClick={() => setPicked(x.id)}
                    aria-selected={on}
                    className={`cursor-pointer border-b border-lk-line last:border-0 ${on ? "bg-lk-frame" : "hover:bg-lk-frame"}`}
                  >
                    <td className="max-w-[280px] px-4 py-2.5">
                      <button type="button" onClick={() => setPicked(x.id)} className="block w-full min-w-0 text-left">
                        <span className="block truncate text-[13px] font-semibold text-lk-fg">{x.name}</span>
                        <span className="block truncate text-[12px] text-lk-dim">{x.brief}</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-lk-fg">{x.schedule}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] whitespace-nowrap text-lk-fg">
                        <T.icon className={`size-3.5 ${T.tint}`} /> {T.text}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <RunDots r={x} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11.5px] whitespace-nowrap text-lk-fg">{nextRun(x)}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Toggle r={x} />
                        {statusPill(x)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {r && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <RoutineCard key={r.id} routine={r} hasReplies={hasReplies} />
          <HowItRuns key={r.id} routine={r} canSetTrigger={canSetTrigger} />
        </div>
      )}
    </>
  );
}
