import { resolveTxt } from "node:dns/promises";

export type CheckStatus = "pass" | "missing" | "managed";

export interface DomainHealth {
  domain: string;
  /** "managed": a consumer Gmail address, where Google handles SPF, DKIM and DMARC. */
  spf: CheckStatus;
  dkim: CheckStatus;
  dmarc: CheckStatus;
}

// Google-hosted consumer addresses: the sender can't (and needn't) publish records for them.
const CONSUMER_DOMAINS = new Set(["gmail.com", "googlemail.com"]);
/** Google Workspace's default DKIM selector. Other selectors can't be listed via DNS, so only this one is checked. */
const GOOGLE_DKIM_SELECTOR = "google";

type Resolver = (name: string) => Promise<string[][]>;

async function txt(resolve: Resolver, name: string) {
  try {
    return (await resolve(name)).map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

/** Looks up SPF, DKIM (Google selector) and DMARC for the domain an address sends from. */
export async function checkDomainHealth(domain: string, resolve: Resolver = resolveTxt): Promise<DomainHealth> {
  const d = domain.toLowerCase();
  if (CONSUMER_DOMAINS.has(d)) return { domain: d, spf: "managed", dkim: "managed", dmarc: "managed" };
  const [root, dkim, dmarc] = await Promise.all([txt(resolve, d), txt(resolve, `${GOOGLE_DKIM_SELECTOR}._domainkey.${d}`), txt(resolve, `_dmarc.${d}`)]);
  return {
    domain: d,
    spf: root.some((r) => /^v=spf1\b/i.test(r)) ? "pass" : "missing",
    dkim: dkim.some((r) => /\bp=\S/i.test(r)) ? "pass" : "missing",
    dmarc: dmarc.some((r) => /^v=DMARC1\b/i.test(r)) ? "pass" : "missing",
  };
}

const cache = new Map<string, { at: number; health: DomainHealth }>();
const CACHE_MS = 10 * 60_000;

/** checkDomainHealth for several domains, cached for 10 minutes (DNS changes take a while to show anyway). */
export async function domainHealthFor(domains: string[], resolve?: Resolver) {
  const unique = [...new Set(domains.map((d) => d.toLowerCase()))];
  return Promise.all(
    unique.map(async (d) => {
      const hit = cache.get(d);
      if (!resolve && hit && Date.now() - hit.at < CACHE_MS) return hit.health;
      const health = await checkDomainHealth(d, resolve);
      if (!resolve) cache.set(d, { at: Date.now(), health });
      return health;
    }),
  );
}
