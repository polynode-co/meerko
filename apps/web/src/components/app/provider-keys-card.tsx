"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { removeProviderKey, saveProviderKey } from "@/app/app/actions";
import { outcome, row, SectionHead } from "@/app/app/settings/parts";
import { buttonClass, Card, field } from "@/components/app/ui";

type ProviderKey = { provider: string; last4: string; createdAt: string };

const PROVIDERS = [
  { id: "icypeas", name: "Icypeas", role: "searches and email finding" },
  { id: "firecrawl", name: "Firecrawl", role: "second try at missed emails" },
  { id: "generect", name: "Generect", role: "phone numbers, last try at missed emails" },
] as const;

/** Your own Icypeas/Firecrawl/Generect keys. The API checks a key with the provider before storing it, encrypted; only the last 4 come back. */
/** `locked`: Meerko Cloud on Free, where own keys are a Pro feature. Stored keys show as paused and can be removed. */
export function ProviderKeysCard({ keys, title, locked = false, children }: { keys: ProviderKey[]; title: string; locked?: boolean; children: ReactNode }) {
  const [saved, save, saving] = useActionState(saveProviderKey, null);
  const [removing, startRemove] = useTransition();
  const [confirming, setConfirming] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const stored = new Map(keys.map((k) => [k.provider, k]));

  return (
    <section id="provider-keys" className="scroll-mt-6">
      <SectionHead title={title} />
      <div className="-mt-1 mb-2.5 max-w-[760px] text-[12.5px] leading-relaxed text-lk-muted">{children}</div>
      <Card>
        {PROVIDERS.map((p) => {
          const k = stored.get(p.id);
          return (
            <div key={p.id} className={row}>
              <span className="w-[110px] text-[13.5px] font-medium text-lk-fg">{p.name}</span>
              <span className="min-w-[min(100%,160px)] flex-1 text-[13px] text-lk-muted">{p.role}</span>
              {k ? (
                <span className="font-mono text-[11.5px] text-lk-fg">
                  …{k.last4} <span className="text-lk-dim">· {locked ? "paused on Free" : "no credits charged"}</span>
                </span>
              ) : (
                <span className="font-mono text-[11.5px] text-lk-dim">not set</span>
              )}
              {k &&
                (confirming === p.id ? (
                  <span className="flex items-center gap-1.5 text-[12.5px] text-lk-fg">
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
                      className={buttonClass("danger", "sm")}
                    >
                      {removing ? "Removing…" : "Remove"}
                    </button>
                    <button type="button" onClick={() => setConfirming(undefined)} className={buttonClass("ghost", "sm")}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirming(p.id)} className={`${buttonClass("ghost", "sm")} px-1.5`} aria-label={`Remove the ${p.name} key`}>
                    <Trash2 />
                  </button>
                ))}
            </div>
          );
        })}

        {!locked && (
          <form action={save} className="flex flex-wrap items-center gap-2 border-t border-lk-line bg-lk-frame px-4 py-3">
            <select name="provider" defaultValue="icypeas" aria-label="Provider" className={`${field} w-auto`}>
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
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
              className={`${field} flex-1 font-mono`}
            />
            <button disabled={saving} className={buttonClass("secondary")}>
              {saving ? "Checking…" : stored.size ? "Save key" : "Add key"}
            </button>
            <p className="basis-full font-mono text-[11px] text-lk-dim">replaces the stored key for that provider · checked with the provider first, at no cost</p>
          </form>
        )}

        {saved?.ok && saved.message && (
          <p role="status" className={outcome(true)}>
            {saved.message}
          </p>
        )}
        {(saved && !saved.ok) || removeError ? (
          <p role="alert" className={outcome(false)}>
            {saved && !saved.ok ? saved.error : removeError}
          </p>
        ) : null}
      </Card>
    </section>
  );
}
