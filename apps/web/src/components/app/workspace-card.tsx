"use client";

import { useActionState } from "react";
import { renameWorkspace } from "@/app/app/actions";
import { buttonClass, Card, cardTitle } from "@/components/app/ui";

/** Settings → Workspace: this brand's name. Owners can rename it. */
export function WorkspaceCard({ id, name, canManage }: { id: string; name: string; canManage: boolean }) {
  const [state, rename, renaming] = useActionState(renameWorkspace, null);
  return (
    <Card id="workspace">
      <div className="border-b border-lk-line px-[18px] py-4">
        <h2 className={cardTitle}>Workspace</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-lk-muted">
          One workspace per brand: its own leads, mailboxes, sequences and settings. Your workspaces share one plan and credit balance. Switch or add one from the
          top of the sidebar.
        </p>
      </div>
      <form action={rename} className="flex flex-wrap items-center gap-3 px-[18px] py-4">
        <input type="hidden" name="workspace_id" value={id} />
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={80}
          disabled={!canManage}
          aria-label="Workspace name"
          className="min-w-0 flex-1 bg-lk-ink px-3 py-2 text-[15px] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray focus:outline-lk-lime disabled:opacity-60"
        />
        {canManage && (
          <button disabled={renaming} className={buttonClass()}>
            {renaming ? "Saving…" : "Rename"}
          </button>
        )}
        {state && <span className={`w-full text-[14px] ${state.ok ? "text-lk-lime" : "text-[#e5795b]"}`}>{state.ok ? state.message : state.error}</span>}
        {!canManage && <span className="w-full text-[14px] text-lk-dim">Only the workspace&apos;s owner can rename it.</span>}
      </form>
    </Card>
  );
}
