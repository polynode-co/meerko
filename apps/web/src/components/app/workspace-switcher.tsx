"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import type { Workspace } from "@meerko/sdk";
import { createWorkspace, switchWorkspace } from "@/app/app/actions";

/**
 * The sidebar's workspace block, which opens into a list of the person's workspaces (one per brand) and a form for a
 * new one. Switching moves this browser's session only; agents and other tabs stay where they are.
 */
export function WorkspaceSwitcher({
  workspace,
  workspaces,
  canCreate,
  warning,
}: {
  workspace: string;
  workspaces: (Workspace & { current: boolean })[];
  /** False when signed in with an API key (self-hosting), which belongs to one workspace. */
  canCreate: boolean;
  /** Shown under the name, e.g. when the mailbox needs reconnecting. */
  warning: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [created, create, creating] = useActionState(createWorkspace, null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group flex w-full items-center gap-2.5 rounded-md px-1.5 py-[5px] text-left hover:bg-ws-soft"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-[5px] bg-lk-fg text-[12px] font-bold text-white">{workspace.trim().charAt(0).toUpperCase() || "M"}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[13px] font-semibold text-lk-fg">{workspace}</span>
          {warning && <span className="truncate font-mono text-[10px] text-ws-red">{warning}</span>}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-lk-dim group-hover:text-lk-fg" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 flex flex-col overflow-hidden rounded-lg border border-lk-line bg-white shadow-[0_12px_40px_rgba(22,22,26,0.15)]">
          <span className="px-3 pt-3 pb-1.5 font-mono text-[10px] tracking-[1px] text-lk-dim uppercase">Workspaces</span>
          <ul role="listbox" aria-label="Workspaces" className="flex max-h-64 flex-col overflow-y-auto">
            {workspaces.map((w) => (
              <li key={w.id} role="option" aria-selected={w.current}>
                {w.current ? (
                  <span className="flex items-center gap-2 px-3 py-2 text-[13px] text-lk-fg">
                    <Check className="size-3.5 shrink-0 text-ws-green" />
                    <span className="truncate">{w.name}</span>
                  </span>
                ) : (
                  <form action={switchWorkspace}>
                    <input type="hidden" name="workspace_id" value={w.id} />
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-lk-muted hover:bg-lk-frame hover:text-lk-fg">
                      <span className="size-3.5 shrink-0" />
                      <span className="truncate">{w.name}</span>
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>

          {canCreate && (
            <div className="border-t border-lk-line p-2">
              {adding ? (
                <form action={create} className="flex flex-col gap-2 p-1">
                  <input
                    name="name"
                    autoFocus
                    required
                    maxLength={80}
                    placeholder="Brand name"
                    aria-label="New workspace name"
                    className="min-w-0 rounded-md border border-lk-line bg-white px-2.5 py-1.5 text-[13px] text-lk-fg focus:border-lk-fg focus:outline-none"
                  />
                  {created && !created.ok && <span className="text-[12.5px] text-ws-red">{created.error}</span>}
                  <span className="text-[12px] leading-snug text-lk-dim">Shares your plan and credits. Leads, mailboxes and sequences are separate.</span>
                  <button
                    disabled={creating}
                    className="rounded-md bg-lk-fg px-2.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
                  >
                    {creating ? "Creating…" : "Create and switch"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 px-1.5 py-1.5 text-[12.5px] text-lk-muted hover:text-lk-fg"
                >
                  <Plus className="size-3.5" /> New workspace
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
