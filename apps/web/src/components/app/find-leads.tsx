"use client";

import { Search } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { findLeads } from "@/app/app/actions";
import { buttonClass, field, fieldLabel } from "./ui";


function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      {children}
      {hint && <span className="text-[14px] leading-snug text-lk-dim">{hint}</span>}
    </label>
  );
}

/**
 * Search people or companies, count them for free, then save some into a table. `credits` is the balance on Meerko
 * Cloud, or null where searches aren't metered (self-hosting, or the workspace's own Icypeas key).
 */
export function FindLeads({ tables, credits }: { tables: { id: string; name: string }[]; credits: number | null }) {
  const [kind, setKind] = useState<"people" | "companies">("people");
  const [tableId, setTableId] = useState("");
  const [intent, setIntent] = useState<"count" | "add">("count");
  const [state, dispatch, pending] = useActionState(findLeads, null);
  const people = kind === "people";
  // Shown beside the button that was pressed: at the bottom of a long form it's off-screen on a phone.
  const error = (forIntent: "count" | "add") =>
    state && !state.ok && intent === forIntent ? (
      <p role="alert" className="basis-full text-[15px] text-[#e5795b]">
        {state.error}
      </p>
    ) : null;

  // Submitted by hand rather than with `action={…}`, which resets the form afterwards: counting shouldn't clear the
  // filters you're refining. The submitter carries `intent` (count or add).
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setIntent(data.get("intent") === "add" ? "add" : "count");
    startTransition(() => dispatch(data));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 text-[15px] text-lk-fg">
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Search for" className="inline-flex w-fit outline outline-1 -outline-offset-1 outline-lk-line">
        {(["people", "companies"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`px-4 py-[9px] font-plex text-[13px] tracking-[0.6px] uppercase ${kind === k ? "bg-lk-lime font-semibold text-lk-ink" : "text-lk-muted hover:text-lk-fg"}`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {people ? (
          <>
            <Field label="Job titles" hint="Comma-separated. Add variants and other languages: CTO, Chief Technology Officer, Director de Tecnología.">
              <input name="titles" className={field} placeholder="CTO, VP Engineering" />
            </Field>
            <Field label="Exclude titles" hint="Comma-separated.">
              <input name="excludeTitles" className={field} placeholder="Intern, Assistant" />
            </Field>
          </>
        ) : (
          <Field label="Company names" hint="Comma-separated.">
            <input name="names" className={field} placeholder="Acme, Globex" />
          </Field>
        )}
        <Field label={people ? "Location" : "Headquarters"} hint="Country codes, comma-separated: ES, US, GB.">
          <input name="location" className={field} placeholder="ES" />
        </Field>
        <Field label="Industry" hint={'LinkedIn industry names: "Software Development", "Financial Services".'}>
          <input name="industry" className={field} placeholder="Software Development" />
        </Field>
        <Field label="Keywords" hint="Comma-separated, matched against profiles.">
          <input name="keywords" className={field} placeholder="fintech, payments" />
        </Field>
        <Field label={people ? "Company headcount" : "Headcount"}>
          <span className="flex items-center gap-2">
            <input name="minHeadcount" type="number" min={0} className={field} placeholder="Min" />
            <span className="text-lk-dim">to</span>
            <input name="maxHeadcount" type="number" min={0} className={field} placeholder="Max" />
          </span>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button name="intent" value="count" disabled={pending} className={buttonClass("secondary")}>
          <Search className="size-[15px]" />
          {pending && intent === "count" ? "Counting…" : "Count matches"}
        </button>
        <span className="text-[14px] text-lk-dim">Counting is free.</span>
        {state?.ok && state.total !== undefined && (
          <span aria-live="polite" className="font-plex text-[14px] font-semibold tracking-[0.6px] text-lk-lime uppercase">
            {state.total.toLocaleString("en")} {state.total === 1 ? "match" : "matches"}
          </span>
        )}
        {error("count")}
      </div>

      <div className="flex flex-col gap-4 bg-lk-ink p-4 outline outline-1 -outline-offset-1 outline-lk-line">
        <p className="font-pixel text-[13px] uppercase">Add them to a table</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="How many" hint={credits === null ? "Up to 1,000 at a time." : `1 credit each. You have ${credits.toLocaleString("en")}.`}>
            <input name="limit" type="number" min={1} max={1000} defaultValue={25} required className={field} />
          </Field>
          <Field label="Table">
            <select name="tableId" value={tableId} onChange={(e) => setTableId(e.target.value)} className={field}>
              <option value="">A new table</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {!tableId && (
            <Field label="New table name" hint="Optional.">
              <input name="tableName" className={field} placeholder="Named after your search" />
            </Field>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button name="intent" value="add" disabled={pending} className={buttonClass("primary")}>
            {pending && intent === "add" ? "Adding…" : "Find and add"}
          </button>
          <span className="text-[14px] text-lk-dim">Then use Find &amp; verify emails on the table.</span>
          {error("add")}
        </div>
      </div>

    </form>
  );
}
