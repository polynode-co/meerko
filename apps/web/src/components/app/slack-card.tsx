"use client";

import { useActionState, useState, useTransition } from "react";
import type { SlackConnection } from "@meerko/sdk";
import { installSlack, removeSlack, saveSlackWebhook, testSlack } from "@/app/app/actions";
import { buttonClass, field, formatWhen, Pill } from "@/components/app/ui";

const line = "px-4 py-2.5 text-[13px]";

/**
 * Connections → Notifications: posts new replies and the agent's drafts to a Slack channel. With the Meerko Slack app,
 * drafts carry Approve and Discard buttons and `/meerko` shows what's waiting; a pasted incoming webhook only posts.
 * Rendered as a block inside the Notifications card.
 */
export function SlackCard({
  connection,
  appAvailable,
  canManage,
  notice,
}: {
  connection: SlackConnection | null;
  appAvailable: boolean;
  canManage: boolean;
  notice?: string;
}) {
  const [saved, save, saving] = useActionState(saveSlackWebhook, null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  const [webhookOpen, setWebhookOpen] = useState(!appAvailable);

  const act = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setResult(res.ok ? { ok: true, text: res.message ?? "Done" } : { ok: false, text: res.error });
    });
  const install = () =>
    start(async () => {
      const res = await installSlack();
      if (res.ok) window.location.href = res.url;
      else setResult({ ok: false, text: res.error });
    });

  const where = connection?.kind === "app" ? `#${connection.channelName ?? "channel"} in ${connection.teamName ?? "Slack"}` : "an incoming webhook";

  return (
    <div id="slack" className="scroll-mt-6 border-b border-lk-line last:border-0">
      {connection ? (
        <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="flex min-w-[min(100%,180px)] flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2 text-[13.5px] font-medium text-lk-fg">
              Slack
              <Pill tone={!connection.enabled ? "neutral" : connection.lastError ? "amber" : "signal"}>{!connection.enabled ? "off" : connection.lastError ? "failing" : "connected"}</Pill>
            </span>
            <span className="truncate font-mono text-[11px] text-lk-dim">
              {where} · {connection.kind === "app" ? "Meerko Slack app" : "posts only"} · {connection.lastPostedAt ? `posted ${formatWhen(connection.lastPostedAt)}` : "nothing posted yet"}
            </span>
            {connection.lastError && <span className="text-[12px] text-ws-red">{connection.lastError}</span>}
          </span>
          {canManage && (
            <span className="flex flex-wrap gap-1.5">
              <button type="button" disabled={pending} onClick={() => act(testSlack)} className={buttonClass("secondary", "sm")}>
                Send test
              </button>
              {!connection.enabled && connection.kind === "app" && (
                <button type="button" disabled={pending} onClick={install} className={buttonClass("secondary", "sm")}>
                  Reconnect
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Stop posting to Slack?")) return;
                  act(removeSlack);
                }}
                className={buttonClass("ghost", "sm")}
              >
                Disconnect
              </button>
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex min-w-[min(100%,180px)] flex-1 flex-col gap-0.5">
              <span className="text-[13.5px] font-medium text-lk-fg">Slack</span>
              <span className="text-[12px] text-lk-dim">
                New replies and drafts in a channel{appAvailable ? ", approved right there" : ""}.{" "}
                <a href="/docs/slack" className="text-lk-muted underline underline-offset-2 hover:text-lk-fg">
                  How it works
                </a>
              </span>
            </span>
            {canManage && appAvailable && (
              <button type="button" disabled={pending} onClick={install} className={buttonClass("secondary", "sm")}>
                Add to Slack
              </button>
            )}
          </div>
          {canManage && appAvailable && !webhookOpen && (
            <button type="button" onClick={() => setWebhookOpen(true)} className="self-start text-[12px] text-lk-dim hover:text-lk-fg">
              Or paste an incoming webhook (posts only, no buttons)
            </button>
          )}
          {canManage && webhookOpen && (
            <form action={save} className="flex flex-wrap gap-2">
              <input name="url" type="url" required placeholder="https://hooks.slack.com/services/…" aria-label="Slack incoming webhook URL" className={`${field} flex-1 font-mono text-[12px]`} />
              <button disabled={saving} className={buttonClass("secondary")}>
                {saving ? "Connecting…" : "Connect"}
              </button>
            </form>
          )}
          {!canManage && <p className="text-[12px] text-lk-dim">Sign in with your account, not an API key, to set this up.</p>}
        </div>
      )}

      {notice && <p className={`border-t border-lk-line ${line} text-lk-muted`}>{notice}</p>}
      {saved && !saved.ok && (
        <p role="alert" className={`border-t border-lk-line ${line} text-ws-red`}>
          {saved.error}
        </p>
      )}
      {saved?.ok && (
        <p role="status" className={`border-t border-lk-line ${line} text-ws-green`}>
          {saved.message}
        </p>
      )}
      {result && (
        <p role="status" className={`border-t border-lk-line ${line} ${result.ok ? "text-ws-green" : "text-ws-red"}`}>
          {result.text}
        </p>
      )}
      {connection && !canManage && <p className={`border-t border-lk-line ${line} text-lk-dim`}>Sign in with your account, not an API key, to set this up.</p>}
    </div>
  );
}
