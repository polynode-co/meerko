"use client";

import { useActionState } from "react";
import { renameWorkspace } from "@/app/app/actions";
import { SectionHead } from "@/app/app/settings/parts";
import { buttonClass, field } from "@/components/app/ui";

/** Settings → Workspace: this brand's name. Owners can rename it. */
export function WorkspaceCard({ id, name, canManage }: { id: string; name: string; canManage: boolean }) {
  const [state, rename, renaming] = useActionState(renameWorkspace, null);
  return (
    <section id="workspace" className="scroll-mt-6">
      <SectionHead title="Workspace" note="one per brand · all share one plan and credit balance" />
      <form action={rename} className="flex max-w-[480px] flex-wrap items-center gap-2">
        <input type="hidden" name="workspace_id" value={id} />
        <input name="name" defaultValue={name} required maxLength={80} disabled={!canManage} aria-label="Workspace name" className={`${field} flex-1 disabled:opacity-60`} />
        {canManage && (
          <button disabled={renaming} className={buttonClass("secondary")}>
            {renaming ? "Saving…" : "Rename"}
          </button>
        )}
        {state && <span className={`w-full text-[12.5px] ${state.ok ? "text-ws-green" : "text-ws-red"}`}>{state.ok ? state.message : state.error}</span>}
        {!canManage && <span className="w-full text-[12.5px] text-lk-dim">Only the workspace&apos;s owner can rename it.</span>}
      </form>
    </section>
  );
}
