"use client";

import { BellRing } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import type { AgentHook } from "@meerko/sdk";
import { enableAgentHook, removeAgentHook, saveAgentHook, testAgentHook } from "@/app/app/actions";
import { buttonClass, Card, formatWhen, Pill } from "@/components/app/ui";
import { ROUTINE_PROMPT, routineSetupPrompt } from "@/lib/agent-hook";

const inputClass = "min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent";

/**
 * Where Meerko rings the user's own agent when replies arrive: a Claude Code routine or any webhook. The agent
 * drafts the answers; they wait in the inbox for approval.
 */
export function AgentHookCard({ hook, drafterUrl, canManage }: { hook: AgentHook | null; drafterUrl: string; canManage: boolean }) {
  const [saved, save, saving] = useActionState(saveAgentHook, null);
  const [kind, setKind] = useState<AgentHook["kind"]>(hook?.kind ?? "claude_routine");
  const [editing, setEditing] = useState(!hook);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  const [copied, setCopied] = useState<string>();
  // Close the form once a save goes through; the saved hook shows above it.
  useEffect(() => {
    if (saved?.ok) setEditing(false);
  }, [saved]);

  const act = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setResult(res.ok ? { ok: true, text: res.message ?? "Done" } : { ok: false, text: res.error });
    });
  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => setCopied(what),
      () => setCopied(undefined),
    );

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><BellRing className="size-4 text-accent" />Wake your agent</h2>
        <p className="mt-1 text-[13px] text-muted">
          When people reply, Meerko calls your own agent so it drafts the answers while you&apos;re away. Drafts wait in the inbox for
          you to approve; the agent can&apos;t send anything. <a href="/docs/wake-your-agent" className="text-accent hover:underline">How it works</a>.
        </p>
      </div>

      {hook && (
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-medium">{hook.kind === "claude_routine" ? "Claude Code routine" : "Webhook"}</span>
            <span className="truncate font-mono text-[11px] text-muted">{hook.url}</span>
            {hook.lastError && <span className="text-xs text-[#e5795b]">{hook.lastError}</span>}
          </span>
          <span className="font-mono text-xs text-muted">{hook.lastFiredAt ? `called ${formatWhen(hook.lastFiredAt)}` : "not called yet"}</span>
          <Pill tone={!hook.enabled ? "neutral" : hook.lastError ? "amber" : "signal"}>{!hook.enabled ? "off" : hook.lastError ? "failing" : "on"}</Pill>
          {canManage && (
            <span className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => act(testAgentHook)} className={buttonClass()}>Send test</button>
              {!hook.enabled && (
                <button type="button" disabled={pending} onClick={() => act(enableAgentHook)} className={buttonClass()}>Turn on</button>
              )}
              <button type="button" onClick={() => setEditing((e) => !e)} className={buttonClass("ghost")}>{editing ? "Cancel" : "Change"}</button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Stop waking your agent when replies arrive?")) return;
                  act(removeAgentHook);
                }}
                className={buttonClass("ghost")}
              >
                Remove
              </button>
            </span>
          )}
        </div>
      )}

      {canManage && editing && (
        <form action={save} className="flex flex-col gap-3 border-b border-line px-5 py-4 text-[13px]">
          {/* React resets a form after its action runs; the kind lives in state so the radios can't drift from it. */}
          <input type="hidden" name="kind" value={kind} />
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">Agent</legend>
            {(
              [
                ["claude_routine", "Claude Code routine"],
                ["webhook", "Webhook (any agent)"],
              ] as const
            ).map(([value, text]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="agent-kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="size-4 accent-[#f2a93b]" />
                {text}
              </label>
            ))}
          </fieldset>

          {kind === "claude_routine" ? (
            <>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted">
                <li>
                  In claude.ai, add a custom connector with this URL. It can only read replies and save drafts:{" "}
                  <button type="button" onClick={() => copy(drafterUrl, "url")} className="font-mono text-fg hover:text-accent">{drafterUrl}</button>
                  {copied === "url" && <span className="ml-2 text-signal">copied</span>}
                </li>
                <li>
                  Have Claude create the routine: paste the{" "}
                  <button type="button" onClick={() => copy(routineSetupPrompt(drafterUrl), "setup")} className="text-accent hover:underline">setup prompt</button>
                  {copied === "setup" && <span className="ml-1 text-signal">(copied)</span>} into a Claude chat or <span className="font-mono">/schedule</span>.
                  Or create it yourself with this{" "}
                  <button type="button" onClick={() => copy(ROUTINE_PROMPT, "prompt")} className="text-accent hover:underline">prompt</button>
                  {copied === "prompt" && <span className="ml-1 text-signal">(copied)</span>}.
                </li>
                <li>
                  At{" "}
                  <a href="https://claude.ai/code/routines" target="_blank" rel="noreferrer" className="text-accent hover:underline">claude.ai/code/routines</a>,
                  edit the routine, add an API trigger, generate its token and paste the URL and token here.
                </li>
              </ol>
              <input name="url" required placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire" className={inputClass} />
              <input name="token" type="password" required autoComplete="off" placeholder="Trigger token" className={inputClass} />
            </>
          ) : (
            <>
              <p className="text-muted">
                Meerko POSTs a signed <span className="font-mono">replies.waiting</span> event. Point it at the Claude Agent SDK, a Cursor
                cloud agent, a CI job or n8n, and give that agent a drafts-only API key (below).
              </p>
              <input name="url" type="url" required placeholder="https://your-agent.example.com/meerko" className={inputClass} />
            </>
          )}
          <div>
            <button disabled={saving} className={buttonClass("primary")}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}

      {saved?.ok && saved.secret && (
        <div className="flex flex-col gap-2 border-b border-line bg-accent-soft px-5 py-4 text-[13px]">
          <p className="font-semibold">Signing secret. Copy it now: it won&apos;t be shown again. Check the meerko-signature header with it.</p>
          <code className="break-all rounded-md border border-line bg-ink px-3 py-2 font-mono text-xs">{saved.secret}</code>
        </div>
      )}
      {saved && !saved.ok && <p role="alert" className="border-b border-line px-5 py-3 text-[13px] text-[#e5795b]">{saved.error}</p>}
      {result && (
        <p role="status" className={`border-b border-line px-5 py-3 text-[13px] ${result.ok ? "text-signal" : "text-[#e5795b]"}`}>{result.text}</p>
      )}
      {!canManage && <p className="px-5 py-3 text-xs text-muted">Sign in with Google to set this up.</p>}
    </Card>
  );
}
