import "server-only";
import { PostHog } from "posthog-node";

let client: PostHog | null | undefined;

/** Server-side PostHog for error capture; null (nothing sent) without NEXT_PUBLIC_POSTHOG_KEY. */
export function posthogServer() {
  if (client === undefined) {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    // Straight to PostHog: the /ingest rewrite is for browsers. flushAt 1 because Cloud Run throttles CPU after a response.
    client = key ? new PostHog(key, { host: "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0 }) : null;
  }
  return client;
}
