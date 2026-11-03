"use client";

import { Check, Gift, Ticket } from "lucide-react";
import { useActionState } from "react";
import { Logo, Mascot } from "@/components/ui/brand";
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

/** The sand panel beside the form (hidden on small screens). */
function BrandPanel() {
  return (
    <aside className="hidden w-[44%] max-w-[620px] shrink-0 flex-col items-center justify-center gap-10 bg-sand p-16 text-dark lg:flex">
      <Mascot className="h-[240px] w-auto" />
      <div className="flex max-w-[440px] flex-col items-center gap-3.5 text-center">
        <p className="font-display text-[32px] leading-[1.1] font-bold tracking-[-0.02em]">Always on the lookout for your next reply.</p>
        <p className="leading-[1.5] text-dark-muted">Find leads, send from your own Gmail or Outlook and catch every reply — from the dashboard or your agent.</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2.5">
        {["Open source", "Your own inbox", "Works in Claude Code"].map((t) => (
          <li key={t} className="flex items-center gap-1.5 rounded-full bg-dark/5 px-3 py-1.5 text-[13px] font-medium">
            <Check className="size-3.5 text-[#0e9f6e]" /> {t}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** `googleUrl` set: "Sign in with Google" (cloud). Unset: paste an API key (self-hosting without Google). */
export function LoginForm({ googleUrl, inviteOnly, notice, next }: { googleUrl: string | null; inviteOnly: boolean; notice?: string; next?: string | null }) {
  const [state, action, pending] = useActionState(login, null);
  const error = state && !state.ok ? state.error : notice;

  return (
    <div className="flex min-h-dvh">
      <main className="flex flex-1 flex-col justify-between gap-10 px-6 py-8 sm:px-16 sm:py-10">
        <a href="/" aria-label="Meerko home" className="self-start">
          <Logo size={30} className="text-[22px]" />
        </a>

        <div className="flex justify-center">
          <div className="flex w-full max-w-[400px] flex-col gap-7">
            <div className="flex flex-col gap-2.5">
              <h1 className="font-display text-4xl font-bold tracking-[-0.02em]">Open your workspace</h1>
              <p className="leading-[1.5] text-muted">
                {googleUrl ? (
                  "Sign in with the Google account Meerko knows you by."
                ) : (
                  <>
                    Paste your Meerko API key. Create one with <span className="font-mono text-fg">pnpm db:seed</span> on a self-hosted install.
                  </>
                )}
              </p>
            </div>

            {error && (
              <p role="alert" className="text-[13px] text-[#e5795b]">
                {error}
              </p>
            )}

            {googleUrl ? (
              <>
                {/* A full navigation, not a client-side Link: the API redirects on to Google. */}
                <a href={googleUrl} className="flex items-center justify-center gap-3 rounded-[10px] bg-accent px-5 py-3.5 text-base font-semibold text-dark transition hover:brightness-110">
                  <GoogleIcon />
                  Continue with Google
                </a>
                {inviteOnly ? (
                  <div className="flex gap-3 rounded-[10px] border border-line bg-raised px-4 py-3.5 text-sm">
                    <Ticket className="mt-0.5 size-[17px] shrink-0 text-accent" />
                    <p className="flex flex-col gap-1">
                      <span className="font-semibold">Meerko Cloud is invite-only for now.</span>
                      <a href="/docs/self-hosting" className="text-accent hover:underline">
                        Not invited yet? Self-host Meerko for free →
                      </a>
                    </p>
                  </div>
                ) : (
                  <p className="flex gap-2.5 text-sm text-muted">
                    <Gift className="mt-0.5 size-[17px] shrink-0 text-accent" />
                    New to Meerko? Your first sign-in creates your workspace with 200 free credits.
                  </p>
                )}
              </>
            ) : (
              <form action={action} className="flex flex-col gap-4">
                {next && <input type="hidden" name="next" value={next} />}
                <input
                  name="key"
                  type="password"
                  autoComplete="off"
                  required
                  placeholder="mk_…"
                  aria-label="API key"
                  className="rounded-lg border border-line bg-raised px-3 py-3 font-mono text-sm outline-none focus:border-accent"
                />
                <button disabled={pending} className="flex items-center justify-center rounded-[10px] bg-accent px-5 py-3 text-base font-semibold text-dark transition hover:brightness-110 disabled:opacity-50">
                  {pending ? "Checking…" : "Continue"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted">
          By continuing you agree to the{" "}
          <a href="/terms" className="text-fg hover:text-accent">Terms of service</a> and{" "}
          <a href="/privacy" className="text-fg hover:text-accent">Privacy policy</a>.
        </p>
      </main>
      <BrandPanel />
    </div>
  );
}
