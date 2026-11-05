import { consentRequired } from "@/lib/consent-region";

// Read by the cookie banner (components/analytics/cookie-banner.tsx) on load, so pages stay static.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(
    { consent: consentRequired(request.headers.get("x-client-region")) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
