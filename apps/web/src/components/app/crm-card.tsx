"use client";

import { useActionState, useState, useTransition } from "react";
import type { CrmConnection } from "@meerko/sdk";
import { connectCrm, removeCrm, setCrmAutoSync } from "@/app/app/actions";
import { Switch } from "@/app/app/settings/dialog";
import { outcome, SectionHead } from "@/app/app/settings/parts";
import { buttonClass, Card, field, formatWhen, headLink, Pill } from "@/components/app/ui";

const NAMES = { hubspot: "HubSpot", attio: "Attio" } as const;

/** Connections → CRM: pushes the leads Meerko contacts to HubSpot or Attio, matched by email. */
export function CrmCard({ connection, canManage }: { connection: CrmConnection | null; canManage: boolean }) {
  const [saved, save, saving] = useActionState(connectCrm, null);
  const [provider, setProvider] = useState<"hubspot" | "attio">("hubspot");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string }>();
  const [replacing, setReplacing] = useState(false);

  const act = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setResult(res.ok ? { ok: true, text: res.message ?? "Done" } : { ok: false, text: res.error });
    });

  const form = (
    <form action={save} className="flex flex-col gap-2.5 px-4 py-3.5">
      <div className="inline-flex self-start rounded-md border border-lk-line bg-white p-0.5" role="radiogroup" aria-label="CRM">
        {(["hubspot", "attio"] as const).map((p) => (
          <label
            key={p}
            className="cursor-pointer rounded px-2.5 py-[5px] text-[12.5px] text-lk-muted transition hover:text-lk-fg has-[:checked]:bg-lk-fg has-[:checked]:font-medium has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lk-gray"
          >
            <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="sr-only" />
            {NAMES[p]}
          </label>
        ))}
      </div>
      <p className="text-[12px] leading-relaxed text-lk-dim">
        {provider === "hubspot"
          ? "A HubSpot service key (Development → Keys → Service keys) with contacts read and write, plus crm.schemas.contacts.read. A private app token works too."
          : "An Attio API key with read-write access to records and read access to objects."}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          name="token"
          type="password"
          required
          autoComplete="off"
          placeholder={provider === "hubspot" ? "HubSpot service key" : "Attio API key"}
          aria-label={provider === "hubspot" ? "HubSpot service key" : "Attio API key"}
          className={`${field} flex-1 font-mono`}
        />
        <button disabled={saving} className={buttonClass("secondary")}>
          {saving ? "Checking…" : "Connect"}
        </button>
      </div>
    </form>
  );

  return (
    <section id="crm" className="min-w-0 scroll-mt-6">
      <SectionHead title="CRM">
        <a href="/docs/crm" className={headLink}>
          How it works →
        </a>
      </SectionHead>
      <Card>
        {connection && (
          <>
            <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-lk-line px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-lk-fg">
                  {NAMES[connection.provider]}
                  {connection.accountName ? ` · ${connection.accountName}` : ""}
                  <Pill tone={!connection.autoSync ? "neutral" : connection.lastError ? "amber" : "signal"}>{connection.autoSync ? "auto-sync on" : "manual only"}</Pill>
                </span>
                <span className="truncate font-mono text-[11px] text-lk-dim">
                  token …{connection.last4} · {connection.lastSyncedAt ? `synced ${formatWhen(connection.lastSyncedAt)}` : "nothing synced yet"}
                </span>
                {connection.lastError && <span className="text-[12px] text-ws-red">{connection.lastError}</span>}
              </span>
            </div>
            {canManage && (
              <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-lk-line px-4 py-2.5 last:border-0">
                <span className="text-[13.5px] text-lk-fg">Auto-sync</span>
                <Switch
                  on={connection.autoSync}
                  disabled={pending}
                  onClick={() => act(() => setCrmAutoSync(!connection.autoSync))}
                  label={connection.autoSync ? "Turn auto-sync off" : "Turn auto-sync on"}
                />
                <span className="ml-auto flex flex-wrap gap-1">
                  <button type="button" disabled={pending} onClick={() => setReplacing((r) => !r)} className={buttonClass("ghost", "sm")}>
                    Replace token
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Stop pushing leads to the CRM? Contacts already there stay.")) return;
                      act(removeCrm);
                    }}
                    className={buttonClass("ghost", "sm")}
                  >
                    Disconnect
                  </button>
                </span>
              </div>
            )}
          </>
        )}

        {!connection && <p className="px-4 pt-3.5 text-[13px] text-lk-muted">Leads Meerko emails go to your CRM as contacts, matched by email.</p>}
        {canManage && (!connection || replacing) && form}
        {!connection && !canManage && <p className="px-4 py-3 text-[12px] text-lk-dim">Sign in with your account, not an API key, to connect one.</p>}

        {saved && !saved.ok && (
          <p role="alert" className={outcome(false)}>
            {saved.error}
          </p>
        )}
        {saved?.ok && (
          <p role="status" className={outcome(true)}>
            {saved.message}
          </p>
        )}
        {result && (
          <p role="status" className={outcome(result.ok)}>
            {result.text}
          </p>
        )}
      </Card>
    </section>
  );
}
