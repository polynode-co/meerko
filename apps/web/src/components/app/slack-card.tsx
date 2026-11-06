"use client";

import { useActionState, useState, useTransition } from "react";
import type { SlackConnection } from "@meerko/sdk";
import { installSlack, removeSlack, saveSlackWebhook, testSlack } from "@/app/app/actions";
import { buttonClass, Card, formatWhen, Pill, cardTitle } from "@/components/app/ui";

const inputClass = "min-w-0 flex-1 bg-lk-ink px-3 py-2 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime text-[15px]";

/**
 * Posts new replies and the agent's drafts to a Slack channel. With the Meerko Slack app, drafts carry Approve and
 * Discard buttons and `/meerko` shows what's waiting; a pasted incoming webhook only posts.
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
    <Card id="slack">
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>Slack</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-lk-muted">
          Meerko posts new replies and your agent&apos;s drafts to a channel.
          {appAvailable ? " With the Meerko app you approve or discard each draft right there, and /meerko shows what's waiting." : ""}{" "}
          <a href="/docs/slack" className="text-lk-lime hover:underline">How it works</a>.
        </p>
      </div>

      {notice && <p className="border-b border-lk-line px-[18px] py-3 text-[15px] text-lk-dim">{notice}</p>}

      {connection ? (
        <div className="flex flex-wrap items-center gap-4 border-b border-lk-line px-[18px] py-4">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-medium">{connection.kind === "app" ? "Meerko Slack app" : "Incoming webhook"}</span>
            <span className="truncate text-sm text-lk-dim">Posting to {where}</span>
            {connection.lastError && <span className="text-sm text-[#e5795b]">{connection.lastError}</span>}
          </span>
          <span className="font-plex text-sm text-lk-dim">{connection.lastPostedAt ? `posted ${formatWhen(connection.lastPostedAt)}` : "nothing posted yet"}</span>
          <Pill tone={!connection.enabled ? "neutral" : connection.lastError ? "amber" : "signal"}>{!connection.enabled ? "off" : connection.lastError ? "failing" : "on"}</Pill>
          {canManage && (
            <span className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => act(testSlack)} className={buttonClass()}>Send test</button>
              {!connection.enabled && connection.kind === "app" && (
                <button type="button" disabled={pending} onClick={install} className={buttonClass()}>Reconnect</button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Stop posting to Slack?")) return;
                  act(removeSlack);
                }}
                className={buttonClass("ghost")}
              >
                Disconnect
              </button>
            </span>
          )}
        </div>
      ) : (
        canManage && (
          <div className="flex flex-col gap-3 border-b border-lk-line px-[18px] py-4 text-[15px]">
            {appAvailable && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" disabled={pending} onClick={install} className={buttonClass("primary")}>Add to Slack</button>
                <span className="text-lk-dim">Pick the channel on Slack&apos;s page. Approving works for people whose Slack email matches their Meerko login.</span>
              </div>
            )}
            {appAvailable && !webhookOpen && (
              <button type="button" onClick={() => setWebhookOpen(true)} className="self-start text-sm text-lk-dim hover:text-lk-fg">
                Or paste an incoming webhook (posts only, no buttons)
              </button>
            )}
            {webhookOpen && (
              <form action={save} className="flex flex-col gap-2">
                <p className="text-lk-dim">
                  Create an incoming webhook in Slack and paste its URL. Meerko posts there, with links to the inbox; approving happens in
                  Meerko.
                </p>
                <div className="flex flex-wrap gap-2">
                  <input name="url" type="url" required placeholder="https://hooks.slack.com/services/…" className={inputClass} />
                  <button disabled={saving} className={buttonClass(appAvailable ? "secondary" : "primary")}>{saving ? "Connecting…" : "Connect"}</button>
                </div>
              </form>
            )}
          </div>
        )
      )}

      {saved && !saved.ok && <p role="alert" className="border-b border-lk-line px-[18px] py-3 text-[15px] text-[#e5795b]">{saved.error}</p>}
      {saved?.ok && <p role="status" className="border-b border-lk-line px-[18px] py-3 text-[15px] text-lk-lime">{saved.message}</p>}
      {result && (
        <p role="status" className={`border-b border-lk-line px-[18px] py-3 text-[15px] ${result.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{result.text}</p>
      )}
      {!canManage && <p className="px-[18px] py-3 text-sm text-lk-dim">Sign in with your account, not an API key, to set this up.</p>}
    </Card>
  );
}
