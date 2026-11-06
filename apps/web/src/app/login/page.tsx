import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoClient } from "@meerko/sdk";
import { LoginForm } from "@/components/app/login-form";
import { attributionQuery } from "@/lib/attribution";
import { apiUrl, publicApiUrl, safeNext, SESSION_COOKIE } from "@/lib/meerko";

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

/** "Sign in with Google" and email links when the API offers them; otherwise (self-hosting) the API-key form. */
async function signInOptions(next: string | null, attribution: string) {
  try {
    const { google, email, signup } = await new MeerkoClient({ apiUrl: apiUrl(), apiKey: "" }).authConfig();
    // With somewhere to return to, /auth/start remembers it across the Google round trip.
    // The visit's source (lib/attribution.ts) rides along so the API can put it on the sign_up event.
    const query = [next ? `next=${encodeURIComponent(next)}` : "", attribution].filter(Boolean).join("&");
    const start = next ? `/auth/start?${query}` : `${new URL("/auth/google/start", publicApiUrl()).toString()}${query ? `?${query}` : ""}`;
    return { googleUrl: google ? start : null, emailLinks: !!email, inviteOnly: signup !== "open" };
  } catch {
    return { googleUrl: null, emailLinks: false, inviteOnly: true };
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { expired, error, next: rawNext, method } = params;
  const next = safeNext(rawNext);
  // Already signed in: skip the form. (`expired` means the dashboard just rejected the credential.)
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && !expired && (await isSignedIn(token))) redirect(next ?? "/app");
  const options = await signInOptions(next, attributionQuery(params));
  // ?method=key shows the API-key form even where Google sign-in is on: for app reviewers given a key, who can't
  // pass Google's new-location checks on a shared account.
  if (method === "key") Object.assign(options, { googleUrl: null, emailLinks: false });
  const attribution = Object.fromEntries(new URLSearchParams(attributionQuery(params)));
  return <LoginForm {...options} attribution={attribution} next={next} notice={error ?? (expired ? "Your session expired. Sign in again." : undefined)} />;
}
