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

export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]!);
  return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip);
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
