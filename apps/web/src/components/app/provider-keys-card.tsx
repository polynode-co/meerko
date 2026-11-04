"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { removeProviderKey, saveProviderKey } from "@/app/app/actions";
import { buttonClass, Card, cardTitle } from "@/components/app/ui";

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
    <Card>
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>{title}</h2>
        <div className="mt-1 text-[15px] text-lk-dim">{children}</div>
      </div>

      {PROVIDERS.map((p) => {
        const k = stored.get(p.id);
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-4 border-b border-lk-line px-[18px] py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-medium">{p.name}</span>
              <span className="text-[14px] text-lk-dim">{p.role}</span>
            </span>
            {k ? (
              <span className="font-plex text-sm">…{k.last4} <span className="text-lk-dim">· no credits charged</span></span>
            ) : (
              <span className="text-sm text-lk-dim">not set</span>
            )}
            {k &&
              (confirming === p.id ? (
                <span className="flex items-center gap-2 text-[15px]">
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
                    className={buttonClass("danger")}
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

      <form action={save} className="flex flex-wrap items-center gap-2 px-[18px] py-4">
        <select name="provider" defaultValue="icypeas" aria-label="Provider" className="bg-lk-ink px-3 py-2 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime text-[15px]">
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
          className="min-w-0 flex-1 bg-lk-ink px-3 py-2 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime font-plex text-[15px]"
        />
        <button disabled={saving} className={buttonClass("primary")}>{saving ? "Checking…" : stored.size ? "Save key" : "Add key"}</button>
        <p className="basis-full text-[12px] text-lk-dim">Saving a key replaces the one stored for that provider. Meerko checks it with the provider first, at no cost.</p>
      </form>

      {saved?.ok && saved.message && <p role="status" className="border-t border-lk-line px-[18px] py-3 text-[15px]">{saved.message}</p>}
      {(saved && !saved.ok) || removeError ? (
        <p role="alert" className="border-t border-lk-line px-[18px] py-3 text-[15px] text-[#e5795b]">{saved && !saved.ok ? saved.error : removeError}</p>
      ) : null}
    </Card>
  );
}
