import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { MeerkoApiError, MeerkoClient } from "@meerko/sdk";
import { apiUrl, NEXT_COOKIE, safeNext, setSessionCookie } from "@/lib/meerko";

// The token is in this URL, so it must not be cached, sent on as a referrer, or indexed.
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };

const page = (title: string, message: string, status: number) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} — Meerko</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">${title}</h1><p>${message}</p><p><a href="/login">Sign in another way</a></p></body>`,
    { status, headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } },
  );

/**
 * A directory reviewer's sign-in link: starts an ordinary dashboard session as the link's one account, so the
 * reviewer can add the MCP connector and meet the consent page already signed in. A wrong, expired or revoked
 * link gets the same page. Links are made with `pnpm db:reviewer-link`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let session: { token: string; expires_at: string };
  try {
    session = await new MeerkoClient({ apiUrl: apiUrl(), apiKey: "" }).reviewerSignIn(token, {
      forwardedFor: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });
  } catch (err) {
    if (err instanceof MeerkoApiError && err.status === 429) return page("Too many attempts", "Wait a few minutes, then open the link again.", 429);
    if (err instanceof MeerkoApiError && err.status < 500) return page("This link isn't valid", "Check that you opened the whole link, or ask whoever sent it for a new one.", 400);
    return page("Something went wrong", "We couldn't sign you in just now. Open the link again in a minute.", 502);
  }
  await setSessionCookie(session.token, new Date(session.expires_at));
  const store = await cookies();
  const next = safeNext(request.nextUrl.searchParams.get("next")) ?? safeNext(store.get(NEXT_COOKIE)?.value);
  store.delete(NEXT_COOKIE);
  // A relative Location, so it's right whatever host the proxy in front calls this server by.
  return new Response(null, { status: 303, headers: { ...headers, Location: next ?? "/app" } });
}
