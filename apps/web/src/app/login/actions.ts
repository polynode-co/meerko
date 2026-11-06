"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { ATTRIBUTION_KEYS } from "@/lib/attribution";
import { apiUrl, NEXT_COOKIE, safeNext, setSessionCookie } from "@/lib/meerko";

export type EmailLinkState = { sent: string } | { error: string } | null;

const api = () => new MeerkoClient({ apiUrl: apiUrl(), apiKey: "" });
const failure = (err: unknown) => ({ error: err instanceof MeerkoApiError ? err.message : `Can't reach the Meerko API at ${apiUrl()}` });

/** "Email me a link": the API sends it. `next` is remembered in this browser, like the Google round trip. */
export async function requestEmailLink(_: EmailLinkState, form: FormData): Promise<EmailLinkState> {
  const email = String(form.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Enter your email address." };
  const source: Record<string, string> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = form.get(k);
    if (typeof v === "string" && v) source[k] = v.slice(0, 100);
  }
  try {
    await api().requestEmailSignIn(email, source);
  } catch (err) {
    return failure(err);
  }
  const next = safeNext(String(form.get("next") ?? ""));
  if (next) {
    (await cookies()).set(NEXT_COOKIE, next, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 15 * 60 });
  }
  return { sent: email };
}

/** The button on the link's page: trades its token for a session. */
export async function redeemEmailLink(_: EmailLinkState, form: FormData): Promise<EmailLinkState> {
  let session: { token: string; expires_at: string };
  try {
    session = await api().verifyEmailSignIn(String(form.get("token") ?? ""));
  } catch (err) {
    return failure(err);
  }
  await setSessionCookie(session.token, new Date(session.expires_at));
  const store = await cookies();
  const next = safeNext(store.get(NEXT_COOKIE)?.value);
  store.delete(NEXT_COOKIE);
  redirect(next ?? "/app");
}
