/**
 * Countries where an analytics cookie needs the visitor's prior consent: the EU and EEA (ePrivacy Directive),
 * the UK (PECR) and Switzerland. Elsewhere the site uses PostHog's cookie without asking.
 */
const CONSENT_COUNTRIES = new Set([
  // EU
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // EEA, UK, Switzerland
  "IS",
  "LI",
  "NO",
  "GB",
  "CH",
]);

/**
 * Whether to ask for consent, from the country the load balancer sends as `X-Client-Region`
 * (core-infrastructure lb-serverless). An unknown country asks: local runs, dev, and anything the
 * load balancer couldn't place.
 */
export function consentRequired(region: string | null | undefined) {
  const code = region?.trim().toUpperCase();
  return !code || CONSENT_COUNTRIES.has(code);
}
