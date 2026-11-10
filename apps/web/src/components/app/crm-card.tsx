"use client";

import { useActionState, useState, useTransition } from "react";
import type { CrmConnection } from "@meerko/sdk";
import { connectCrm, removeCrm, setCrmAutoSync } from "@/app/app/actions";
import { buttonClass, Card, cardTitle, formatWhen, Pill } from "@/components/app/ui";

const inputClass = "min-w-0 flex-1 bg-lk-ink px-3 py-2 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime text-[15px]";

const NAMES = { hubspot: "HubSpot", attio: "Attio" } as const;

/** Pushes the leads Meerko contacts to HubSpot or Attio, matched by email. */
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
    <form action={save} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="CRM">
        {(["hubspot", "attio"] as const).map((p) => (
          <label key={p} className={buttonClass(provider === p ? "primary" : "secondary")}>
            <input type="radio" name="provider" value={p} checked={provider === p} onChange={() => setProvider(p)} className="sr-only" />
            {NAMES[p]}
          </label>
        ))}
      </div>
      <p className="text-lk-dim">
        {provider === "hubspot"
          ? "Create a service key in HubSpot (Development → Keys → Service keys) with the contacts read and write scopes, plus crm.schemas.contacts.read so the stage lands in Lead status. A private app token you already have works too."
          : "Create an API key in Attio's developer settings with read-write access to records and read access to objects."}
      </p>
      <div className="flex flex-wrap gap-2">
        <input name="token" type="password" required autoComplete="off" placeholder={provider === "hubspot" ? "HubSpot service key" : "Attio API key"} className={inputClass} />
        <button disabled={saving} className={buttonClass("primary")}>{saving ? "Checking…" : "Connect"}</button>
      </div>
    </form>
  );

  return (
    <Card id="crm">
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>CRM</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-lk-muted">
          Leads Meerko emails go to your CRM as contacts, matched by email, and again whenever their stage changes.{" "}
          <a href="/docs/crm" className="text-lk-lime hover:underline">How it works</a>.
        </p>
      </div>

      {connection && (
        <div className="flex flex-wrap items-center gap-4 border-b border-lk-line px-[18px] py-4">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-medium">{connection.accountName ?? NAMES[connection.provider]}</span>
            <span className="truncate font-plex text-sm text-lk-dim">token …{connection.last4}</span>
            {connection.lastError && <span className="text-sm text-[#e5795b]">{connection.lastError}</span>}
          </span>
          <span className="font-plex text-sm text-lk-dim">{connection.lastSyncedAt ? `synced ${formatWhen(connection.lastSyncedAt)}` : "nothing synced yet"}</span>
          <Pill tone={!connection.autoSync ? "neutral" : connection.lastError ? "amber" : "signal"}>{connection.autoSync ? "auto-sync on" : "manual only"}</Pill>
          {canManage && (
            <span className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => act(() => setCrmAutoSync(!connection.autoSync))} className={buttonClass()}>
                {connection.autoSync ? "Turn auto-sync off" : "Turn auto-sync on"}
              </button>
              <button type="button" disabled={pending} onClick={() => setReplacing((r) => !r)} className={buttonClass()}>
                Replace token
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Stop pushing leads to the CRM? Contacts already there stay.")) return;
                  act(removeCrm);
                }}
                className={buttonClass("ghost")}
              >
                Disconnect
              </button>
            </span>
          )}
        </div>
      )}

      {canManage && (!connection || replacing) && <div className="flex flex-col gap-3 border-b border-lk-line px-[18px] py-4 text-[15px]">{form}</div>}

      {saved && !saved.ok && <p role="alert" className="border-b border-lk-line px-[18px] py-3 text-[15px] text-[#e5795b]">{saved.error}</p>}
      {saved?.ok && <p role="status" className="border-b border-lk-line px-[18px] py-3 text-[15px] text-lk-lime">{saved.message}</p>}
      {result && (
        <p role="status" className={`border-b border-lk-line px-[18px] py-3 text-[15px] ${result.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{result.text}</p>
      )}
    </Card>
  );
}
