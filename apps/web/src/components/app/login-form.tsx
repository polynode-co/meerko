"use client";

import { useActionState } from "react";
import { Logo } from "@/components/ui/brand";
import { buttonClass } from "@/components/app/ui";
import { login } from "@/app/app/actions";

export function LoginForm({ expired }: { expired: boolean }) {
  const [state, action, pending] = useActionState(login, null);

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form action={action} className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-line bg-raised p-7">
        <a href="/" aria-label="Meerko home" className="self-start">
          <Logo size={30} className="text-xl" />
        </a>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight">Open your workspace</h1>
          <p className="text-[13px] text-muted">
            Paste your Meerko API key. Create one with <span className="font-mono text-fg">pnpm db:seed</span> on a self-hosted install.
          </p>
        </div>
        <input
          name="key"
          type="password"
          autoComplete="off"
          required
          placeholder="mk_…"
          className="rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
        />
        {(state && !state.ok) || expired ? (
          <p role="alert" className="text-[13px] text-[#e5795b]">
            {state && !state.ok ? state.error : "Your session expired. Sign in again."}
          </p>
        ) : null}
        <button disabled={pending} className={`${buttonClass("primary")} justify-center py-2.5`}>
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
