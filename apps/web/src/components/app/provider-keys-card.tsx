"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { removeProviderKey, saveProviderKey } from "@/app/app/actions";
import { buttonClass, Card } from "@/components/app/ui";

type ProviderKey = { provider: string; last4: string; createdAt: string };

const PROVIDERS = [
  { id: "icypeas", name: "Icypeas", role: "searches and email finding" },
  { id: "firecrawl", name: "Firecrawl", role: "a second try at emails Icypeas misses" },
] as const;

/** Your own Icypeas/Firecrawl keys. The API checks a key with the provider before storing it, encrypted; only the last 4 come back. */
export function ProviderKeysCard({ keys, title, children }: { keys: ProviderKey[]; title: string; children: ReactNode }) {
  const [saved, save, saving] = useActionState(saveProviderKey, null);
  const [removing, startRemove] = useTransition();
  const [confirming, setConfirming] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const stored = new Map(keys.map((k) => [k.provider, k]));

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><KeyRound className="size-4 text-accent" />{title}</h2>
        <div className="mt-1 text-[13px] text-muted">{children}</div>
      </div>

      {PROVIDERS.map((p) => {
        const k = stored.get(p.id);
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-medium">{p.name}</span>
              <span className="text-[11px] text-muted">{p.role}</span>
            </span>
            {k ? (
              <span className="font-mono text-xs">…{k.last4} <span className="text-muted">· no credits charged</span></span>
            ) : (
              <span className="text-xs text-muted">not set</span>
            )}
            {k &&
              (confirming === p.id ? (
                <span className="flex items-center gap-2 text-[13px]">
                  <span>Remove the {p.name} key?</span>
                  <button
                    type="button"
                    disabled={removing}
                    onClick={() =>
                      startRemove(async () => {
                        const res = await removeProviderKey(p.id);
                        setRemoveError(res.ok ? undefined : res.error);
                        setConfirming(undefined);
                      })
                    }
                    className={`${buttonClass("ghost")} text-[#e5795b]`}
                  >
                    {removing ? "Removing…" : "Remove"}
                  </button>
                  <button type="button" onClick={() => setConfirming(undefined)} className={buttonClass("ghost")}>Cancel</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(p.id)} className={buttonClass("ghost")} aria-label={`Remove the ${p.name} key`}>
                  <Trash2 className="size-3.5" />
                </button>
              ))}
          </div>
        );
      })}

      <form action={save} className="flex flex-wrap items-center gap-2 px-5 py-4">
        <select name="provider" defaultValue="icypeas" aria-label="Provider" className="rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent">
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          name="key"
          type="password"
          required
          minLength={8}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the API key"
          aria-label="API key"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-2 font-mono text-[13px] outline-none focus:border-accent"
        />
        <button disabled={saving} className={buttonClass("primary")}>{saving ? "Checking…" : stored.size ? "Save key" : "Add key"}</button>
        <p className="basis-full text-[11px] text-muted">Saving a key replaces the one stored for that provider. Meerko checks it with the provider first, at no cost.</p>
      </form>

      {saved?.ok && saved.message && <p role="status" className="border-t border-line px-5 py-3 text-[13px]">{saved.message}</p>}
      {(saved && !saved.ok) || removeError ? (
        <p role="alert" className="border-t border-line px-5 py-3 text-[13px] text-[#e5795b]">{saved && !saved.ok ? saved.error : removeError}</p>
      ) : null}
    </Card>
  );
}
