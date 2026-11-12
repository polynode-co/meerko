"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { addLead } from "@/app/app/actions";
import { buttonClass, field, fieldLabel, monoLabel } from "./ui";

/**
 * One person, typed in: for a referral, someone met at an event, or a test send to yourself.
 * Without `tableId` it creates a "My leads" table first. `extraColumns` are the table's own columns
 * (beyond name, email, company and title), so their placeholders get a value.
 */
export function AddLead({
  tableId,
  extraColumns = [],
  variant = "secondary",
  floating = false,
}: {
  tableId?: string;
  extraColumns?: { key: string; name: string }[];
  variant?: "primary" | "secondary";
  /** Opens as a panel under the button (for page headers) instead of replacing it in place. */
  floating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addLead, null);
  const form = useRef<HTMLFormElement>(null);
  // After a successful add, clear the form for the next person and keep it open.
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  const button = (
    <button onClick={() => setOpen((o) => !o)} className={buttonClass(variant)} aria-expanded={open}>
      <UserPlus />
      Add lead
    </button>
  );
  if (!open) return button;
  const input = (name: string, text: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, className = "") => (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className={fieldLabel}>{text}</span>
      <input name={name} className={field} {...props} />
    </label>
  );
  const panel = (
    <form
      ref={form}
      action={action}
      className={`flex flex-col overflow-hidden rounded-lg border border-lk-line bg-white text-left ${
        floating ? "absolute top-full right-0 z-20 mt-2 w-[min(34rem,calc(100vw-2rem))] shadow-[0_12px_40px_rgba(22,22,26,0.15)]" : "w-full max-w-xl"
      }`}
    >
      {tableId && <input type="hidden" name="tableId" value={tableId} />}
      <div className="flex flex-col gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {input("first_name", "First name", { autoFocus: true })}
          {input("last_name", "Last name")}
          {input("email", "Email (required)", { type: "email", required: true, placeholder: "name@company.com" }, "sm:col-span-2")}
          {input("company", "Company")}
          {input("title", "Job title")}
        </div>
        {extraColumns.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-lk-line pt-3">
            <span className={monoLabel}>Table columns</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {extraColumns.map((c) => (
                <label key={c.key} className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>{c.name}</span>
                  <input name={`col:${c.key}`} className={field} />
                </label>
              ))}
            </div>
          </div>
        )}
        {!tableId && <p className="text-[12.5px] text-lk-dim">They go into a new table called “My leads”.</p>}
        {state && (
          <p role="status" className={`text-[12.5px] ${state.ok ? "text-ws-green" : "text-ws-red"}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-lk-line bg-lk-frame px-4 py-2.5">
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("secondary")}>
          Close
        </button>
        <button disabled={pending} className={buttonClass("primary")}>
          <UserPlus />
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
  return floating ? (
    <div className="relative">
      {button}
      {panel}
    </div>
  ) : (
    panel
  );
}
