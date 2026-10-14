import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";

/**
 * Holds the dashboard's credential: a session token (`ms_…`) from "Sign in with Google", or an API key
 * (`mk_…`) on self-hosted installs without Google. The API accepts either as a Bearer token.
 */
export const SESSION_COOKIE = "meerko_session";
export const apiUrl = () => process.env.MEERKO_API_URL ?? "http://localhost:8787";
/**
 * The API as browsers and agents reach it: sign-in redirects, the MCP URL, examples in the docs. The same as
 * apiUrl() unless MEERKO_PUBLIC_URL says otherwise, as in Docker Compose, where this server calls http://api:8080.
 */
export const publicApiUrl = () => process.env.MEERKO_PUBLIC_URL || apiUrl();

const THIRTY_DAYS_S = 60 * 60 * 24 * 30;

/** Only callable from a Server Function or Route Handler (pages can't set cookies). */
export async function setSessionCookie(token: string, expiresAt?: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(expiresAt ? { expires: expiresAt } : { maxAge: THIRTY_DAYS_S }),
  });
}

/** API client for the signed-in workspace. Sends anyone without a credential to /login. */
export async function meerko() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/login");
  return new MeerkoClient({ apiUrl: apiUrl(), apiKey: token });
}

/** Runs an API read; an expired or revoked credential goes back to /login instead of crashing the page. */
export async function load<T>(fn: (client: MeerkoClient) => Promise<T>): Promise<T> {
  const client = await meerko();
  try {
    return await fn(client);
  } catch (err) {
    if (err instanceof MeerkoApiError && err.status === 401) redirect("/login?expired=1");
    throw err;
  }
}

/** Where to go after signing in (e.g. back to an app's consent page), kept across the Google round trip. */
export const NEXT_COOKIE = "meerko_next";

/** `next` if it's a path on this site, so sign-in can't be turned into an open redirect. */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?![/\\])/.test(next) ? next : null);

/** The hosted MCP endpoint that agents connect to (they sign in with OAuth). */
export const mcpUrl = () => new URL("/mcp", publicApiUrl()).toString();
