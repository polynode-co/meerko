"use client";

import { FileUp, Upload } from "lucide-react";
import { useActionState, useState } from "react";
import { importCsv } from "@/app/app/actions";
import { buttonClass, field, fieldLabel } from "./ui";

/** Opens a small form: a CSV with a header row becomes a new table, and the browser goes to it. */
export function ImportCsv({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(importCsv, null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={buttonClass(variant)}>
        <Upload />
        Import CSV
      </button>
    );
  }
  return (
    <form action={action} className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-lk-line bg-white text-left">
      <div className="flex flex-col gap-3 p-4">
        <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-lk-line bg-lk-frame px-4 py-5 text-center transition hover:border-lk-gray">
          <FileUp className="size-[18px] text-lk-muted" />
          <span className="text-[13.5px] font-semibold text-lk-fg">Choose a CSV file</span>
          <span className="font-mono text-[11px] text-lk-dim">header row · up to 10,000 rows</span>
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 max-w-full text-[12.5px] text-lk-muted file:mr-3 file:rounded-md file:border file:border-lk-line file:bg-white file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-lk-fg"
          />
        </label>
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-lk-dim">
          Recognised
          {["first_name", "last_name", "company", "email"].map((c) => (
            <span key={c} className="rounded bg-ws-soft px-1.5 py-px font-mono text-[11px] text-lk-muted">
              {c}
            </span>
          ))}
          + others become columns
        </p>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Table name</span>
          <input name="name" placeholder="Defaults to the file name" className={field} />
        </label>
        {state && !state.ok && (
          <p role="alert" className="text-[12.5px] text-ws-red">
            {state.error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-lk-line bg-lk-frame px-4 py-2.5">
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>
          Cancel
        </button>
        <button disabled={pending} className={buttonClass("primary")}>
          <Upload />
          {pending ? "Importing…" : "Import"}
        </button>
      </div>
    </form>
  );
}
