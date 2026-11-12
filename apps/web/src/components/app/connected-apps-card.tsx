"use client";

import { Bot } from "lucide-react";
import { useState, useTransition } from "react";
import type { ConnectedApp } from "@meerko/sdk";
import { disconnectApp } from "@/app/app/actions";
import { CopyButton } from "@/app/app/settings/dialog";
import { outcome, row, SectionHead } from "@/app/app/settings/parts";
import { buttonClass, Card, formatWhen, headLink, monoLabel } from "@/components/app/ui";

/** Connections → Your agent: agents and the CLI that signed in with OAuth. Disconnecting ends their access at once. */
export function ConnectedAppsCard({ apps, canManage, mcpUrl }: { apps: ConnectedApp[]; canManage: boolean; /** Meerko's MCP address, shown under the list. */ mcpUrl?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <section id="agent" className="scroll-mt-6">
      <SectionHead title="Your agent" note="signed in over MCP">
        <a href="/docs/claude-code" className={headLink}>
          Setup guides →
        </a>
      </SectionHead>
      <Card>
        {apps.length === 0 && <p className="border-b border-lk-line px-4 py-4 text-[13px] text-lk-muted last:border-0">No agent connected yet.</p>}
        {apps.map((a) => (
          <div key={a.id} className={row}>
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-lk-line bg-white text-lk-muted">
              <Bot className="size-4" />
            </span>
            <span className="flex min-w-[min(100%,200px)] flex-1 flex-col gap-0.5">
              <span className="text-[13.5px] font-medium text-lk-fg">{a.name}</span>
              <span className="truncate text-[12px] text-lk-dim">
                by {a.userEmail} · connected {formatWhen(a.createdAt)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-lk-muted">
              {a.lastUsedAt && <span className="size-1.5 rounded-full bg-ws-green" />}
              {a.lastUsedAt ? `used ${formatWhen(a.lastUsedAt)}` : "never used"}
            </span>
            {canManage && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Disconnect ${a.name}? It loses access to this workspace right away.`)) return;
                  start(async () => {
                    const res = await disconnectApp(a.id);
                    setError(res.ok ? undefined : res.error);
                  });
                }}
                className={buttonClass("ghost", "sm")}
                aria-label={`Disconnect ${a.name}`}
              >
                Disconnect
              </button>
            )}
          </div>
        ))}
        {mcpUrl && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-lk-line bg-lk-frame px-4 py-3 first:border-0">
            <span className={monoLabel}>MCP address</span>
            <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[12.5px] whitespace-nowrap text-lk-fg">{mcpUrl}</code>
            <CopyButton text={mcpUrl} />
          </div>
        )}
        {error && (
          <p role="alert" className={outcome(false)}>
            {error}
          </p>
        )}
      </Card>
    </section>
  );
}
