"use client";

import { useActionState } from "react";
import { redeemEmailLink } from "@/app/login/actions";

/** The one button on the sign-in link's page; any device works, not only the one that asked for the link. */
export function EmailLinkConfirm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(redeemEmailLink, null);
  const error = state && "error" in state ? state.error : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-[15.5px] leading-[1.6] text-lk-muted">Continue to open your Meerko workspace in this browser.</p>
      {error && (
        <p role="alert" className="text-[15px] text-[#ff8a6b]">
          {error}{" "}
          <a href="/login" className="text-lk-lime underline-offset-4 hover:underline">
            Back to sign in
          </a>
        </p>
      )}
      <button
        disabled={pending}
        className="flex items-center justify-center gap-3 bg-lk-fg px-4 py-[15px] font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-ink uppercase shadow-[4px_4px_0_var(--color-lk-lime)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_var(--color-lk-lime)] disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in to Meerko"}
      </button>
    </form>
  );
}
