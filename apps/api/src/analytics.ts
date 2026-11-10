import { PostHog } from "posthog-node";

/**
 * Product events the API sends to PostHog. snake_case, past tense, one emitter each, never built by
 * string interpolation. Never prefix with `mcp_`: PostHog's MCP analytics owns `$mcp_*` (see /mcp).
 */
export const EVENTS = {
  signUp: "sign_up",
  signInCompleted: "sign_in_completed",
  apiKeyCreated: "api_key_created",
  aiClientConnected: "ai_client_connected",
  mailboxConnected: "mailbox_connected",
  leadsSearched: "leads_searched",
  digestToggled: "digest_toggled",
  websiteRead: "website_read",
  icpSet: "icp_set",
  rowsEnriched: "rows_enriched",
  sequenceStarted: "sequence_started",
  checkoutStarted: "checkout_started",
  subscriptionChanged: "subscription_changed",
  creditsPurchased: "credits_purchased",
  agentHookConfigured: "agent_hook_configured",
  slackConnected: "slack_connected",
  workspaceCreated: "workspace_created",
} as const;
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * A sign-up's source, from the query the web app passes to /auth/google/start (apps/web/src/lib/attribution.ts):
 * UTM tags, the referring site and the landing page, as `sign_up` properties. It's how signups are attributed for
 * visitors who said no to the analytics cookie. Unknown keys and odd values are dropped.
 */
export function signupSource(query: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : null);
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = text(query[k]);
    if (v) out[k] = v;
  }
  const ref = text(query.ref ?? query.referrer_domain);
  if (ref && /^[a-z0-9.-]+(:\d+)?$/i.test(ref)) out.referrer_domain = ref.toLowerCase();
  const landing = text(query.landing ?? query.landing_path);
  if (landing?.startsWith("/")) out.landing_path = landing;
  return out;
}

export interface CaptureInput {
  /** The user when there is one (dashboard), otherwise the workspace (API keys, OAuth apps). */
  distinctId: string;
  event: EventName;
  workspaceId?: string;
  properties?: Record<string, unknown>;
  /** Person properties. */
  set?: Record<string, unknown>;
}

export interface Analytics {
  /** Null when POSTHOG_API_KEY isn't set (local runs, self-hosting): nothing is sent. */
  readonly posthog: PostHog | null;
  /** Properties every event and exception carries. */
  readonly common: { app_env: string; $release?: string };
  /** Never throws; resolves once the event is sent, since Cloud Run throttles CPU after the response. */
  capture(input: CaptureInput): Promise<void>;
  captureException(err: unknown, distinctId?: string, properties?: Record<string, unknown>): Promise<void>;
}

export function createAnalytics(env: NodeJS.ProcessEnv = process.env): Analytics {
  const common = { app_env: env.APP_ENV || "local", ...(env.COMMIT_SHA ? { $release: env.COMMIT_SHA } : {}) };
  const posthog = env.POSTHOG_API_KEY
    ? new PostHog(env.POSTHOG_API_KEY, { host: env.POSTHOG_HOST || "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0 })
    : null;
  /** Owns failures that belong to no user, e.g. the Scheduler tick. */
  const serviceId = `service:api:${common.app_env}`;

  return {
    posthog,
    common,
    async capture({ distinctId, event, workspaceId, properties, set }) {
      if (!posthog) return;
      try {
        posthog.capture({
          distinctId,
          event,
          properties: { ...properties, ...common, surface: "api", ...(set ? { $set: set } : {}) },
          ...(workspaceId ? { groups: { workspace: workspaceId } } : {}),
        });
        await posthog.flush();
      } catch (err) {
        console.error("posthog capture failed:", err);
      }
    },
    async captureException(err, distinctId, properties) {
      if (!posthog) return;
      try {
        await posthog.captureExceptionImmediate(err, distinctId ?? serviceId, { ...properties, ...common, surface: "api" });
      } catch (e) {
        console.error("posthog captureException failed:", e);
      }
    },
  };
}
