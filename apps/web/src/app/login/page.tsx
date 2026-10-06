import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoClient } from "@meerko/sdk";
import { LoginForm } from "@/components/app/login-form";
import { apiUrl, safeNext, SESSION_COOKIE } from "@/lib/meerko";

export const metadata: Metadata = { title: "Sign in — Meerko", robots: { index: false } };

/** Whether the saved credential still works; an expired one or an unreachable API shows the form. */
async function isSignedIn(token: string) {
  try {
    await new MeerkoClient({ apiUrl: apiUrl(), apiKey: token }).me();
    return true;
  } catch {
    return false;
  }
}

/** "Sign in with Google" when the API offers it; otherwise (self-hosting) the API-key form. */
async function signInOptions(next: string | null) {
  try {
    const { google, signup } = await new MeerkoClient({ apiUrl: apiUrl(), apiKey: "" }).authConfig();
    // With somewhere to return to, /auth/start remembers it across the Google round trip.
    const start = next ? `/auth/start?next=${encodeURIComponent(next)}` : new URL("/auth/google/start", apiUrl()).toString();
    return { googleUrl: google ? start : null, inviteOnly: signup !== "open" };
  } catch {
    return { googleUrl: null, inviteOnly: true };
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; error?: string; next?: string }> }) {
  const { expired, error, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  // Already signed in: skip the form. (`expired` means the dashboard just rejected the credential.)
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && !expired && (await isSignedIn(token))) redirect(next ?? "/app");
  return <LoginForm {...await signInOptions(next)} next={next} notice={error ?? (expired ? "Your session expired. Sign in again." : undefined)} />;
}
