/**
 * Our own addresses, by domain: Polynode's Workspace and its meerko.ai alias. Safe in the browser because it names
 * no one; never add a personal address here (client code ships to every visitor).
 */
export const INTERNAL_EMAIL_DOMAINS = ["@polynode.co", "@meerko.ai"] as const;

export function hasInternalDomain(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const normalised = email.trim().toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((domain) => normalised.endsWith(domain));
}
