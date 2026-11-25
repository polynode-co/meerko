"use client";

import { Search, Table2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";
import type { LocationCheck } from "@meerko/sdk";
import { findLeads } from "@/app/app/actions";
import { buttonClass, Card, CardHead, field, fieldLabel, monoLabel } from "./ui";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      {children}
      {hint && <span className="text-[12px] leading-snug text-lk-dim">{hint}</span>}
    </label>
  );
}

const regionName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * How the last count read each location: "Spain → ES" for countries, and a warning for a value that isn't one, which
 * Icypeas matches as text (right for a city, a silent zero for a typo).
 */
function LocationReadout({ locations }: { locations: LocationCheck[] }) {
  if (!locations.length) return null;
  const countries = locations.filter((l) => l.country);
  const others = locations.filter((l) => !l.country);
  return (
    <span aria-live="polite" className="flex flex-col gap-1">
      {countries.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {countries.map((l) => (
            <span key={l.value} className="rounded bg-ws-soft px-1.5 py-0.5 font-mono text-[11px] text-lk-fg">
              {l.value.trim().toUpperCase() === l.country ? `${l.country} · ${regionName(l.country!)}` : `${l.value} → ${l.country}`}
            </span>
          ))}
        </span>
      )}
      {others.map((l) => (
        <span key={l.value} role="status" className={`text-[12px] leading-snug ${l.suggestion ? "text-ws-red" : "text-lk-muted"}`}>
          {l.suggestion ? (
            <>
              &ldquo;{l.value}&rdquo; isn&apos;t a country we know. Did you mean {regionName(l.suggestion)} ({l.suggestion})?
            </>
          ) : (
            <>&ldquo;{l.value}&rdquo; isn&apos;t a country, so it&apos;s matched as text, like a city or region.</>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * Search people or companies, count them for free, then save some into a table. `credits` is the balance on Meerko
 * Cloud, or null where searches aren't metered (self-hosting, or the workspace's own Icypeas key). `children` goes
 * under the "Add them to a table" card.
 */
export function FindLeads({ tables, credits, children }: { tables: { id: string; name: string }[]; credits: number | null; children?: React.ReactNode }) {
  const [kind, setKind] = useState<"people" | "companies">("people");
  const [tableId, setTableId] = useState("");
  const [intent, setIntent] = useState<"count" | "add">("count");
  const [limit, setLimit] = useState(25);
  const [state, dispatch, pending] = useActionState(findLeads, null);
  // The last count, while its tab is the one showing: the other tab's count isn't this search's.
  const counted = state?.ok && state.kind === kind ? state : null;
  // Shown beside the button that was pressed: at the bottom of a long form it's off-screen on a phone.
  const error = (forIntent: "count" | "add") =>
    state && !state.ok && intent === forIntent ? (
      <p role="alert" className="basis-full text-[12.5px] text-ws-red">
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
    <form onSubmit={submit} className="grid items-start gap-4 text-lk-fg lg:grid-cols-[minmax(0,1fr)_360px]">
      <input type="hidden" name="kind" value={kind} />
      <Card>
        <CardHead title="Who do you sell to?">
          <div role="radiogroup" aria-label="Search for" className="inline-flex rounded-md border border-lk-line p-0.5">
            {(["people", "companies"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`rounded px-3 py-1 text-[12.5px] capitalize transition ${kind === k ? "bg-ws-soft font-semibold text-lk-fg" : "text-lk-muted hover:text-lk-fg"}`}
              >
                {k}
              </button>
            ))}
          </div>
        </CardHead>
        {/* One set of fields per tab, so switching keeps each search as it was. The hidden one is disabled, which
            leaves it out of the form data. */}
        {(["people", "companies"] as const).map((k) => (
          <fieldset key={k} disabled={kind !== k} hidden={kind !== k} className="grid gap-x-4 gap-y-4 p-4 sm:grid-cols-2">
            <legend className="sr-only">{k === "people" ? "People filters" : "Company filters"}</legend>
            {k === "people" ? (
              <>
                <Field label="Job titles" hint="Comma-separated. Add variants and other languages.">
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
            <Field label={k === "people" ? "Location" : "Headquarters"} hint="Countries by name or code (Spain, ES), or a city or region.">
              <input name="location" className={field} placeholder="Spain" />
              {counted && <LocationReadout locations={counted.locations ?? []} />}
            </Field>
            <Field label="Industry" hint="LinkedIn industry names.">
              <input name="industry" className={field} placeholder="Software Development" />
            </Field>
            <Field label="Keywords" hint={k === "people" ? "Words in their profile." : "Words that describe the company."}>
              <input name="keywords" className={field} placeholder="fintech, payments" />
            </Field>
            <Field label={k === "people" ? "Company headcount" : "Headcount"}>
              <span className="flex items-center gap-2">
                <input name="minHeadcount" type="number" min={0} aria-label="Minimum headcount" className={`${field} font-mono`} placeholder="Min" />
                <span className="text-[12.5px] text-lk-dim">to</span>
                <input name="maxHeadcount" type="number" min={0} aria-label="Maximum headcount" className={`${field} font-mono`} placeholder="Max" />
              </span>
            </Field>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-lk-line bg-lk-frame px-4 py-3">
          <button name="intent" value="count" disabled={pending} className={buttonClass("secondary")}>
            <Search />
            {pending && intent === "count" ? "Counting…" : "Count matches"}
          </button>
          {counted?.total !== undefined && (
            <span aria-live="polite" className="flex items-baseline gap-1.5">
              <span className="font-display text-[22px] leading-none font-bold tracking-[-0.4px] text-lk-fg">{counted.total.toLocaleString("en")}</span>
              <span className="font-mono text-[11px] text-lk-muted">{counted.total === 1 ? "match" : "matches"}</span>
            </span>
          )}
          <span className="ml-auto font-mono text-[11px] text-ws-green">free</span>
          {error("count")}
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHead title="Add them to a table" />
          <div className="flex flex-col gap-4 p-4">
            <Field label="How many" hint="Up to 1,000 at a time.">
              <input
                name="limit"
                type="number"
                min={1}
                max={1000}
                defaultValue={25}
                required
                onChange={(e) => setLimit(Number(e.target.value) || 0)}
                className={`${field} font-mono`}
              />
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
                <input name="tableName" className={field} placeholder="Named after your search" />
              </Field>
            )}
            {credits !== null && (
              <div className="flex items-center justify-between gap-3 border-t border-lk-line pt-3">
                <span className={monoLabel}>Cost</span>
                <span className="font-mono text-[11.5px] text-lk-fg">
                  {limit.toLocaleString("en")} {limit === 1 ? "credit" : "credits"} · {Math.max(0, credits - limit).toLocaleString("en")} left
                </span>
              </div>
            )}
            <button name="intent" value="add" disabled={pending} className={`${buttonClass("primary")} w-full`}>
              <Table2 />
              {pending && intent === "add" ? "Adding…" : "Find and add"}
            </button>
            {error("add")}
          </div>
        </Card>
        {children}
      </div>
    </form>
  );
}
