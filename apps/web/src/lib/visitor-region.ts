/** What /consent-region says about this visitor: whether to ask for cookie consent, and their country (ISO code). */
export interface VisitorRegion {
  consent: boolean;
  country: string | null;
}

let pending: Promise<VisitorRegion> | null = null;

/**
 * Fetched once per page load and shared: PostHog waits for it so every event carries `country`, and the cookie
 * banner uses it to decide whether to ask. If the check fails, ask, with no country.
 */
export function visitorRegion(): Promise<VisitorRegion> {
  pending ??= fetch("/consent-region")
    .then((r) => r.json() as Promise<VisitorRegion>)
    .then((r) => ({ consent: r.consent !== false, country: typeof r.country === "string" ? r.country : null }))
    .catch(() => ({ consent: true, country: null }));
  return pending;
}
