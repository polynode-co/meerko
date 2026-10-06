"use client";

import { Terminal, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import type { ApiKey } from "@meerko/sdk";
import { createApiKey, revokeApiKey } from "@/app/app/actions";
import { buttonClass, Card, formatWhen } from "@/components/app/ui";

/** Keys for the CLI, MCP server and scripts. A new key is shown once; Meerko keeps only its prefix. */
export function ApiKeysCard({ keys, apiUrl, canManage }: { keys: ApiKey[]; apiUrl: string; canManage: boolean }) {
  const [created, create, creating] = useActionState(createApiKey, null);
  const [revoking, startRevoke] = useTransition();
  const [error, setError] = useState<string>();
  const loginCommand = created?.key ? `npx meerko login --key ${created.key} --url ${apiUrl}` : null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Terminal className="size-4 text-accent" />API keys</h2>
        <p className="mt-1 text-[13px] text-muted">For the CLI, the MCP server and your own scripts. Each key can do anything in this workspace.</p>
      </div>

      {canManage && (
        <form action={create} className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <input
            name="name"
            required
            maxLength={100}
            placeholder="Name, e.g. laptop or claude-code"
            className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent"
          />
          <button disabled={creating} className={buttonClass("primary")}>{creating ? "Creating…" : "Create key"}</button>
        </form>
      )}

      {loginCommand && (
        <div className="flex flex-col gap-2 border-b border-line bg-accent-soft px-5 py-4 text-[13px]">
          <p className="font-semibold">Copy it now: it won&apos;t be shown again.</p>
          <code className="break-all rounded-md border border-line bg-ink px-3 py-2 font-mono text-xs">{loginCommand}</code>
        </div>
      )}
      {(created && !created.ok) || error ? (
        <p role="alert" className="border-b border-line px-5 py-3 text-[13px] text-[#e5795b]">{created && !created.ok ? created.error : error}</p>
      ) : null}

      {keys.length === 0 && <p className="px-5 py-6 text-[13px] text-muted">No API keys yet.</p>}
      {keys.map((k) => (
        <div key={k.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3 last:border-0">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13px] font-medium">{k.name}</span>
            <span className="font-mono text-[11px] text-muted">{k.prefix}…</span>
          </span>
          <span className="font-mono text-xs text-muted">{k.lastUsedAt ? `used ${formatWhen(k.lastUsedAt)}` : "never used"}</span>
          {canManage && (
            <button
              type="button"
              disabled={revoking}
              onClick={() => {
                if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working.`)) return;
                startRevoke(async () => {
                  const res = await revokeApiKey(k.id);
                  setError(res.ok ? undefined : res.error);
                });
              }}
              className={buttonClass("ghost")}
              aria-label={`Revoke ${k.name}`}
            >
              <Trash2 className="size-3.5" /> Revoke
            </button>
          )}
        </div>
      ))}
      {!canManage && <p className="px-5 py-3 text-xs text-muted">Sign in with Google to create or revoke keys.</p>}
    </Card>
  );
}
