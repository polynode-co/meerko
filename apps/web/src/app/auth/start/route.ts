import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { apiUrl, NEXT_COOKIE, safeNext } from "@/lib/meerko";

/** "Continue with Google" with somewhere to come back to: remembers `next`, then starts the API's sign-in. */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (next) {
    (await cookies()).set(NEXT_COOKIE, next, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 15 * 60 });
  }
  redirect(new URL("/auth/google/start", apiUrl()).toString());
}
