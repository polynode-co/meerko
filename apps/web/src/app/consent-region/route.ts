import { consentRequired, countryCode } from "@/lib/consent-region";

// Read on load by PostHog's setup and the cookie banner (lib/visitor-region.ts), so pages stay static. The
// country goes on every analytics event, consent or not: it's a country, read on our side, stored nowhere.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return Response.json(
    { consent: consentRequired(request.headers.get("x-client-region")), country: countryCode(request.headers.get("x-client-region")) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
