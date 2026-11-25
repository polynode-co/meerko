/**
 * Is this browser ours? PostHog's "filter out internal and test users" works from the person's email, which a
 * cookieless session (cookie declined, or not answered yet) never has: those events arrive as `cookieless_<hash>`,
 * never identified, and count as a real visitor. So the browser remembers it's ours, and `posthog-before-send.ts`
 * stamps `is_internal: true` on every event while it does. Tagged, never dropped: with the events gone, "how much
 * of that traffic was us" can't be answered any more. Same approach as Antwork.
 *
 * Armed with `?internal=1` on any page, disarmed with `?internal=0`, and armed automatically when a signed-in user
 * has an internal address (`internal-domain.ts`, via `PostHogIdentify`).
 */

/** `localStorage`, not a cookie: it never needs to reach the server, and it should survive, so it's set once per device. */
export const INTERNAL_VISITOR_STORAGE_KEY = "meerko_internal_visitor";

/** `?internal=1` arms it, `?internal=0` disarms it. */
export const INTERNAL_VISITOR_PARAM = "internal";

export interface InternalVisitorInputs {
  /** `window.location.search`, including the leading `?`. */
  search: string;
  /** What `localStorage` holds for the key, or null. */
  stored: string | null;
}

export interface InternalVisitorSignal {
  isInternal: boolean;
  /** What to do to storage; kept apart from the verdict so the rule stays a pure function. */
  persist: "set" | "clear" | "keep";
}

/**
 * The rule. An explicit `?internal=0` beats the stored flag, or a wrongly armed device (most likely a phone) could
 * only be disarmed from devtools.
 */
export function classifyInternalVisitor({ search, stored }: InternalVisitorInputs): InternalVisitorSignal {
  const param = new URLSearchParams(search).get(INTERNAL_VISITOR_PARAM);
  if (param === "1") return { isInternal: true, persist: "set" };
  if (param === "0") return { isInternal: false, persist: "clear" };
  return { isInternal: stored === "1", persist: "keep" };
}

let cached: boolean | undefined;

/**
 * Resolved once per page load: `before_send` runs on every event, and a query parse plus a storage read don't
 * belong on that path each time. Changing the param in the address bar is a full load, so the cache never hides it.
 */
export function detectInternalVisitor(): boolean {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return false;

  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(INTERNAL_VISITOR_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, site data off): not internal. Our own browsers are the ones where this works.
  }

  const signal = classifyInternalVisitor({ search: window.location.search, stored });
  if (signal.persist === "set") writeFlag(true);
  else if (signal.persist === "clear") writeFlag(false);

  cached = signal.isInternal;
  return cached;
}

/**
 * Arm the flag because a signed-in user is ours. Applies from the next event on; what this page already sent
 * keeps the verdict it had. Leaves a device disarmed with `?internal=0` on this load alone.
 */
export function markInternalVisitor(): void {
  if (typeof window === "undefined") return;
  if (classifyInternalVisitor({ search: window.location.search, stored: null }).persist === "clear") return;
  writeFlag(true);
  cached = true;
}

function writeFlag(armed: boolean) {
  try {
    if (armed) window.localStorage.setItem(INTERNAL_VISITOR_STORAGE_KEY, "1");
    else window.localStorage.removeItem(INTERNAL_VISITOR_STORAGE_KEY);
  } catch {
    // Write refused: the verdict still holds for this page load, it just won't survive to the next.
  }
}

/** Test seam. */
export function resetInternalVisitorCache(): void {
  cached = undefined;
}
