"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { Routine, RoutineRun, RoutineTrigger } from "@meerko/sdk";
import { createRoutine, deleteRoutine, runRoutine, setRoutineStatus, setRoutineTrigger, updateRoutine, type ActionResult } from "@/app/app/actions";
import { buttonClass, Card, CardHead, field, fieldLabel, formatWhen, monoLabel, Notice, Pill, type PillTone } from "@/components/app/ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const OUTCOME: Record<RoutineRun["outcome"], { text: string; tone: PillTone; dot: string }> = {
  firing: { text: "starting", tone: "amber", dot: "bg-lk-muted" },
  fired: { text: "started", tone: "signal", dot: "bg-lk-lime/60" },
  ran: { text: "ran", tone: "solid", dot: "bg-lk-lime" },
  fire_failed: { text: "failed to start", tone: "amber", dot: "bg-[#e5795b]" },
  missed: { text: "missed", tone: "amber", dot: "bg-[#e5795b]" },
  no_callback: { text: "no check-in", tone: "amber", dot: "bg-[#e5795b]/60" },
};

const STARTED_BY: Record<RoutineTrigger, string> = {
  own_scheduler: "your AI's own schedule",
  claude_routine: "Meerko, through a Claude routine",
  webhook: "Meerko, through a webhook",
};

/** In the routine's own zone (UTC for a replies routine), so the server and the browser render the same text. */
function when(iso: string, timeZone = "UTC") {
  const text = new Date(iso).toLocaleString("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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

/** Name, brief and when. Used to create a routine and to edit one. */
function RoutineForm({ routine, hasReplies, onDone }: { routine?: Routine; hasReplies: boolean; onDone: () => void }) {
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
    <form action={submit} className="flex flex-col gap-4 px-[18px] py-4 text-[15px]">
      {routine && <input type="hidden" name="id" value={routine.id} />}
      <input type="hidden" name="when" value={when} />
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Name</span>
        <input name="name" required maxLength={80} defaultValue={routine?.name} placeholder="Answer new replies" className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>Brief: what your AI does on each run</span>
        <textarea
          name="brief"
          required
          maxLength={4000}
          rows={5}
          defaultValue={routine?.brief}
          placeholder="Find 10 new leads that match my ICP, find their emails, and add the ones with verified emails to my Q4 sequence. Tell me what you added."
          className={field}
        />
        <span className="text-[13px] text-lk-dim">Write it for a run with nobody to ask. Your AI gets it from start_routine_run at the start of every run.</span>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className={`${fieldLabel} mb-1.5`}>When</legend>
        <label className={`flex items-center gap-2 ${repliesTaken ? "opacity-50" : ""}`}>
          <input type="radio" name="when-choice" checked={when === "replies"} disabled={repliesTaken} onChange={() => setWhen("replies")} className="size-4 accent-lk-lime" />
          When new replies arrive{repliesTaken && <span className="text-lk-dim"> (this workspace already has one)</span>}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="when-choice" checked={when === "schedule"} onChange={() => setWhen("schedule")} className="size-4 accent-lk-lime" />
          On a schedule
        </label>
      </fieldset>
      {when === "schedule" && (
        <div className="flex flex-wrap items-end gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className={`${fieldLabel} mb-1.5`}>Days</legend>
            <span className="flex flex-wrap gap-1">
              {DAYS.map((d, i) => (
                <label key={d} className="flex cursor-pointer items-center gap-1.5 px-2 py-1.5 outline outline-1 -outline-offset-1 outline-lk-line has-[:checked]:outline-lk-lime">
                  <input type="checkbox" name="days" value={i + 1} defaultChecked={days.includes(i + 1)} className="size-3.5 accent-lk-lime" />
                  {d}
                </label>
              ))}
            </span>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Time</span>
            <input type="time" name="time" required defaultValue={routine?.cadence?.time ?? "09:00"} className={`${field} w-32`} />
          </label>
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className={fieldLabel}>Time zone</span>
            <input name="timezone" required value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Madrid" className={field} />
          </label>
        </div>
      )}
      {state && !state.ok && <Notice ok={false}>{state.error}</Notice>}
      <span className="flex gap-2">
        <button disabled={pending} className={buttonClass("primary")}>{pending ? "Saving…" : routine ? "Save" : "Create routine"}</button>
        <button type="button" onClick={onDone} className={buttonClass("ghost")}>Cancel</button>
      </span>
    </form>
  );
}

export function NewRoutine({ hasReplies }: { hasReplies: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("primary")}>
        <Plus className="size-[15px]" /> New routine
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setOpen(false)}>
          <div className="h-full w-full max-w-[560px] overflow-y-auto border-l border-lk-line bg-lk-box" onClick={(e) => e.stopPropagation()}>
            <CardHead title="New routine" />
            <RoutineForm hasReplies={hasReplies} onDone={() => setOpen(false)} />
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
      ["own_scheduler", "My AI's own schedule"],
      ["claude_routine", "Claude routine, started by Meerko"],
      ["webhook", "Webhook, called by Meerko"],
    ] as const
  ).filter(([value]) => !(value === "own_scheduler" && routine.when === "replies"));
  const setup = routine.setup;
  const changed = kind !== routine.trigger;

  return (
    <div className="flex flex-col gap-4 border-t border-lk-line bg-lk-ink/40 px-[18px] py-4 text-[15px]">
      <p className="leading-relaxed text-lk-muted">{setup.howItRuns}</p>

      {!changed && setup.prompt && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between gap-3">
            <span className={monoLabel}>{routine.trigger === "claude_routine" ? "The Claude routine's prompt" : "Prompt for your AI"}</span>
            <button type="button" onClick={() => copy(setup.prompt!, "prompt")} className={buttonClass("secondary", "sm")}>{copied === "prompt" ? "Copied" : "Copy"}</button>
          </span>
          <p className="bg-lk-ink px-3 py-2.5 font-plex text-[13px] leading-relaxed whitespace-pre-wrap text-lk-fg outline outline-1 -outline-offset-1 outline-lk-line">{setup.prompt}</p>
        </div>
      )}
      {!changed && setup.steps && (
        <ul className="flex flex-col gap-1.5 text-lk-dim">
          {setup.steps.map((s) => (
            <li key={s.client}>
              <span className="text-lk-fg">{s.client}:</span> {s.text}
            </li>
          ))}
        </ul>
      )}

      {canSetTrigger ? (
        <form action={save} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={routine.id} />
          <input type="hidden" name="kind" value={kind} />
          <fieldset className="flex flex-col gap-2">
            <legend className={`${monoLabel} mb-1.5`}>Started by</legend>
            {choices.map(([value, text]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="trigger-choice" checked={kind === value} onChange={() => setKind(value)} className="size-4 accent-lk-lime" />
                {text}
              </label>
            ))}
          </fieldset>
          {kind === "claude_routine" && (
            <>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-lk-dim">
                <li>
                  Have Claude create the routine: paste the{" "}
                  <button type="button" onClick={() => setup.setupPrompt && copy(setup.setupPrompt, "setup")} className="text-lk-lime hover:underline">
                    setup prompt
                  </button>
                  {copied === "setup" && <span className="ml-1 text-lk-lime">(copied)</span>} into a Claude chat, or create it yourself at{" "}
                  <a href="https://claude.ai/code/routines" target="_blank" rel="noreferrer" className="text-lk-lime hover:underline">claude.ai/code/routines</a>.
                </li>
                <li>Edit the routine there, add an API trigger, generate its token, and paste the URL and token here.</li>
              </ol>
              <input name="url" required defaultValue={routine.trigger === "claude_routine" ? (routine.triggerUrl ?? "") : ""} placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire" className={field} />
              <input
                name="token"
                type="password"
                autoComplete="off"
                required={routine.trigger !== "claude_routine"}
                placeholder={routine.trigger === "claude_routine" && routine.secretLast4 ? `Token ending in ${routine.secretLast4} (leave empty to keep it)` : "Trigger token"}
                className={field}
              />
            </>
          )}
          {kind === "webhook" && (
            <>
              <p className="text-lk-dim">
                Meerko POSTs a signed <span className="font-plex">{routine.when === "replies" ? "replies.waiting" : "routine.due"}</span> event with the routine and its
                brief. Point it at the Claude Agent SDK, a CI job or n8n; for replies, give that agent a drafts-only API key (Connections → API keys).
              </p>
              <input name="url" type="url" required defaultValue={routine.trigger === "webhook" ? (routine.triggerUrl ?? "") : ""} placeholder="https://your-agent.example.com/meerko" className={field} />
            </>
          )}
          <span>
            <button disabled={saving} className={buttonClass(changed ? "primary" : "secondary")}>{saving ? "Saving…" : "Save"}</button>
          </span>
        </form>
      ) : (
        <p className="text-sm text-lk-dim">Sign in with your account, not an API key, to choose what starts it.</p>
      )}
      {saved?.ok && saved.secret && (
        <div className="flex flex-col gap-2 bg-lk-lime/[0.08] p-3">
          <p className="font-semibold">Signing secret. Copy it now: it won&apos;t be shown again. Check the meerko-signature header with it.</p>
          <code className="break-all bg-lk-ink px-3 py-2 font-plex text-sm text-lk-fg">{saved.secret}</code>
        </div>
      )}
      {saved && <Notice ok={saved.ok}>{saved.ok ? (saved.message ?? "Saved") : saved.error}</Notice>}
    </div>
  );
}

function statusPill(r: Routine) {
  if (r.needsSetup) return <Pill tone="amber">needs setup</Pill>;
  if (r.status === "paused") return <Pill>{r.statusReason === "failing" ? "paused: failing" : "paused"}</Pill>;
  if (r.lastError) return <Pill tone="amber">failing</Pill>;
  return <Pill tone="solid">on</Pill>;
}

export function RoutineCard({ routine: r, canSetTrigger, hasReplies }: { routine: Routine; canSetTrigger: boolean; hasReplies: boolean }) {
  const [editing, setEditing] = useState(false);
  const [showSetup, setShowSetup] = useState(r.needsSetup || r.runs.length === 0);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult>();
  const act = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(await fn());
    });
  const meerkoStarts = r.trigger !== "own_scheduler";

  return (
    <Card>
      <CardHead
        title={r.name}
        className="gap-y-2"
      >
        <span className="flex items-center gap-3">
          {/* The latest runs, oldest on the left. */}
          <span className="flex gap-1" aria-label="Latest runs">
            {[...r.runs].reverse().map((run) => (
              <span key={run.id} title={`${OUTCOME[run.outcome].text}, ${when(run.createdAt, r.cadence?.timezone)}`} className={`size-2.5 ${OUTCOME[run.outcome].dot}`} />
            ))}
          </span>
          {statusPill(r)}
        </span>
      </CardHead>

      {editing ? (
        <RoutineForm routine={r} hasReplies={hasReplies} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-3 px-[18px] py-4 text-[15px]">
          <p className="text-lk-muted">
            <span className="text-lk-fg">{r.schedule}</span> · started by {STARTED_BY[r.trigger]}
            {r.nextDueAt && <> · next run {when(r.nextDueAt, r.cadence?.timezone)}</>}
          </p>
          <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap text-lk-dim">{r.brief}</p>
          {r.lastError && <Notice ok={false}>{r.lastError}</Notice>}
          <span className="flex flex-wrap gap-2">
            {meerkoStarts && r.status === "active" && (
              <button type="button" disabled={pending} onClick={() => act(() => runRoutine(r.id))} className={buttonClass("primary", "sm")}>Run it now</button>
            )}
            <button type="button" disabled={pending} onClick={() => act(() => setRoutineStatus(r.id, r.status === "active" ? "paused" : "active"))} className={buttonClass(r.status === "active" ? "lime" : "secondary", "sm")}>
              {r.status === "active" ? "Pause" : "Resume"}
            </button>
            <button type="button" onClick={() => setShowSetup((s) => !s)} className={buttonClass("secondary", "sm")}>{showSetup ? "Hide setup" : "How it runs"}</button>
            <button type="button" onClick={() => setEditing(true)} className={buttonClass("ghost", "sm")}>Edit</button>
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
          {result && <Notice ok={result.ok}>{result.ok ? (result.message ?? "Done") : result.error}</Notice>}
        </div>
      )}

      {showSetup && !editing && <HowItRuns routine={r} canSetTrigger={canSetTrigger} />}

      {r.runs.length > 0 && (
        <ul className="border-t border-lk-line">
          {r.runs.slice(0, 5).map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-lk-line px-[18px] py-2.5 text-[14px] last:border-0">
              <span className="w-20 shrink-0 font-plex text-[12px] text-lk-dim">{formatWhen(run.createdAt)}</span>
              <Pill tone={OUTCOME[run.outcome].tone}>{OUTCOME[run.outcome].text}</Pill>
              <span className="text-lk-dim">
                {run.reason === "replies" ? `${run.replies ?? 0} ${run.replies === 1 ? "reply" : "replies"}` : run.reason === "manual" ? "run by hand" : run.reason === "ai" ? "started by your AI" : "scheduled"}
              </span>
              {run.error && <span className="min-w-0 flex-1 text-[#e5795b]">{run.error}</span>}
              {run.sessionUrl && (
                <a href={run.sessionUrl} target="_blank" rel="noreferrer" className="ml-auto font-plex text-[12px] text-lk-lime uppercase hover:underline">
                  Watch in Claude
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
