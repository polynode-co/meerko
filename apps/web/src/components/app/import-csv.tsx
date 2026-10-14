"use client";

import { Upload } from "lucide-react";
import { useActionState, useState } from "react";
import { importCsv } from "@/app/app/actions";
import { buttonClass } from "./ui";

/** Opens a small form: a CSV with a header row becomes a new table, and the browser goes to it. */
export function ImportCsv({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(importCsv, null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={buttonClass(variant)}>
        <Upload className="size-[15px]" />
        Import CSV
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-4 text-left text-[13px]">
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">CSV file</span>
        <input name="file" type="file" accept=".csv,text/csv" required className="text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-line file:px-3 file:py-1.5 file:text-fg" />
        <span className="text-xs text-muted">
          First row is the header. Columns like <span className="font-mono">first_name</span>, <span className="font-mono">company</span> and{" "}
          <span className="font-mono">email</span> are recognised; any others become columns you can use in emails. Up to 10,000 rows.
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Table name</span>
        <input name="name" placeholder="Defaults to the file name" className="rounded-lg border border-line bg-ink px-3 py-2" />
      </label>
      {state && !state.ok && <p role="alert" className="text-xs text-[#e5795b]">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={buttonClass("primary")}>{pending ? "Importing…" : "Import"}</button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Cancel</button>
      </div>
    </form>
  );
}
