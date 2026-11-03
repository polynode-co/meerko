"use client";

import { Search } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import { findLeads } from "@/app/app/actions";
import { buttonClass } from "./ui";

const field = "rounded-lg border border-line bg-ink px-3 py-2 text-[13px] outline-none focus:border-accent/70";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
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

  // Submitted by hand rather than with `action={…}`, which resets the form afterwards: counting shouldn't clear the
  // filters you're refining. The submitter carries `intent` (count or add).
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    setIntent(data.get("intent") === "add" ? "add" : "count");
    startTransition(() => dispatch(data));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 text-[13px]">
      <input type="hidden" name="kind" value={kind} />
      <div role="radiogroup" aria-label="Search for" className="inline-flex w-fit rounded-lg border border-line p-0.5">
        {(["people", "companies"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-md px-3.5 py-1.5 font-semibold capitalize ${kind === k ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"}`}
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
            <input name="minHeadcount" type="number" min={0} className={`${field} w-full`} placeholder="Min" />
            <span className="text-muted">to</span>
            <input name="maxHeadcount" type="number" min={0} className={`${field} w-full`} placeholder="Max" />
          </span>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button name="intent" value="count" disabled={pending} className={buttonClass("secondary")}>
          <Search className="size-[15px]" />
          {pending && intent === "count" ? "Counting…" : "Count matches"}
        </button>
        <span className="text-xs text-muted">Counting is free.</span>
        {state?.ok && state.total !== undefined && (
          <span aria-live="polite" className="font-semibold text-fg">
            {state.total.toLocaleString("en")} {state.total === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-line bg-raised p-4">
        <p className="font-semibold">Add them to a table</p>
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
            <Field label="New table name">
              <input name="tableName" className={field} placeholder={people ? "Fintech CTOs, Spain" : "Fintech companies"} />
            </Field>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button name="intent" value="add" disabled={pending} className={buttonClass("primary")}>
            {pending && intent === "add" ? "Adding…" : "Find and add"}
          </button>
          <span className="text-xs text-muted">Then use Find &amp; verify emails on the table.</span>
        </div>
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-xs text-[#e5795b]">
          {state.error}
        </p>
      )}
    </form>
  );
}
