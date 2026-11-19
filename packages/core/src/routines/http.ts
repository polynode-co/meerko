import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** A refusal the person can fix: shown as is (HTTP 400). */
export class RoutineError extends Error {}

/** Claude Code routines' API trigger is a research preview behind this beta header (code.claude.com/docs/en/routines). */
export const CLAUDE_ROUTINE_BETA = "experimental-cc-routine-2026-04-01";
/** Pinned to Anthropic's host and path: the token travels to this URL, so it can never be aimed anywhere else. */
export const CLAUDE_ROUTINE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_-]+\/fire$/;
export const CALL_TIMEOUT_MS = 10_000;

/**
 * Rejects URLs Meerko shouldn't call from its own network: plain http, and hosts that resolve to private,
 * loopback, link-local (cloud metadata) or unique-local addresses. Self-hosters can allow private targets
 * (a local n8n, say) with MEERKO_ALLOW_PRIVATE_HOOKS=1.
 */
export async function assertSafeHookUrl(raw: string, opts: { allowPrivate?: boolean; resolve?: (host: string) => Promise<string[]> } = {}) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RoutineError("Enter a full URL, starting with https://");
  }
  if (opts.allowPrivate) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new RoutineError("The URL must start with https:// or http://");
    return url;
  }
  if (url.protocol !== "https:") throw new RoutineError("The URL must start with https://");
  if (url.username || url.password) throw new RoutineError("Put credentials in the token, not the URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const resolve = opts.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    throw new RoutineError(`Couldn't resolve ${host}`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new RoutineError("The URL must point to a public internet address");
  return url;
}

/** An IPv6 address as eight 16-bit groups, whatever its notation (`::`, a dotted IPv4 tail); null if it isn't one. */
function ipv6Groups(ip: string): number[] | null {
  if (isIP(ip) !== 6) return null;
  let text = ip.replace(/%.*$/, "");
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[2]!.split(".").map(Number) as [number, number, number, number];
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::") as [string, string | undefined];
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill("0");
  const groups = [...left, ...fill, ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

const ipv4From = (hi: number, lo: number) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

/**
 * Private, loopback, link-local (cloud metadata), CGNAT, multicast or reserved. IPv6 forms that carry an IPv4
 * address (mapped `::ffff:a9fe:a9fe`, compatible, NAT64, 6to4) are judged by that address, in any notation:
 * `new URL()` rewrites `[::ffff:169.254.169.254]` to `[::ffff:a9fe:a9fe]`.
 */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number) as [number, number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const g = ipv6Groups(ip);
  if (!g) return true; // not an address we can read: refuse rather than guess
  const zero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (zero(0, 5) && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0 && g[7]! <= 1) return true; // :: and ::1
    return isPrivateAddress(ipv4From(g[6]!, g[7]!)); // ::ffff:a.b.c.d and the deprecated ::a.b.c.d
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) return g[2] !== 0 || isPrivateAddress(ipv4From(g[6]!, g[7]!)); // NAT64; 64:ff9b:1::/48 is local
  if (g[0] === 0x2002) return isPrivateAddress(ipv4From(g[1]!, g[2]!)); // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo hides the IPv4 address
  const first = g[0]!;
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

/** `meerko-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, the same scheme as Stripe's. */
export function signWebhook(secret: string, body: string, unixSeconds: number) {
  const v1 = createHmac("sha256", secret).update(`${unixSeconds}.${body}`).digest("hex");
  return `t=${unixSeconds},v1=${v1}`;
}

export function describeFailure(err: unknown) {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return `No answer within ${CALL_TIMEOUT_MS / 1000}s`;
  return `Couldn't reach it: ${err instanceof Error ? err.message : String(err)}`;
}

/** What an HTTP status from a start means, in words the person can act on. */
export function describeStatus(trigger: "claude_routine" | "webhook", status: number): string {
  if (trigger === "claude_routine") {
    if (status === 401) return "Claude refused the token (HTTP 401). Generate a new one on the routine's API trigger and save it here.";
    if (status === 403) return "Claude says this token can't start the routine (HTTP 403).";
    if (status === 404) return "Claude can't find the routine (HTTP 404). Was it deleted?";
    if (status === 400) return "Claude refused the start (HTTP 400). Is the routine paused in Claude?";
    if (status === 429) return "Claude's limit on routine starts was reached (HTTP 429).";
  }
  return `It answered HTTP ${status}`;
}
