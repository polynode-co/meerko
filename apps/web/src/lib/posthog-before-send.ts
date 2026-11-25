import type { CaptureResult } from "posthog-js";
import { detectInternalVisitor } from "./internal-visitor";

/** Which part of the site an event came from; the marketing site and the dashboard share one origin. */
export const surfaceFor = (pathname: string) =>
  pathname === "/app" || pathname.startsWith("/app/") || pathname.startsWith("/oauth/") ? "app" : "marketing";

export interface BeforeSendContext {
  appEnv: string;
  country: string | null;
  release: string | undefined;
  /** The page the event came from; `window.location.pathname` in the browser. */
  pathname: () => string;
}

/**
 * PostHog's `before_send` (instrumentation-client.ts). Properties are stamped here rather than with register(),
 * which reset() clears on sign-out, and because this runs on every event, cookieless ones included.
 *
 * `is_internal` goes on every event, true or false, so a missing value only ever means "sent before this shipped".
 * It's the property PostHog's internal-users filter reads, so our own browsers drop out of insights while their
 * events are kept (internal-visitor.ts).
 */
export function createBeforeSend(ctx: BeforeSendContext) {
  return (event: CaptureResult | null): CaptureResult | null => {
    if (!event) return null;
    event.properties = {
      ...event.properties,
      app_env: ctx.appEnv,
      surface: surfaceFor(ctx.pathname()),
      is_internal: detectInternalVisitor(),
      ...(ctx.country ? { country: ctx.country } : {}),
      ...(ctx.release ? { $release: ctx.release } : {}),
    };
    return event;
  };
}
