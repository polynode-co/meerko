import type { Metadata } from "next";
import { LogoMark } from "@/components/ui/brand";
import { EmailLinkConfirm } from "@/components/app/email-link-confirm";

export const metadata: Metadata = { title: "Sign in — Meerko", robots: { index: false }, referrer: "no-referrer" };

/**
 * Where the emailed sign-in link lands. Signing in takes a click: mail scanners open every link in an email,
 * and a page that signed in on load would let them use up the one-time token first.
 */
export default async function EmailLinkPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-lk-bg px-6 py-10 text-lk-fg">
      <a href="/" aria-label="Meerko home" className="flex items-center gap-2.5">
        <LogoMark size={26} />
        <span className="font-pixel text-[16px] tracking-[0.6px] text-lk-fg">MEERKO</span>
      </a>
      <div className="flex w-full max-w-[420px] flex-col gap-5">
        <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-1.2px]">Finish signing in</h1>
        {token ? (
          <EmailLinkConfirm token={token} />
        ) : (
          <p className="text-[15.5px] leading-[1.6] text-lk-muted">
            This link is missing its sign-in code. <a href="/login" className="text-lk-lime underline-offset-4 hover:underline">Ask for a new one</a>.
          </p>
        )}
      </div>
    </main>
  );
}
