"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { addLead } from "@/app/app/actions";
import { buttonClass } from "./ui";

const field = "bg-lk-ink px-3 py-2 text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime text-[15px]";

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
      <UserPlus className="size-[15px]" />
      Add lead
    </button>
  );
  if (!open) return button;
  const panel = (
    <form
      ref={form}
      action={action}
      className={`flex flex-col gap-3 border border-lk-gray bg-lk-frame p-4 text-left text-[15px] ${
        floating ? "absolute top-full right-0 z-20 mt-2 w-[min(34rem,calc(100vw-2rem))] shadow-[8px_8px_0_#000]" : "w-full max-w-xl"
      }`}
    >
      {tableId && <input type="hidden" name="tableId" value={tableId} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="first_name" placeholder="First name" autoFocus className={field} />
        <input name="last_name" placeholder="Last name" className={field} />
        <input name="email" type="email" placeholder="Email (required)" required className={`${field} sm:col-span-2`} />
        <input name="company" placeholder="Company" className={field} />
        <input name="title" placeholder="Job title" className={field} />
        {extraColumns.map((c) => (
          <input key={c.key} name={`col:${c.key}`} placeholder={c.name} className={field} />
        ))}
      </div>
      {!tableId && <p className="text-sm text-lk-dim">They go into a new table called “My leads”.</p>}
      {state && <p role="status" className={`text-sm ${state.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{state.ok ? state.message : state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={buttonClass("primary")}>{pending ? "Adding…" : "Add"}</button>
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost")}>Close</button>
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
