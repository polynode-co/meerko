import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoClient } from "@meerko/sdk";
import { LoginForm } from "@/components/app/login-form";
import { apiUrl, SESSION_COOKIE } from "@/lib/meerko";

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
async function signInOptions() {
  try {
    const { google, signup } = await new MeerkoClient({ apiUrl: apiUrl(), apiKey: "" }).authConfig();
    return { googleUrl: google ? new URL("/auth/google/start", apiUrl()).toString() : null, inviteOnly: signup !== "open" };
  } catch {
    return { googleUrl: null, inviteOnly: true };
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string; error?: string }> }) {
  const { expired, error } = await searchParams;
  // Already signed in: skip the form. (`expired` means the dashboard just rejected the credential.)
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && !expired && (await isSignedIn(token))) redirect("/app");
  return <LoginForm {...await signInOptions()} notice={error ?? (expired ? "Your session expired. Sign in again." : undefined)} />;
}
