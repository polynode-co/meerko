import { NextResponse, type NextRequest } from "next/server";

// Someone without a session who opens a dashboard link (the landing hero's /app/welcome?site=…, a link in an email)
// signs in and comes back to that same page. Without this, the /app layout's own redirect drops where they were going.
// The cookie name repeats SESSION_COOKIE in lib/meerko.ts: proxy shouldn't import the app's server modules.
const SESSION_COOKIE = "meerko_session";

export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/app", "/app/:path*"] };
