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
  subtitle,
  subtitleWarn,
}: {
  workspace: string;
  workspaces: (Workspace & { current: boolean })[];
  /** False when signed in with an API key (self-hosting), which belongs to one workspace. */
  canCreate: boolean;
  subtitle: string;
  subtitleWarn: boolean;
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
        className="group flex w-full items-center gap-2 border-l-2 border-lk-line px-3 py-0.5 text-left hover:border-lk-lime"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[15px] font-semibold text-lk-fg">{workspace}</span>
          <span className={`truncate font-plex text-[12px] ${subtitleWarn ? "text-[#e5795b]" : "text-lk-dim"}`}>{subtitle}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-lk-dim group-hover:text-lk-fg" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 flex flex-col bg-lk-box outline outline-1 -outline-offset-1 outline-lk-gray shadow-[6px_6px_0_#000]">
          <span className="px-3 pt-3 pb-1.5 font-plex text-[12px] tracking-[0.8px] text-lk-dim uppercase">Workspaces</span>
          <ul role="listbox" aria-label="Workspaces" className="flex max-h-64 flex-col overflow-y-auto">
            {workspaces.map((w) => (
              <li key={w.id} role="option" aria-selected={w.current}>
                {w.current ? (
                  <span className="flex items-center gap-2 px-3 py-2 text-[14px] text-lk-fg">
                    <Check className="size-3.5 shrink-0 text-lk-lime" />
                    <span className="truncate">{w.name}</span>
                  </span>
                ) : (
                  <form action={switchWorkspace}>
                    <input type="hidden" name="workspace_id" value={w.id} />
                    <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-lk-muted hover:bg-lk-frame hover:text-lk-fg">
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
                    className="min-w-0 bg-lk-ink px-2.5 py-1.5 text-[14px] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime"
                  />
                  {created && !created.ok && <span className="text-[13px] text-[#e5795b]">{created.error}</span>}
                  <span className="text-[12px] leading-snug text-lk-dim">Shares your plan and credits. Leads, mailboxes and sequences are separate.</span>
                  <button
                    disabled={creating}
                    className="bg-lk-lime px-2.5 py-1.5 font-plex text-[12.5px] font-semibold tracking-[0.6px] text-lk-ink uppercase disabled:opacity-60"
                  >
                    {creating ? "Creating…" : "Create and switch"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 px-1.5 py-1.5 font-plex text-[12.5px] tracking-[0.6px] text-lk-muted uppercase hover:text-lk-fg"
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
