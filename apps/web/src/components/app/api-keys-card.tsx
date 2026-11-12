"use client";

import { EyeOff, Plus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import type { ApiKey } from "@meerko/sdk";
import { createApiKey, revokeApiKey } from "@/app/app/actions";
import { CopyButton, Modal } from "@/app/app/settings/dialog";
import { headBand, modalBody, modalFoot, outcome, row, SectionHead } from "@/app/app/settings/parts";
import { buttonClass, Card, field, fieldLabel, formatWhen, monoLabel, Pill } from "@/components/app/ui";

// "WS3 · Modal · Create API key" (z24XPW) and "… · API key created" (EkckJ) in docs/design/meerko.pen.

const SCOPES = [
  { value: "full", name: "Full access", note: "everything in this workspace" },
  { value: "replies", name: "Drafts only", note: "read replies, save drafts · for a woken agent" },
] as const;

/** Keys for the CLI, MCP server and scripts. A new key is shown once; Meerko keeps only its prefix. */
export function ApiKeysCard({ keys, apiUrl, canManage }: { keys: ApiKey[]; apiUrl: string; canManage: boolean }) {
  const [created, create, creating] = useActionState(createApiKey, null);
  const [revoking, startRevoke] = useTransition();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  // The last key the person closed the reveal dialog on, so it isn't shown again.
  const [seen, setSeen] = useState<string>();
  const newKey = created?.ok && created.key && created.key !== seen ? created.key : null;
  const loginCommand = newKey ? `pnpm meerko login --key ${newKey} --url ${apiUrl}` : null;
  const newName = newKey ? keys.find((k) => newKey.startsWith(k.prefix))?.name : undefined;
  const closeReveal = () => (setSeen(newKey ?? undefined), setOpen(false));

  return (
    <section id="api-keys" className="scroll-mt-6">
      <SectionHead title="API keys" note="for the CLI and your own scripts">
        {canManage && (
          <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>
            <Plus /> Create key
          </button>
        )}
      </SectionHead>
      <Card>
        {keys.length > 0 && (
          <div className={headBand}>
            <span className="flex-1">Name</span>
            <span className="w-[110px]">Scope</span>
            <span className="w-[130px]">Key</span>
            <span className="w-[110px]">Last used</span>
            {canManage && <span className="w-[64px]" />}
          </div>
        )}
        {keys.length === 0 && <p className="px-4 py-4 text-[13px] text-lk-muted">No API keys yet.</p>}
        {keys.map((k) => (
          <div key={k.id} className={row}>
            <span className="min-w-[min(100%,160px)] flex-1 truncate text-[13.5px] font-medium text-lk-fg">{k.name}</span>
            <span className="md:w-[110px]">
              <Pill tone={k.scope === "replies" ? "blue" : "neutral"}>{k.scope === "replies" ? "drafts only" : "full access"}</Pill>
            </span>
            <span className="truncate font-mono text-[11.5px] text-lk-muted md:w-[130px]">{k.prefix}…</span>
            <span className="font-mono text-[11.5px] text-lk-muted md:w-[110px]">{k.lastUsedAt ? `used ${formatWhen(k.lastUsedAt)}` : "never used"}</span>
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
                className={`${buttonClass("ghost", "sm")} md:w-[64px]`}
                aria-label={`Revoke ${k.name}`}
              >
                Revoke
              </button>
            )}
          </div>
        ))}
        {error && (
          <p role="alert" className={outcome(false)}>
            {error}
          </p>
        )}
        {!canManage && <p className="border-t border-lk-line px-4 py-2.5 text-[12px] text-lk-dim">Sign in with your account, not an API key, to create or revoke keys.</p>}
      </Card>

      {open && !newKey && (
        <Modal title="Create API key" onClose={() => setOpen(false)} width={520}>
          <form action={create}>
            <div className={modalBody}>
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>Name</span>
                <input name="name" required maxLength={100} autoFocus placeholder="laptop or claude-code" className={`${field} font-mono`} />
              </label>
              <fieldset className="flex flex-col gap-2">
                <legend className={`${fieldLabel} mb-1.5`}>What it can do</legend>
                {SCOPES.map((s) => (
                  <label
                    key={s.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-lk-line px-3.5 py-3 transition hover:bg-lk-frame has-[:checked]:border-lk-fg"
                  >
                    <input type="radio" name="scope" value={s.value} defaultChecked={s.value === "full"} className="size-4 accent-lk-fg" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13.5px] font-medium text-lk-fg">{s.name}</span>
                      <span className="font-mono text-[11px] text-lk-dim">{s.note}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {created && !created.ok && (
                <p role="alert" className="text-[13px] text-ws-red">
                  {created.error}
                </p>
              )}
            </div>
            <div className={modalFoot}>
              <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button disabled={creating} className={buttonClass("primary")}>
                {creating ? "Creating…" : "Create key"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {newKey && loginCommand && (
        <Modal title={newName ? `Key created: ${newName}` : "Key created"} onClose={closeReveal} width={560}>
          <div className={modalBody}>
            <p className="flex items-center gap-2.5 rounded-md bg-ws-acc-soft px-3 py-2.5 text-[13px] font-medium text-ws-acc-ink">
              <EyeOff className="size-4 shrink-0" /> Copy it now. It won&apos;t be shown again.
            </p>
            <div className="flex flex-col gap-1.5">
              <span className={monoLabel}>API key</span>
              <div className="flex items-center gap-3 rounded-md border border-lk-line bg-lk-frame px-3 py-2.5">
                <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-lk-fg">{newKey}</code>
                <CopyButton text={newKey} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={monoLabel}>CLI login · run it in your clone of the Meerko repo</span>
              <div className="flex items-start gap-3 rounded-md border border-lk-line bg-lk-frame px-3 py-2.5">
                <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all text-lk-fg">{loginCommand}</code>
                <CopyButton text={loginCommand} />
              </div>
            </div>
          </div>
          <div className={modalFoot}>
            <button type="button" onClick={closeReveal} className={buttonClass("primary")}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
