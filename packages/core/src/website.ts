// Reads a company's website so the person's own agent can work out who it sells to (the "first customers"
// onboarding). Meerko doesn't run a model itself: it fetches the page and hands the text over.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPrivateAddress } from "./routines/http.ts";

/** A website that can't be read; the message is safe to show. */
export class WebsiteError extends Error {}

export interface Website {
  url: string;
  title: string | null;
  description: string | null;
  headings: string[];
  /** The page's visible text, collapsed and capped at TEXT_MAX characters. */
  text: string;
  truncated: boolean;
}

const TEXT_MAX = 6000;
const BYTES_MAX = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 4;

export interface ReadWebsiteOptions {
  fetch?: typeof fetch;
  /** DNS override (tests). */
  resolve?: (host: string) => Promise<string[]>;
}

/** "acme.com", "www.acme.com/about" or a full URL → an https URL; http is upgraded. */
export function normalizeWebsite(raw: string): URL {
  const input = raw.trim();
  if (!input) throw new WebsiteError("Enter your website, e.g. acme.com");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new WebsiteError(`"${input}" isn't a website address`);
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") throw new WebsiteError("Enter a website address, e.g. acme.com");
  if (url.username || url.password) throw new WebsiteError("Leave the username and password out of the address");
  if (!url.hostname.includes(".") && !isIP(url.hostname.replace(/^\[|\]$/g, ""))) throw new WebsiteError(`"${input}" isn't a website address`);
  url.hash = "";
  return url;
}

/** Refuses hosts that resolve to private, loopback or cloud-metadata addresses: Meerko fetches from its own network. */
async function assertPublic(url: URL, resolve: (host: string) => Promise<string[]>) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    throw new WebsiteError(`Couldn't find ${host}. Check the address.`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new WebsiteError(`Meerko can only read public websites`);
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const clean = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

function meta(html: string, name: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key !== name) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return clean(content);
  }
  return null;
}

/** Title, description, headings and visible text from an HTML page. */
export function extractWebsite(url: string, raw: string): Website {
  const html = raw.replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || meta(html, "og:title");
  const description = meta(html, "description") ?? meta(html, "og:description");
  const headings = [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => clean(m[2]!))
    .filter((h) => h && h.length <= 200)
    .filter((h, i, all) => all.indexOf(h) === i)
    .slice(0, 30);
  const body = html.replace(/<(br|p|div|li|h[1-6]|section|article|tr)\b[^>]*>/gi, "\n");
  const full = clean(body);
  return { url, title: title || null, description, headings, text: full.slice(0, TEXT_MAX), truncated: full.length > TEXT_MAX };
}

/** Fetches a public website's home page (following up to 4 redirects, each re-checked) and extracts its text. */
export async function readWebsite(raw: string, opts: ReadWebsiteOptions = {}): Promise<Website> {
  const doFetch = opts.fetch ?? fetch;
  const resolve = opts.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  let url = normalizeWebsite(raw);
  for (let hop = 0; ; hop++) {
    await assertPublic(url, resolve);
    let res: Response;
    try {
      res = await doFetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": "MeerkoBot/1.0 (+https://meerko.ai)", accept: "text/html,application/xhtml+xml" },
      });
    } catch {
      throw new WebsiteError(`Couldn't reach ${url.hostname}. Check the address, or try again.`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (hop >= MAX_REDIRECTS) throw new WebsiteError(`${url.hostname} redirects too many times`);
      const next = new URL(res.headers.get("location")!, url);
      if (next.protocol === "http:") next.protocol = "https:";
      if (next.protocol !== "https:") throw new WebsiteError(`${url.hostname} redirects somewhere Meerko can't read`);
      url = next;
      continue;
    }
    if (!res.ok) throw new WebsiteError(`${url.hostname} answered ${res.status}. Check the address.`);
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) throw new WebsiteError(`${url.hostname} isn't a web page`);
    const html = await readCapped(res);
    return extractWebsite(url.toString(), html);
  }
}

async function readCapped(res: Response) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < BYTES_MAX) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, BYTES_MAX));
}
