import type { ReactNode } from "react";
import { monoLabel } from "@/components/app/ui";

/**
 * Pieces shared by the Connections page and its cards ("WS3 · Connections" f5ab4v and its modals in meerko.pen).
 * Candidates for components/app/ui.tsx once the WS3 rebuild settles. Interactive pieces are in ./dialog.tsx.
 */

/** A section of the Connections page: a title with a short mono note, actions on the right, its card(s) below. */
export function SectionHead({ title, note, children }: { title: ReactNode; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-2.5 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="text-[15px] font-semibold text-lk-fg">{title}</span>
        {note && <span className="font-mono text-[11px] text-lk-dim">{note}</span>}
      </h2>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Mono caps table heading band, for the card tables on this page. */
export const headBand = `hidden border-b border-lk-line bg-ws-head px-4 py-2.5 ${monoLabel} md:flex md:items-center md:gap-4`;
/** A compact card row. */
export const row = "flex min-h-[52px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-lk-line px-4 py-2.5 last:border-0";
/** A one-line outcome under a card's rows. */
export const outcome = (ok: boolean) => `border-t border-lk-line px-4 py-2.5 text-[13px] ${ok ? "text-ws-green" : "text-ws-red"}`;

/** Solid red, for the confirming click in a destructive modal. */
export const dangerSolid =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-ws-red px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

/** The body and the footer band of a Modal; a form wraps both when the modal submits one. */
export const modalBody = "flex max-h-[calc(100vh-200px)] flex-col gap-4 overflow-y-auto px-5 py-5";
export const modalFoot = "flex flex-wrap items-center justify-end gap-2 border-t border-lk-line bg-lk-frame px-5 py-3.5";

