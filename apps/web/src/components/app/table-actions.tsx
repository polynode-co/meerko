"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { createTable, deleteTable, renameTable } from "@/app/app/actions";
import { buttonClass, field } from "./ui";

/** "New table": a name, then the browser opens the empty table to add leads to. */
export function NewTable({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createTable, null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant)}>
        <Plus />
        New table
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="name" required autoFocus maxLength={120} placeholder="Table name" aria-label="Table name" className={`${field} w-52`} />
      <button disabled={pending} className={buttonClass("primary")}>
        {pending ? "Creating…" : "Create"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
        Cancel
      </button>
      {state && !state.ok && (
        <span role="alert" className="w-full text-[12.5px] text-ws-red">
          {state.error}
        </span>
      )}
    </form>
  );
}

/**
 * Rename and delete for one table in the list. Both ask inline (no browser dialog); delete says how many leads go
 * with it, and is refused while a sequence is sending to the table.
 */
export function TableRowActions({ tableId, name, rowCount }: { tableId: string; name: string; rowCount: number }) {
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const reset = () => (setMode("idle"), setError(undefined), setValue(name));

  if (mode === "rename") {
    return (
      <form
        className="flex flex-wrap items-center justify-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await renameTable(tableId, value);
            if (res.ok) setMode("idle");
            else setError(res.error);
          });
        }}
      >
        <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus required maxLength={120} aria-label="New name" className={`${field} w-48 !py-1`} />
        <button disabled={pending} className={buttonClass("primary", "sm")}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={reset} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
        {error && <span className="w-full text-right text-[12px] text-ws-red">{error}</span>}
      </form>
    );
  }
  if (mode === "delete") {
    return (
      <span data-confirm className="flex flex-wrap items-center justify-end gap-2 text-[12.5px]">
        <span className={error ? "text-ws-red" : "text-lk-muted"}>
          {error ?? `Delete it and its ${rowCount.toLocaleString("en")} ${rowCount === 1 ? "lead" : "leads"}?`}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteTable(tableId);
              if (!res.ok) setError(res.error);
            })
          }
          className={buttonClass("danger", "sm")}
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button type="button" onClick={reset} className={buttonClass("ghost", "sm")}>
          Cancel
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center justify-end gap-0.5">
      <button type="button" onClick={() => setMode("rename")} className="rounded p-1.5 text-lk-dim transition hover:bg-ws-soft hover:text-lk-fg" aria-label={`Rename ${name}`} title="Rename">
        <Pencil className="size-[14px]" />
      </button>
      <button type="button" onClick={() => setMode("delete")} className="rounded p-1.5 text-lk-dim transition hover:bg-ws-red-soft hover:text-ws-red" aria-label={`Delete ${name}`} title="Delete">
        <Trash2 className="size-[14px]" />
      </button>
    </span>
  );
}
