import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { cookies } from "next/headers";
import { apiUrl, NEXT_COOKIE, safeNext, setSessionCookie } from "@/lib/meerko";

/**
 * The API's Google sign-in callback sends the browser here with a one-time code. This server trades it
 * for a session token, so the token itself never appears in a URL.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) redirect("/login");
  let session: { token: string; expires_at: string };
  try {
    session = await new MeerkoClient({ apiUrl: apiUrl(), apiKey: "" }).exchangeAuthCode(code);
  } catch (err) {
    const message = err instanceof MeerkoApiError ? err.message : `Can't reach the Meerko API at ${apiUrl()}`;
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  await setSessionCookie(session.token, new Date(session.expires_at));
  const store = await cookies();
  const next = safeNext(store.get(NEXT_COOKIE)?.value);
  store.delete(NEXT_COOKIE);
  redirect(next ?? "/app");
}
