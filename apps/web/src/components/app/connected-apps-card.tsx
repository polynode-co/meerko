"use client";

import { Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import type { ConnectedApp } from "@meerko/sdk";
import { disconnectApp } from "@/app/app/actions";
import { buttonClass, Card, formatWhen, cardTitle } from "@/components/app/ui";

/** Agents and the CLI that signed in with OAuth. Disconnecting ends their access at once. */
export function ConnectedAppsCard({ apps, canManage }: { apps: ConnectedApp[]; canManage: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Card>
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>Connected apps</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-lk-muted">
          Agents and the CLI you signed in to Meerko, like Claude Code. <a href="/docs/claude-code" className="text-lk-lime hover:underline">Connect one</a>.
        </p>
      </div>
      {apps.length === 0 && <p className="px-[18px] py-6 text-[15px] text-lk-dim">No apps connected yet.</p>}
      {apps.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-4 border-b border-lk-line px-[18px] py-3 last:border-0">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-medium">{a.name}</span>
            <span className="text-[14px] text-lk-dim">by {a.userEmail} · connected {formatWhen(a.createdAt)}</span>
          </span>
          <span className="font-plex text-sm text-lk-dim">{a.lastUsedAt ? `used ${formatWhen(a.lastUsedAt)}` : "never used"}</span>
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
      {error && <p role="alert" className="border-t border-lk-line px-[18px] py-3 text-[15px] text-[#e5795b]">{error}</p>}
    </Card>
  );
}
