// The company a visitor typed into the landing hero, carried to /login inside `next` (/app/welcome?site=…), so the
// sign-in page can greet them with their own name and icon.

/** A bare hostname from what people type ("https://www.Acme.com/about" → "acme.com"), or null if it isn't one. */
export function siteHost(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .split(/[/?#]/)[0]!
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
  return /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ? host : null;
}

/** The hero's site, if `next` is the welcome page with one. */
export function siteFromNext(next: string | null | undefined): string | null {
  if (!next?.startsWith("/app/welcome")) return null;
  return siteHost(new URL(next, "https://x.invalid").searchParams.get("site"));
}

/** "acme.com" → "Acme", "my-shop.co.uk" → "My Shop": a readable name until we know the real one. */
export function siteName(host: string) {
  return host
    .split(".")[0]!
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
