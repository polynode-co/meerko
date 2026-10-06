"use client";

import { useActionState } from "react";
import { Logo } from "@/components/ui/brand";
import { buttonClass } from "@/components/app/ui";
import { login } from "@/app/app/actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** `googleUrl` set: "Sign in with Google" (cloud). Unset: paste an API key (self-hosting without Google). */
export function LoginForm({ googleUrl, notice }: { googleUrl: string | null; notice?: string }) {
  const [state, action, pending] = useActionState(login, null);
  const error = state && !state.ok ? state.error : notice;

  const header = (
    <>
      <a href="/" aria-label="Meerko home" className="self-start">
        <Logo size={30} className="text-xl" />
      </a>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold tracking-tight">Open your workspace</h1>
        <p className="text-[13px] text-muted">
          {googleUrl ? (
            "Sign in with the Google account Meerko knows you by."
          ) : (
            <>
              Paste your Meerko API key. Create one with <span className="font-mono text-fg">pnpm db:seed</span> on a self-hosted install.
            </>
          )}
        </p>
      </div>
    </>
  );
  const alert = error ? (
    <p role="alert" className="text-[13px] text-[#e5795b]">
      {error}
    </p>
  ) : null;

  if (googleUrl) {
    return (
      <main className="grid min-h-dvh place-items-center px-5">
        <div className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-line bg-raised p-7">
          {header}
          {alert}
          {/* A full navigation, not a client-side Link: the API redirects on to Google. */}
          <a href={googleUrl} className={`${buttonClass("primary")} justify-center gap-2.5 py-2.5`}>
            <GoogleIcon />
            Continue with Google
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <form action={action} className="flex w-full max-w-sm flex-col gap-5 rounded-xl border border-line bg-raised p-7">
        {header}
        <input
          name="key"
          type="password"
          autoComplete="off"
          required
          placeholder="mk_…"
          className="rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
        />
        {alert}
        <button disabled={pending} className={`${buttonClass("primary")} justify-center py-2.5`}>
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
