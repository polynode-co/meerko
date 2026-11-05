/** Signup-source parameters carried from the first page of a visit, through /login, to the API's sign-up. */
export const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "landing"] as const;

/** The attribution parameters present in `params`, as a query string ("" when there are none). */
export function attributionQuery(params: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const k of ATTRIBUTION_KEYS) {
    const v = params[k];
    if (typeof v === "string" && v) q.set(k, v.slice(0, 100));
  }
  return q.toString();
}
