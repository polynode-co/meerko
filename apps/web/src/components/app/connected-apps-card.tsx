"use client";

import { Plug, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import type { ConnectedApp } from "@meerko/sdk";
import { disconnectApp } from "@/app/app/actions";
import { buttonClass, Card, formatWhen } from "@/components/app/ui";

/** Agents and the CLI that signed in with OAuth. Disconnecting ends their access at once. */
export function ConnectedAppsCard({ apps, canManage }: { apps: ConnectedApp[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Plug className="size-4 text-accent" />Connected apps</h2>
        <p className="mt-1 text-[13px] text-muted">
          Agents and the CLI you signed in to Meerko, like Claude Code. <a href="/docs/claude-code" className="text-accent hover:underline">Connect one</a>.
        </p>
      </div>
      {apps.length === 0 && <p className="px-5 py-6 text-[13px] text-muted">No apps connected yet.</p>}
      {apps.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3 last:border-0">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-medium">{a.name}</span>
            <span className="text-[11px] text-muted">by {a.userEmail} · connected {formatWhen(a.createdAt)}</span>
          </span>
          <span className="font-mono text-xs text-muted">{a.lastUsedAt ? `used ${formatWhen(a.lastUsedAt)}` : "never used"}</span>
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
              className={buttonClass("ghost")}
              aria-label={`Disconnect ${a.name}`}
            >
              <Unplug className="size-3.5" /> Disconnect
            </button>
          )}
        </div>
      ))}
      {error && <p role="alert" className="border-t border-line px-5 py-3 text-[13px] text-[#e5795b]">{error}</p>}
    </Card>
  );
}
