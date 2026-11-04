"use client";

import { Gift, Ticket } from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import { LogoMark } from "@/components/ui/brand";
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

/** The night panel beside the form (hidden on small screens), from the .pen design "LK · Login" (M5oPmh). */
function NightPanel() {
  return (
    <aside className="relative hidden w-1/2 shrink-0 flex-col justify-between overflow-hidden p-12 lg:flex">
      <Image src="/landing/lookout-night.jpg" alt="" fill priority sizes="50vw" className="object-cover object-center" />
      <a href="/" aria-label="Meerko home" className="relative flex items-center gap-2.5 self-start">
        <LogoMark size={26} />
        <span className="font-pixel text-[16px] tracking-[0.6px] text-lk-fg">MEERKO</span>
      </a>
      <div className="relative flex flex-col gap-3.5 bg-lk-bg/80 p-6 outline outline-1 -outline-offset-1 outline-lk-line backdrop-blur-sm">
        <p className="font-plex text-[12.5px] tracking-[0.8px] text-lk-lime uppercase">● Open source · Your own inbox · Works in Claude Code</p>
        <p className="text-[24px] leading-[1.2] font-semibold tracking-[-0.6px] text-lk-fg">Always on the lookout for your next reply.</p>
      </div>
    </aside>
  );
}

/** `googleUrl` set: "Sign in with Google" (cloud). Unset: paste an API key (self-hosting without Google). */
export function LoginForm({ googleUrl, inviteOnly, notice, next }: { googleUrl: string | null; inviteOnly: boolean; notice?: string; next?: string | null }) {
  const [state, action, pending] = useActionState(login, null);
  const error = state && !state.ok ? state.error : notice;
  const button =
    "flex items-center justify-center gap-3 bg-lk-fg px-4 py-[15px] font-plex text-[13px] font-semibold tracking-[0.8px] text-lk-ink uppercase shadow-[4px_4px_0_var(--color-lk-lime)] transition hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_var(--color-lk-lime)] disabled:opacity-50";

  return (
    <div className="flex min-h-dvh bg-lk-bg text-lk-fg">
      <NightPanel />
      <main className="flex flex-1 flex-col justify-between gap-10 px-6 py-8 sm:px-12 sm:py-12">
        <a href="/" aria-label="Meerko home" className="flex items-center gap-2.5 self-start lg:invisible">
          <LogoMark size={26} />
          <span className="font-pixel text-[16px] tracking-[0.6px] text-lk-fg">MEERKO</span>
        </a>

        <div className="flex justify-center">
          <div className="flex w-full max-w-[420px] flex-col gap-5">
            {/* The kit's kicker (components/lookout/kit.tsx is server-only, so its classes are repeated here). */}
            <p className="inline-flex items-center gap-2.5 font-plex text-[14px] tracking-[0.8px] text-lk-fg/80 uppercase before:size-2 before:bg-lk-lime before:content-['']">
              Sign in
            </p>
            <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-1.2px] sm:text-[40px] sm:tracking-[-1.4px]">Open your workspace</h1>
            <p className="text-[15.5px] leading-[1.6] text-lk-muted">
              {googleUrl ? (
                "Sign in with the Google account Meerko knows you by."
              ) : (
                <>
                  Paste your Meerko API key. Create one with <span className="font-plex text-lk-fg">pnpm db:seed</span> on a self-hosted install.
                </>
              )}
            </p>

            {error && (
              <p role="alert" className="text-[15px] text-[#ff8a6b]">
                {error}
              </p>
            )}

            {googleUrl ? (
              <>
                {/* A full navigation, not a client-side Link: the API redirects on to Google. */}
                <a href={googleUrl} className={`${button} mt-1`}>
                  <GoogleIcon />
                  Continue with Google
                </a>
                {inviteOnly ? (
                  <div className="flex gap-3 bg-lk-box px-4 py-3.5 text-[15px] leading-[1.55] outline outline-1 -outline-offset-1 outline-lk-line">
                    <Ticket className="mt-0.5 size-[17px] shrink-0 text-lk-lime" />
                    <p className="flex flex-col gap-1">
                      <span className="font-semibold">Meerko Cloud is invite-only for now.</span>
                      <a href="/docs/self-hosting" className="text-lk-lime underline-offset-4 hover:underline">
                        Not invited yet? Self-host Meerko for free →
                      </a>
                    </p>
                  </div>
                ) : (
                  <p className="flex gap-2.5 text-[15px] leading-[1.6] text-lk-dim">
                    <Gift className="mt-0.5 size-[17px] shrink-0 text-lk-lime" />
                    New to Meerko? Your first sign-in creates your workspace with 200 free credits.
                  </p>
                )}
              </>
            ) : (
              <form action={action} className="mt-1 flex flex-col gap-4">
                {next && <input type="hidden" name="next" value={next} />}
                <input
                  name="key"
                  type="password"
                  autoComplete="off"
                  required
                  placeholder="mk_…"
                  aria-label="API key"
                  className="bg-transparent px-4 py-3.5 font-plex text-[14px] text-lk-fg outline outline-1 -outline-offset-1 outline-lk-gray placeholder:text-lk-dim focus:outline-lk-lime"
                />
                <button disabled={pending} className={button}>
                  {pending ? "Checking…" : "Continue"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-[15px] leading-[1.6] text-lk-dim">
          By continuing you agree to the{" "}
          <a href="/terms" className="text-lk-fg underline-offset-4 hover:underline">Terms of service</a> and{" "}
          <a href="/privacy" className="text-lk-fg underline-offset-4 hover:underline">Privacy policy</a>.
        </p>
      </main>
    </div>
  );
}
