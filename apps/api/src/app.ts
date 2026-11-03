import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { instrument } from "@posthog/mcp";
import { createServer as createMcpServer, DRAFTER_PROMPTS, DRAFTER_TOOLS } from "@meerko/mcp/server";
import { MeerkoClient } from "@meerko/sdk";
import {
  addColumn,
  countLeads,
  createTable,
  enrichRows,
  moveStage,
  pipelineSummary,
  approveDraft,
  discardDraft,
  draftReply,
  listDrafts,
  classifyReply,
  connectGmail,
  connectGmailAppPassword,
  connectImapMailbox,
  connectOutlook,
  listReplies,
  ReplyError,
  createSequence,
  enrollRows as enrollSequenceRows,
  getSequence,
  listSequences,
  previewSequence,
  readUnsubscribeToken,
  SequenceError,
  sequenceStats,
  listSequenceRecipients,
  setSequenceStatus,
  unsubscribe,
  updateSequence,
  runWorkerTick,
  createOAuthState,
  deleteMailbox,
  deleteProviderKey,
  GmailError,
  listMailboxes,
  OAuthStateError,
  readOAuthReturnTo,
  createApiKey,
  AgentHookError,
  deleteAgentHook,
  enableAgentHook,
  getAgentHook,
  setAgentHook,
  testAgentHook,
  createAuthCode,
  deleteSession,
  exchangeAuthCode,
  listApiKeys,
  revokeApiKey,
  signInWithGoogle,
  SignInError,
  type SignupMode,
  verifySession,
  sendTestEmail,
  updateMailbox,
  EncryptionNotConfiguredError,
  getBalance,
  getProviderKey,
  FirecrawlClient,
  firecrawlProvider,
  IcypeasClient,
  icypeasProvider,
  InsufficientCreditsError,
  listProviderKeys,
  setProviderKey,
  getPendingCells,
  getTable,
  IcypeasError,
  insertRows,
  listTables,
  NotFoundError,
  queryRows,
  searchLeads,
  updateRows,
  verifyApiKey,
  mailboxDomainHealth,
  MailboxConnectError,
  MailboxInUseError,
  TableInUseError,
  deleteRows,
  deleteTable,
  sequencePool,
  approveAuthorization,
  denyAuthorization,
  describeAuthorization,
  exchangeOAuthCode,
  listConnectedApps,
  OAuthError,
  refreshOAuthToken,
  registerOAuthClient,
  revokeConnectedApp,
  revokeOAuthToken,
  startAuthorization,
  verifyAccessToken,
  BillingError,
  isStripeError,
  getBilling,
  handleStripeEvent,
  openPortal,
  PlanLimitError,
  PRO_MONTHLY_CREDITS,
  CREDIT_PACK_CREDITS,
  startCheckout,
  verifyStripeEvent,
  type BillingConfig,
  type CreditPolicy,
  type EnrichmentProvider,
  completeSlackInstall,
  deleteSlackConnection,
  getSlackConnection,
  handleSlackCommand,
  handleSlackInteraction,
  setSlackWebhook,
  SlackError,
  slackInstallUrl,
  syncSlackDraft,
  testSlack,
  verifySlackSignature,
  type SlackAppConfig,
  type SlackInteraction,
  type GoogleOAuth,
  type ImapConnectors,
  type MicrosoftOAuth,
  type SecretBox,
  type IcypeasQuery,
} from "@meerko/core";
import type { ApiKeyScope, Db } from "@meerko/db";
import { createAnalytics, EVENTS, type Analytics } from "./analytics.ts";
import {
  agentHookInput,
  approveDraftInput,
  byokProvider,
  checkoutInput,
  classifyInput,
  columnInput,
  countInput,
  createApiKeyInput,
  createSequenceInput,
  createTableInput,
  deleteRowsInput,
  draftInput,
  enrichInput,
  enrollInput,
  gmailAppPasswordInput,
  imapMailboxInput,
  insertRowsInput,
  listDraftsQuery,
  listRepliesQuery,
  moveStageInput,
  oauthConnectInput,
  oauthDecideInput,
  oauthRequestInput,
  pipelineQuery,
  previewQuery,
  providerKeyInput,
  queryInput,
  searchInput,
  slackWebhookInput,
  testEmailInput,
  toSequenceInput,
  updateMailboxInput,
  updateRowsInput,
  updateSequenceInput,
} from "./v1/schemas.ts";
import { REPLIES_SCOPE_ROUTES } from "./v1/spec.ts";

type Env = {
  Variables: {
    workspaceId: string;
    workspaceName: string;
    /** Set for dashboard sessions; null for API keys and OAuth apps (CLI, MCP, scripts). */
    user: { id: string; email: string; name: string | null; role: string } | null;
    /** Who analytics events are about: the person behind a session or an OAuth app, else the workspace. Grants nothing. */
    actorId: string;
    /** `replies`: may only read replies and save drafts (see REPLIES_SCOPE_ROUTES). */
    scope: ApiKeyScope;
  };
};

/** Sent by the in-process client behind /mcp/drafter. It can only narrow a credential, so sending it yourself gains nothing. */
const SCOPE_HEADER = "x-meerko-scope";

async function parse<T extends z.ZodType>(schema: T, data: unknown): Promise<z.infer<T>> {
  const result = await schema.safeParseAsync(data);
  if (!result.success) throw new HTTPException(400, { message: z.prettifyError(result.error) });
  return result.data;
}

export interface AppDeps {
  /** Unset when ICYPEAS_API_KEY isn't configured; search routes then return 503. */
  icypeas?: IcypeasClient;
  /** Cloud meters enrichment in credits; self-host (BYOK) leaves this off. */
  credits?: CreditPolicy;
  /** Encrypts workspace provider keys; unset means BYOK keys can't be stored. */
  secretBox?: SecretBox | null;
  /** Builds a client for a workspace's own key (overridable in tests). */
  icypeasForKey?: (apiKey: string) => IcypeasClient;
  /** The Meerko Slack app (SLACK_CLIENT_ID/SECRET/SIGNING_SECRET); unset means only pasted webhooks can connect Slack. */
  slack?: SlackAppConfig;
  /** Overrides fetch for Slack calls (tests). */
  slackFetch?: typeof fetch;
  /** Builds a Firecrawl client for a workspace's own key (overridable in tests). */
  firecrawlForKey?: (apiKey: string) => FirecrawlClient;
  /** Unset when GOOGLE_CLIENT_ID/SECRET aren't configured; Gmail routes then return 503. */
  googleOAuth?: GoogleOAuth;
  /** Overrides fetch for Gmail API calls (tests). */
  gmailFetch?: typeof fetch;
  /**
   * Lets users connect Gmail through Google's consent screen (MEERKO_GMAIL_OAUTH=1, needs googleOAuth). Its
   * scopes need Google verification and a CASA assessment for public use, so it's off by default and
   * mailboxes connect with an app password instead. Mailboxes already connected that way keep working.
   */
  gmailOAuthConnect?: boolean;
  /** Overrides the IMAP and SMTP connections of app-password mailboxes (tests). */
  imap?: ImapConnectors;
  /**
   * The Meerko app registered with Microsoft (MICROSOFT_CLIENT_ID/SECRET): connects Outlook / Microsoft 365
   * mailboxes. Unset means Outlook isn't offered. Its Graph calls use gmailFetch in tests.
   */
  microsoftOAuth?: MicrosoftOAuth;
  /**
   * Enables POST /internal/tick for Cloud Scheduler (cloud runs no worker process). Unset when
   * MEERKO_TICK_SECRET isn't configured, and the route then answers 404.
   */
  tick?: { secret: string; publicUrl: string };
  /** The web dashboard's URL (MEERKO_APP_URL). Gmail connect may only send the browser back to this origin. */
  appUrl?: string;
  /** Lets agent hooks call private addresses (MEERKO_ALLOW_PRIVATE_HOOKS=1, self-hosting only). */
  allowPrivateHooks?: boolean;
  /** Overrides fetch for agent hook calls (tests). */
  hookFetch?: typeof fetch;
  /**
   * "Sign in with Google" for the dashboard: an OAuth client whose redirect is /auth/google/callback.
   * Unset (self-hosting without Google, or no MEERKO_APP_URL) means the dashboard logs in with an API key.
   */
  googleSignIn?: GoogleOAuth;
  /** Who may sign in with Google: anyone (`open`) or invited emails only (`invite`, the default). */
  signup?: SignupMode;
  /**
   * This API's public URL (MEERKO_PUBLIC_URL): the OAuth issuer, and the base of the /mcp resource URL that
   * MCP clients connect to. Defaults to the request's origin.
   */
  publicUrl?: string;
  /** PostHog product events, errors and MCP analytics; a no-op when unset (tests, self-hosting without a key). */
  analytics?: Analytics;
  /** Stripe on Meerko Cloud: plans, credit packs and plan limits. Unset (self-hosting) turns all of it off. */
  billing?: BillingConfig;
}

/** Allows `max` calls per key in any `windowMs`. Per instance, which is enough to stop guessing. */
function attemptLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allow(key: string, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      const ok = recent.length < max;
      if (ok) recent.push(now);
      hits.set(key, recent);
      return ok;
    },
  };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const resultPage = (title: string, message: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body>`;

export function createApp(db: Db, deps: AppDeps = {}) {
  const credits = deps.credits ?? { enabled: false };
  const box = deps.secretBox ?? null;
  // App-password connects sign in to Google: 10 tries per workspace per 10 minutes.
  const connectAttempts = attemptLimiter(10, 10 * 60_000);
  const hookDeps = () => ({ appUrl: deps.appUrl, hookFetch: deps.hookFetch, allowPrivateHooks: deps.allowPrivateHooks, slackFetch: deps.slackFetch });
  const slackDeps = () => ({ box, appUrl: deps.appUrl, fetch: deps.slackFetch });
  const icypeasForKey = deps.icypeasForKey ?? ((apiKey: string) => new IcypeasClient({ apiKey }));

  /** A workspace's own Icypeas key wins and is never metered; otherwise the server's key and credit policy apply. */
  const icypeasFor = async (workspaceId: string): Promise<{ client: IcypeasClient; credits: CreditPolicy }> => {
    const own = await getProviderKey(db, box, workspaceId, "icypeas");
    if (own) return { client: icypeasForKey(own), credits: { enabled: false } };
    if (!deps.icypeas) {
      throw new HTTPException(503, { message: "No Icypeas key: add yours with `meerko keys set icypeas <key>`, or set ICYPEAS_API_KEY on the server" });
    }
    return { client: deps.icypeas, credits };
  };
  const firecrawlForKey = deps.firecrawlForKey ?? ((apiKey: string) => new FirecrawlClient({ apiKey }));

  /**
   * The email-finding waterfall: Icypeas first (the workspace's key, else the server's), then Firecrawl when the
   * workspace stored a Firecrawl key. Firecrawl alone is enough to enrich.
   */
  const enrichmentFor = async (workspaceId: string): Promise<{ providers: EnrichmentProvider[]; credits: CreditPolicy }> => {
    const firecrawlKey = await getProviderKey(db, box, workspaceId, "firecrawl");
    const firecrawl = firecrawlKey ? [firecrawlProvider(firecrawlForKey(firecrawlKey))] : [];
    try {
      const icy = await icypeasFor(workspaceId);
      return { providers: [icypeasProvider(icy.client), ...firecrawl], credits: icy.credits };
    } catch (err) {
      if (firecrawl.length === 0) throw err;
      return { providers: firecrawl, credits };
    }
  };
  const analytics = deps.analytics ?? createAnalytics({});
  const app = new Hono<Env>();

  /** `url` if it's on the dashboard's origin, so the OAuth callback can't be used as an open redirect. */
  const appReturnUrl = (url: string | undefined) => {
    if (!url || !deps.appUrl) return undefined;
    try {
      return new URL(url).origin === new URL(deps.appUrl).origin ? url : undefined;
    } catch {
      return undefined;
    }
  };
  /** Sends the browser back to the dashboard with the outcome in the query string. */
  const backToApp = (returnTo: string, outcome: Record<string, string>) => {
    const url = new URL(returnTo);
    for (const [k, v] of Object.entries(outcome)) url.searchParams.set(k, v);
    return url.toString();
  };

  app.get("/health", (c) => c.json({ ok: true }));

  const googleOAuth = () => {
    if (!deps.googleOAuth) throw new HTTPException(503, { message: "Gmail isn't configured on this server (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)" });
    return deps.googleOAuth;
  };

  // Called every minute by Cloud Scheduler with `Authorization: Bearer <MEERKO_TICK_SECRET>`.
  app.post("/internal/tick", async (c) => {
    const given = Buffer.from(c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
    const expected = Buffer.from(deps.tick?.secret ?? "");
    if (!deps.tick || given.length !== expected.length || !timingSafeEqual(given, expected)) return c.json({ error: "Not found" }, 404);
    const result = await runWorkerTick(
      db,
      { box, oauth: deps.googleOAuth, microsoft: deps.microsoftOAuth, publicUrl: deps.tick.publicUrl, fetch: deps.gmailFetch, imap: deps.imap, ...hookDeps() },
      { replies: c.req.query("replies") !== "0" },
    );
    if (result.replyError) {
      console.error("reply scan failed:", result.replyError);
      await analytics.captureException(result.replyError, undefined, { $exception_fingerprint: "api.tick.replies" });
    }
    if (result.hookError) {
      console.error("agent hooks failed:", result.hookError);
      await analytics.captureException(result.hookError, undefined, { $exception_fingerprint: "api.tick.agent_hooks" });
    }
    if (result.slackError) {
      console.error("slack notify failed:", result.slackError);
      await analytics.captureException(result.slackError, undefined, { $exception_fingerprint: "api.tick.slack" });
    }
    return c.json(result);
  });

  // --- Slack: the app's install callback, button clicks and /meerko. Clicks and commands are signed by Slack. ---

  const slackSettings = (outcome: string) => (deps.appUrl ? `${deps.appUrl.replace(/\/$/, "")}/app/settings?slack=${outcome}#slack` : undefined);

  app.get("/slack/oauth/callback", async (c) => {
    if (!deps.slack) return c.html(resultPage("Slack isn't set up", "This Meerko server has no Slack app configured."), 404);
    const { code, state, error } = c.req.query();
    const done = (outcome: string, title: string, message: string, status: 200 | 400 = 200) => {
      const to = slackSettings(outcome);
      return to ? c.redirect(to) : c.html(resultPage(title, message), status);
    };
    if (error || !code || !state) return done("cancelled", "Slack wasn't connected", "The install was cancelled.", 400);
    try {
      const { workspaceId, userId } = await completeSlackInstall(db, box, deps.slack, { code, state }, { fetch: deps.slackFetch });
      await analytics.capture({ distinctId: userId, event: EVENTS.slackConnected, workspaceId, properties: { kind: "app" } });
      return done("connected", "Slack is connected", "New replies and drafts will be posted to the channel you picked.");
    } catch (err) {
      if (err instanceof SlackError) return done("error", "Slack wasn't connected", err.message, 400);
      throw err;
    }
  });

  /** Reads a Slack request's form body after checking its signature; null means it isn't from Slack. */
  const slackForm = async (c: { req: { text: () => Promise<string>; header: (name: string) => string | undefined } }) => {
    if (!deps.slack) return null;
    const body = await c.req.text();
    const ok = verifySlackSignature(deps.slack.signingSecret, { timestamp: c.req.header("x-slack-request-timestamp"), signature: c.req.header("x-slack-signature"), body });
    return ok ? new URLSearchParams(body) : null;
  };

  app.post("/slack/interactions", async (c) => {
    const form = await slackForm(c);
    if (!form) return c.json({ error: "Bad signature" }, 401);
    let payload: SlackInteraction;
    try {
      payload = JSON.parse(form.get("payload") ?? "");
    } catch {
      return c.json({ error: "No payload" }, 400);
    }
    // Answered after the work (sending can take a few seconds); the message is updated through response_url.
    await handleSlackInteraction(db, { ...slackDeps(), approve: { box, oauth: deps.googleOAuth, microsoft: deps.microsoftOAuth, fetch: deps.gmailFetch, imap: deps.imap } }, payload);
    return c.body(null, 200);
  });

  app.post("/slack/commands", async (c) => {
    const form = await slackForm(c);
    if (!form) return c.json({ error: "Bad signature" }, 401);
    return c.json(await handleSlackCommand(db, slackDeps(), Object.fromEntries(form)));
  });

  // Public unsubscribe link from every email. GET shows a confirm button (link scanners only GET, so they
  // can't unsubscribe people); POST unsubscribes, and is also what Gmail's one-click unsubscribe sends.
  app.get("/u/:token", (c) => {
    const target = box ? readUnsubscribeToken(box, c.req.param("token")) : null;
    if (!target) return c.html(resultPage("Link not valid", "This unsubscribe link is broken or expired."), 400);
    return c.html(
      resultPage("Unsubscribe", `Stop all emails to ${target.email}?`).replace(
        "</body>",
        `<form method="post"><button style="font:inherit;padding:.5rem 1rem;cursor:pointer">Unsubscribe</button></form></body>`,
      ),
    );
  });

  app.post("/u/:token", async (c) => {
    const target = box ? readUnsubscribeToken(box, c.req.param("token")) : null;
    if (!target) return c.html(resultPage("Link not valid", "This unsubscribe link is broken or expired."), 400);
    await unsubscribe(db, target.workspaceId, target.email);
    return c.html(resultPage("Unsubscribed", `${target.email} won't receive any more emails from this sender.`));
  });

  // Stripe's webhooks, authenticated by their signature. A 500 makes Stripe retry for up to 3 days, and every
  // grant is keyed to its Stripe object, so retries and redeliveries never add credits twice.
  app.post("/stripe/webhook", async (c) => {
    if (!deps.billing) return c.json({ error: "Not found" }, 404);
    const payload = await c.req.text();
    let event;
    try {
      event = verifyStripeEvent(deps.billing, payload, c.req.header("stripe-signature") ?? "");
    } catch {
      return c.json({ error: "Invalid signature" }, 400);
    }
    try {
      const outcome = await handleStripeEvent(db, deps.billing, event);
      if (outcome?.type === "subscription") {
        await analytics.capture({ distinctId: outcome.workspaceId, event: EVENTS.subscriptionChanged, workspaceId: outcome.workspaceId, properties: { plan: outcome.plan, change: outcome.status } });
      } else if (outcome?.type === "credits" && outcome.granted) {
        await analytics.capture({ distinctId: outcome.workspaceId, event: EVENTS.creditsPurchased, workspaceId: outcome.workspaceId, properties: { credits: outcome.credits, reason: outcome.reason } });
      }
      return c.json({ received: true });
    } catch (err) {
      console.error(`stripe ${event.type} ${event.id} failed:`, err);
      await analytics.captureException(err, undefined, { $exception_fingerprint: "api.stripe.webhook", event_type: event.type });
      return c.json({ error: "Webhook failed" }, 500);
    }
  });

  // Public: Google redirects the user's browser here, so it's authenticated by the encrypted `state`, not an API key.
  app.get("/oauth/google/callback", async (c) => {
    const { code, state, error } = c.req.query();
    // Only a genuine state carries a return URL, and it's re-checked against the dashboard origin.
    const returnTo = appReturnUrl(state ? readOAuthReturnTo(box, state) : undefined);
    const fail = (message: string) =>
      returnTo ? c.redirect(backToApp(returnTo, { gmail_error: message })) : c.html(resultPage("Gmail not connected", message), 400);
    if (error) return fail(`Google said: ${error}. Try connecting again.`);
    if (!code || !state) return fail("This link is missing its sign-in code.");
    try {
      const mailbox = await connectGmail(db, box, googleOAuth(), state, code, deps.gmailFetch, { enforcePlan: !!deps.billing });
      await analytics.capture({ distinctId: mailbox.workspaceId, event: EVENTS.mailboxConnected, workspaceId: mailbox.workspaceId, properties: { provider: "gmail" } });
      if (returnTo) return c.redirect(backToApp(returnTo, { gmail_connected: mailbox.email }));
      return c.html(resultPage("Gmail connected", `Meerko can now send from ${mailbox.email}. You can close this tab.`));
    } catch (err) {
      if (!(err instanceof GmailError) && !(err instanceof OAuthStateError) && !(err instanceof PlanLimitError)) console.error(err);
      return fail((err as Error).message);
    }
  });

  // Public: Microsoft redirects the user's browser here; authenticated by the encrypted `state`, like Google's.
  app.get("/oauth/microsoft/callback", async (c) => {
    const { code, state, error, error_description } = c.req.query();
    const returnTo = appReturnUrl(state ? readOAuthReturnTo(box, state) : undefined);
    const fail = (message: string) =>
      returnTo ? c.redirect(backToApp(returnTo, { gmail_error: message })) : c.html(resultPage("Outlook not connected", message), 400);
    if (error) return fail(`Microsoft said: ${(error_description ?? error).split("\r\n")[0]}. Try connecting again.`);
    if (!code || !state) return fail("This link is missing its sign-in code.");
    if (!deps.microsoftOAuth) return fail("Outlook isn't configured on this server.");
    try {
      const mailbox = await connectOutlook(db, box, deps.microsoftOAuth, state, code, deps.gmailFetch, { enforcePlan: !!deps.billing });
      await analytics.capture({ distinctId: mailbox.workspaceId, event: EVENTS.mailboxConnected, workspaceId: mailbox.workspaceId, properties: { provider: "outlook" } });
      if (returnTo) return c.redirect(backToApp(returnTo, { gmail_connected: mailbox.email }));
      return c.html(resultPage("Outlook connected", `Meerko can now send from ${mailbox.email}. You can close this tab.`));
    } catch (err) {
      if (!(err instanceof GmailError) && !(err instanceof OAuthStateError) && !(err instanceof PlanLimitError)) console.error(err);
      return fail((err as Error).message);
    }
  });

  // --- Dashboard sign-in (public routes) ---
  // The API owns sign-in so the web app, CLI and self-hosted installs share one model. The API and the
  // web app live on different domains, so the callback hands the web app a one-time code, which its
  // server exchanges for a session token.
  const NONCE_COOKIE = "meerko_signin_nonce";
  const SIGN_IN_TTL_MS = 10 * 60_000;
  const signInEnabled = () => !!(deps.googleSignIn && deps.appUrl && box);
  const toLogin = (error: string) => backToApp(new URL("/login", deps.appUrl).toString(), { error });

  app.get("/auth/config", (c) => c.json({ google: signInEnabled(), signup: deps.signup ?? "invite" }));

  app.get("/auth/google/start", (c) => {
    if (!signInEnabled()) throw new HTTPException(404, { message: "Google sign-in isn't configured on this server" });
    // The nonce cookie ties the callback to this browser, so nobody can sign you in to their account (login CSRF).
    const nonce = randomBytes(16).toString("base64url");
    setCookie(c, NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/auth/google",
      maxAge: SIGN_IN_TTL_MS / 1000,
    });
    const state = Buffer.from(box!.encrypt(JSON.stringify({ n: nonce, exp: Date.now() + SIGN_IN_TTL_MS })), "base64").toString("base64url");
    return c.redirect(deps.googleSignIn!.signInUrl(state));
  });

  app.get("/auth/google/callback", async (c) => {
    if (!signInEnabled()) throw new HTTPException(404, { message: "Google sign-in isn't configured on this server" });
    const { code, state, error } = c.req.query();
    const nonce = getCookie(c, NONCE_COOKIE);
    deleteCookie(c, NONCE_COOKIE, { path: "/auth/google" });
    if (error) return c.redirect(toLogin(error === "access_denied" ? "Sign-in was cancelled." : `Google said: ${error}`));
    let payload: { n?: string; exp?: number } = {};
    try {
      payload = JSON.parse(box!.decrypt(Buffer.from(state ?? "", "base64url").toString("base64")));
    } catch {
      // Falls through to the checks below.
    }
    if (!code || !nonce || payload.n !== nonce || !payload.exp || payload.exp < Date.now()) {
      return c.redirect(toLogin("That sign-in link expired or came from another browser. Try again."));
    }
    try {
      const profile = await deps.googleSignIn!.signInProfile(code);
      const { userId, workspaceId, newUser } = await signInWithGoogle(db, profile, deps.signup ?? "invite");
      const person = { email: profile.email, name: profile.name ?? null };
      if (newUser) await analytics.capture({ distinctId: userId, event: EVENTS.signUp, workspaceId, properties: { method: "google" }, set: person });
      await analytics.capture({ distinctId: userId, event: EVENTS.signInCompleted, workspaceId, properties: { method: "google" }, set: person });
      const authCode = await createAuthCode(db, userId, workspaceId);
      return c.redirect(backToApp(new URL("/auth/callback", deps.appUrl).toString(), { code: authCode }));
    } catch (err) {
      if (err instanceof SignInError) return c.redirect(toLogin(err.message));
      console.error(err);
      return c.redirect(toLogin("Sign-in failed. Try again."));
    }
  });

  /** Called by the web app's server with the one-time code; returns the session token once. */
  app.post("/auth/exchange", async (c) => {
    const { code } = await parse(z.object({ code: z.string().min(1) }), await c.req.json().catch(() => ({})));
    const session = await exchangeAuthCode(db, code);
    if (!session) throw new HTTPException(400, { message: "This sign-in code is invalid or expired" });
    return c.json({ token: session.token, expires_at: session.expiresAt });
  });

  app.post("/auth/logout", async (c) => {
    const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (token) await deleteSession(db, token);
    return c.body(null, 204);
  });


  // --- Credentials ---
  const bearer = (c: Context) => c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  /**
   * Dashboard sessions (ms_…), API keys (mk_…) and OAuth access tokens (mo_…) all act on one workspace.
   * Only a session carries a user, so only a signed-in person can manage keys and connected apps.
   */
  const authenticate = async (token: string) => {
    if (!token) return null;
    const session = await verifySession(db, token);
    if (session) {
      const user = { id: session.userId, email: session.email, name: session.name, role: session.role };
      return { workspaceId: session.workspaceId, workspaceName: session.workspaceName, user, actor: { id: user.id, email: user.email }, scope: "full" as ApiKeyScope };
    }
    // An OAuth app acts for the person who approved it. It still gets no `user`, so it can't manage keys or apps;
    // `actor` only tells analytics who it is.
    const oauth = await verifyAccessToken(db, token);
    if (oauth) return { workspaceId: oauth.workspaceId, workspaceName: oauth.workspaceName, user: null, actor: { id: oauth.userId, email: oauth.email }, scope: "full" as ApiKeyScope };
    const key = await verifyApiKey(db, token);
    return key ? { workspaceId: key.workspaceId, workspaceName: key.workspaceName, user: null, actor: null, scope: key.scope } : null;
  };

  // --- OAuth for MCP clients and the CLI (see core/oauth.ts) ---
  const issuer = (c: Context) => (deps.publicUrl ?? new URL(c.req.url).origin).replace(/\/$/, "");
  const oauthEnabled = () => !!(box && deps.appUrl);
  const oauthError = (c: Context, err: unknown) => {
    if (!(err instanceof OAuthError)) throw err;
    return c.json({ error: err.error, error_description: err.message }, err.error === "invalid_client" ? 401 : 400, { "cache-control": "no-store" });
  };
  // Browser-based MCP clients (e.g. the MCP Inspector) call these cross-origin. No cookies are involved.
  const publicCors = cors({ origin: "*", allowHeaders: ["authorization", "content-type", "mcp-protocol-version"], exposeHeaders: ["www-authenticate"] });
  app.use("/.well-known/*", publicCors);
  app.use("/oauth/register", publicCors);
  app.use("/oauth/token", publicCors);
  app.use("/oauth/revoke", publicCors);
  app.use("/mcp", publicCors);
  app.use("/mcp/drafter", publicCors);

  // RFC 9728: tells MCP clients where to sign in for /mcp (and /mcp/drafter, the same sign-in).
  const resourceMetadata = (path: string, name: string) => (c: Context) =>
    c.json({ resource: `${issuer(c)}/${path}`, authorization_servers: [issuer(c)], bearer_methods_supported: ["header"], resource_name: name });
  app.get("/.well-known/oauth-protected-resource", resourceMetadata("mcp", "Meerko"));
  app.get("/.well-known/oauth-protected-resource/mcp", resourceMetadata("mcp", "Meerko"));
  app.get("/.well-known/oauth-protected-resource/mcp/drafter", resourceMetadata("mcp/drafter", "Meerko (drafts only)"));

  // RFC 8414
  const serverMetadata = (c: Context) => {
    if (!oauthEnabled()) return c.json({ error: "OAuth isn't configured on this server (needs MEERKO_ENCRYPTION_KEY and MEERKO_APP_URL)" }, 404);
    const base = issuer(c);
    return c.json({
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/register`,
      revocation_endpoint: `${base}/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      authorization_response_iss_parameter_supported: true,
    });
  };
  app.get("/.well-known/oauth-authorization-server", serverMetadata);
  app.get("/.well-known/oauth-authorization-server/mcp", serverMetadata);
  app.get("/.well-known/oauth-authorization-server/mcp/drafter", serverMetadata);

  // RFC 7591 dynamic client registration. Clients are public (no secret); PKCE protects the code.
  app.post("/oauth/register", async (c) => {
    if (!oauthEnabled()) return c.json({ error: "temporarily_unavailable", error_description: "OAuth isn't configured on this server" }, 503);
    const body = (await c.req.json().catch(() => null)) as { client_name?: unknown; redirect_uris?: unknown } | null;
    const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
    try {
      const client = await registerOAuthClient(db, { name: typeof body?.client_name === "string" ? body.client_name : undefined, redirectUris });
      return c.json(
        {
          client_id: client.id,
          client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
          client_name: client.name,
          redirect_uris: client.redirectUris,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        },
        201,
      );
    } catch (err) {
      return oauthError(c, err);
    }
  });

  // The person's browser: checks the request, then hands it to the dashboard's consent page.
  app.get("/oauth/authorize", async (c) => {
    if (!oauthEnabled()) return c.html(resultPage("Can't connect", "OAuth isn't configured on this Meerko server."), 404);
    try {
      const result = await startAuthorization(db, box!, c.req.query());
      if (result.redirect) return c.redirect(result.redirect);
      const consent = new URL("/oauth/consent", deps.appUrl);
      consent.searchParams.set("request", result.request!);
      return c.redirect(consent.toString());
    } catch (err) {
      if (!(err instanceof OAuthError)) throw err;
      return c.html(resultPage("Can't connect this app", err.message), 400);
    }
  });

  app.post("/oauth/token", async (c) => {
    const type = c.req.header("content-type") ?? "";
    const raw = type.includes("application/json") ? await c.req.json().catch(() => ({})) : await c.req.parseBody().catch(() => ({}));
    const f = Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    try {
      let tokens;
      if (f.grant_type === "authorization_code") {
        tokens = await exchangeOAuthCode(db, { code: f.code, clientId: f.client_id, redirectUri: f.redirect_uri, codeVerifier: f.code_verifier });
      } else if (f.grant_type === "refresh_token") {
        tokens = await refreshOAuthToken(db, { refreshToken: f.refresh_token, clientId: f.client_id });
      } else {
        throw new OAuthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
      }
      return c.json(tokens, 200, { "cache-control": "no-store" });
    } catch (err) {
      return oauthError(c, err);
    }
  });

  // RFC 7009: always 200, whether or not the token existed.
  app.post("/oauth/revoke", async (c) => {
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    if (typeof body.token === "string") await revokeOAuthToken(db, body.token);
    return c.body(null, 200);
  });

  // --- Hosted MCP server (Streamable HTTP, stateless) ---
  // Remote clients sign in with OAuth; an API key in the Authorization header also works.
  // `drafter` serves only the reply tools, for an agent woken by an agent hook (a Claude Code routine adds this URL
  // as its connector). The API enforces the same limit on every call it makes.
  const serveMcp = async (c: Context, drafter: boolean) => {
    const token = bearer(c);
    const auth = await authenticate(token);
    const resource = drafter ? "mcp/drafter" : "mcp";
    if (!auth) {
      const metadata = `${issuer(c)}/.well-known/oauth-protected-resource/${resource}`;
      const error = token ? `, error="invalid_token", error_description="The access token is invalid or expired"` : "";
      return c.json({ error: "Sign in to use Meerko" }, 401, { "www-authenticate": `Bearer resource_metadata="${metadata}"${error}` });
    }
    // The tools call this same API in-process, as the caller, through the usual HTTP routes.
    const inProcess = (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (drafter) headers.set(SCOPE_HEADER, "replies");
      return app.request(input instanceof URL ? input.toString() : input, { ...init, headers });
    };
    const client = new MeerkoClient({ apiUrl: issuer(c), apiKey: token, fetch: inProcess as typeof fetch });
    const server = createMcpServer(() => client, drafter ? { only: { tools: DRAFTER_TOOLS, prompts: DRAFTER_PROMPTS } } : {});
    // PostHog MCP analytics ($mcp_tool_call, sessions, intent, errors). Instrumented here, not in createServer,
    // so the tool reference generated from packages/mcp keeps the schemas without PostHog's injected arguments.
    if (analytics.posthog) {
      instrument(server, analytics.posthog, {
        // The same person as on the web dashboard (user id), so agent and dashboard activity join up.
        identify: async () => ({
          distinctId: auth.actor?.id ?? auth.workspaceId,
          properties: auth.actor ? { email: auth.actor.email } : { workspace_name: auth.workspaceName },
          groups: { workspace: auth.workspaceId },
        }),
        // The recorded initialize request includes its HTTP headers, among them the caller's IP (forwarded,
        // x-forwarded-for). Analytics doesn't need them, so they never leave the server.
        beforeSend: (event) => {
          const params = event.properties?.$mcp_parameters as { extra?: unknown } | undefined;
          if (params && typeof params === "object") delete params.extra;
          return event;
        },
        serverBuild: analytics.common.$release,
        eventProperties: async () => ({ ...analytics.common, surface: drafter ? "mcp_drafter" : "mcp" }),
        logger: (message) => console.warn(`[posthog-mcp] ${message}`),
      });
    }
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close();
      // Cloud Run throttles CPU once the response is sent, so events go out before it.
      await analytics.posthog?.flush().catch(() => {});
    }
  };
  app.post("/mcp", (c) => serveMcp(c, false));
  app.post("/mcp/drafter", (c) => serveMcp(c, true));
  // Stateless: no server-initiated stream to open and no session to end.
  app.on(["GET", "DELETE"], ["/mcp", "/mcp/drafter"], (c) => c.json({ error: "Method not allowed" }, 405, { allow: "POST" }));

  const v1 = new Hono<Env>();

  v1.use(async (c, next) => {
    const auth = await authenticate(bearer(c));
    if (!auth) throw new HTTPException(401, { message: "Missing or invalid API key" });
    const scope: ApiKeyScope = c.req.header(SCOPE_HEADER) === "replies" ? "replies" : auth.scope;
    if (scope === "replies") {
      const path = new URL(c.req.url).pathname;
      if (!REPLIES_SCOPE_ROUTES.some(([method, re]) => method === c.req.method && re.test(path))) {
        throw new HTTPException(403, { message: "This credential can only read replies and save drafts" });
      }
    }
    c.set("scope", scope);
    c.set("workspaceId", auth.workspaceId);
    c.set("workspaceName", auth.workspaceName);
    c.set("user", auth.user);
    c.set("actorId", auth.actor?.id ?? auth.workspaceId);
    await next();
  });

  /** Who an event is about: the person behind a session or an OAuth app, or the workspace for API keys. */
  const actor = (c: { var: Env["Variables"] }) => c.var.actorId;

  v1.get("/me", (c) => c.json({ user: c.var.user, workspace: { id: c.var.workspaceId, name: c.var.workspaceName } }));

  // Keys are listed with any credential, but only a signed-in person can mint or revoke one,
  // so a leaked key can't create more.
  const requireUser = (c: { var: Env["Variables"] }, message = "Sign in to the dashboard to manage API keys") => {
    if (!c.var.user) throw new HTTPException(403, { message });
  };

  // The dashboard's consent page (a signed-in person) approves or declines an app's request.
  v1.post("/oauth/requests/describe", async (c) => {
    requireUser(c, "Sign in to the dashboard to connect apps");
    if (!oauthEnabled()) throw new HTTPException(404, { message: "OAuth isn't configured on this server" });
    const { request } = await parse(oauthRequestInput, await c.req.json().catch(() => ({})));
    try {
      const info = await describeAuthorization(db, box!, request);
      return c.json({ client_name: info.clientName, redirect_to: info.redirectTo, workspace: c.var.workspaceName });
    } catch (err) {
      if (err instanceof OAuthError) throw new HTTPException(400, { message: err.message });
      throw err;
    }
  });

  v1.post("/oauth/requests/decide", async (c) => {
    requireUser(c, "Sign in to the dashboard to connect apps");
    if (!oauthEnabled()) throw new HTTPException(404, { message: "OAuth isn't configured on this server" });
    const { request, approve } = await parse(oauthDecideInput, await c.req.json().catch(() => ({})));
    try {
      // Named before approving, while the request is certainly still readable.
      const clientName = approve ? (await describeAuthorization(db, box!, request).catch(() => null))?.clientName : null;
      const redirectTo = approve
        ? await approveAuthorization(db, box!, request, { userId: c.var.user!.id, workspaceId: c.var.workspaceId }, issuer(c))
        : denyAuthorization(box!, request);
      if (approve) {
        await analytics.capture({ distinctId: c.var.user!.id, event: EVENTS.aiClientConnected, workspaceId: c.var.workspaceId, properties: { client_name: clientName } });
      }
      return c.json({ redirect_to: redirectTo });
    } catch (err) {
      if (err instanceof OAuthError) throw new HTTPException(400, { message: err.message });
      throw err;
    }
  });

  v1.get("/connected-apps", async (c) => c.json({ apps: await listConnectedApps(db, c.var.workspaceId) }));

  v1.delete("/connected-apps/:id", async (c) => {
    requireUser(c, "Sign in to the dashboard to disconnect apps");
    await revokeConnectedApp(db, c.var.workspaceId, c.req.param("id"));
    return c.body(null, 204);
  });


  v1.get("/api-keys", async (c) => c.json({ api_keys: await listApiKeys(db, c.var.workspaceId) }));

  v1.post("/api-keys", async (c) => {
    requireUser(c);
    const { name, scope } = await parse(createApiKeyInput, await c.req.json().catch(() => ({})));
    const { id, key } = await createApiKey(db, c.var.workspaceId, name, scope);
    await analytics.capture({ distinctId: c.var.user!.id, event: EVENTS.apiKeyCreated, workspaceId: c.var.workspaceId, properties: { scope } });
    return c.json({ id, name, scope, key }, 201);
  });

  v1.delete("/api-keys/:id", async (c) => {
    requireUser(c);
    await revokeApiKey(db, c.var.workspaceId, c.req.param("id"));
    return c.body(null, 204);
  });

  // Agent hook: rings the user's own agent when replies arrive. Managed by a signed-in person, like keys.
  v1.get("/agent-hook", async (c) => c.json({ hook: await getAgentHook(db, c.var.workspaceId) }));

  v1.put("/agent-hook", async (c) => {
    requireUser(c, "Sign in to the dashboard to set up your agent");
    const input = await parse(agentHookInput, await c.req.json().catch(() => ({})));
    const { hook, secret } = await setAgentHook(db, box, c.var.workspaceId, input, { allowPrivate: deps.allowPrivateHooks });
    await analytics.capture({ distinctId: c.var.user!.id, event: EVENTS.agentHookConfigured, workspaceId: c.var.workspaceId, properties: { kind: input.kind } });
    return c.json(secret ? { hook, secret } : { hook });
  });

  v1.delete("/agent-hook", async (c) => {
    requireUser(c, "Sign in to the dashboard to set up your agent");
    await deleteAgentHook(db, c.var.workspaceId);
    return c.body(null, 204);
  });

  v1.post("/agent-hook/enable", async (c) => {
    requireUser(c, "Sign in to the dashboard to set up your agent");
    await enableAgentHook(db, c.var.workspaceId);
    return c.json({ hook: await getAgentHook(db, c.var.workspaceId) });
  });

  v1.post("/agent-hook/test", async (c) => {
    requireUser(c, "Sign in to the dashboard to set up your agent");
    const result = await testAgentHook(db, c.var.workspaceId, { box, appUrl: deps.appUrl, fetch: deps.hookFetch, allowPrivate: deps.allowPrivateHooks });
    return c.json(result);
  });

  // Slack: where replies and drafts are posted. Managed by a signed-in person, like the agent hook.
  v1.get("/slack", async (c) => c.json({ connection: await getSlackConnection(db, c.var.workspaceId), app_available: !!deps.slack }));

  v1.get("/slack/install", async (c) => {
    requireUser(c, "Sign in to the dashboard to connect Slack");
    if (!deps.slack) throw new HTTPException(404, { message: "This server has no Slack app; paste an incoming webhook URL instead" });
    if (!box) throw new EncryptionNotConfiguredError();
    return c.json({ url: slackInstallUrl(deps.slack, box, { workspaceId: c.var.workspaceId, userId: c.var.user!.id }) });
  });

  v1.put("/slack/webhook", async (c) => {
    requireUser(c, "Sign in to the dashboard to connect Slack");
    const { url } = await parse(slackWebhookInput, await c.req.json().catch(() => ({})));
    const connection = await setSlackWebhook(db, box, c.var.workspaceId, url, { fetch: deps.slackFetch });
    await analytics.capture({ distinctId: c.var.user!.id, event: EVENTS.slackConnected, workspaceId: c.var.workspaceId, properties: { kind: "webhook" } });
    return c.json({ connection });
  });

  v1.post("/slack/test", async (c) => {
    requireUser(c, "Sign in to the dashboard to connect Slack");
    return c.json(await testSlack(db, c.var.workspaceId, slackDeps()));
  });

  v1.delete("/slack", async (c) => {
    requireUser(c, "Sign in to the dashboard to connect Slack");
    await deleteSlackConnection(db, c.var.workspaceId);
    return c.body(null, 204);
  });

  v1.get("/tables", async (c) => c.json({ tables: await listTables(db, c.var.workspaceId) }));

  v1.post("/tables", async (c) => {
    const input = await parse(createTableInput, await c.req.json());
    return c.json({ table: await createTable(db, c.var.workspaceId, input) }, 201);
  });

  v1.get("/tables/:id", async (c) => c.json({ table: await getTable(db, c.var.workspaceId, c.req.param("id")) }));

  v1.post("/tables/:id/columns", async (c) => {
    const input = await parse(columnInput, await c.req.json());
    return c.json({ table: await addColumn(db, c.var.workspaceId, c.req.param("id"), input) });
  });

  v1.post("/tables/:id/rows", async (c) => {
    const { rows } = await parse(insertRowsInput, await c.req.json());
    return c.json(await insertRows(db, c.var.workspaceId, c.req.param("id"), rows), 201);
  });

  v1.patch("/tables/:id/rows", async (c) => {
    const { updates } = await parse(updateRowsInput, await c.req.json());
    return c.json(await updateRows(db, c.var.workspaceId, c.req.param("id"), updates));
  });

  v1.get("/tables/:id/columns/:column/pending", async (c) => {
    const opts = await parse(queryInput, c.req.query());
    return c.json(await getPendingCells(db, c.var.workspaceId, c.req.param("id"), c.req.param("column"), opts));
  });

  v1.get("/tables/:id/rows", async (c) => {
    const opts = await parse(queryInput, c.req.query());
    return c.json({ rows: await queryRows(db, c.var.workspaceId, c.req.param("id"), opts) });
  });

  v1.get("/credits", async (c) =>
    c.json({
      enabled: credits.enabled,
      balance: credits.enabled ? await getBalance(db, c.var.workspaceId) : null,
      // Where a person tops up; agents can hand this link over when a lookup runs out.
      ...(deps.billing ? { plan: (await getBilling(db, c.var.workspaceId)).plan, buy_url: `${deps.appUrl}/app/settings#billing` } : {}),
    }),
  );

  // --- Billing (Meerko Cloud only) ---
  const billing = () => {
    if (!deps.billing) throw new HTTPException(404, { message: "Billing isn't enabled on this server" });
    return deps.billing;
  };
  /** Money moves only for a signed-in owner, never for an API key or an agent. */
  const requireOwner = (c: { var: Env["Variables"] }) => {
    requireUser(c, "Sign in to the dashboard to manage billing");
    if (c.var.user!.role !== "owner") throw new HTTPException(403, { message: "Only a workspace owner can manage billing" });
  };

  v1.get("/billing", async (c) => {
    if (!deps.billing) return c.json({ enabled: false });
    const b = await getBilling(db, c.var.workspaceId);
    return c.json({
      enabled: true,
      plan: b.plan,
      status: b.status,
      current_period_end: b.currentPeriodEnd,
      cancel_at_period_end: b.cancelAtPeriodEnd,
      has_customer: !!b.customerId,
      balance: await getBalance(db, c.var.workspaceId),
      pro_monthly_credits: PRO_MONTHLY_CREDITS,
      credit_pack: CREDIT_PACK_CREDITS,
    });
  });

  v1.post("/billing/checkout", async (c) => {
    const cfg = billing();
    requireOwner(c);
    const input = await parse(checkoutInput, await c.req.json().catch(() => ({})));
    const url = await startCheckout(db, cfg, c.var.workspaceId, c.var.user!.email, input);
    await analytics.capture({ distinctId: c.var.user!.id, event: EVENTS.checkoutStarted, workspaceId: c.var.workspaceId, properties: { kind: input.kind } });
    return c.json({ url });
  });

  v1.post("/billing/portal", async (c) => {
    const cfg = billing();
    requireOwner(c);
    return c.json({ url: await openPortal(db, cfg, c.var.workspaceId) });
  });

  v1.post("/tables/:id/enrich", async (c) => {
    const input = await parse(enrichInput, await c.req.json());
    const enrichment = await enrichmentFor(c.var.workspaceId);
    const result = await enrichRows(db, c.var.workspaceId, c.req.param("id"), enrichment.providers, input, enrichment.credits);
    await analytics.capture({ distinctId: actor(c), event: EVENTS.rowsEnriched, workspaceId: c.var.workspaceId, properties: { fields: input.fields, limit: input.limit } });
    return c.json(result);
  });

  for (const kind of ["people", "companies"] as const) {
    v1.post(`/search/${kind}/count`, async (c) => {
      const { query } = await parse(countInput, await c.req.json());
      const icy = await icypeasFor(c.var.workspaceId);
      return c.json({ total: await countLeads(icy.client, kind, query as IcypeasQuery) });
    });

    v1.post(`/search/${kind}`, async (c) => {
      const input = await parse(searchInput, await c.req.json());
      const icy = await icypeasFor(c.var.workspaceId);
      const result = await searchLeads(
        db,
        c.var.workspaceId,
        icy.client,
        { kind, query: input.query as IcypeasQuery, limit: input.limit, tableId: input.table_id, tableName: input.table_name },
        icy.credits,
      );
      await analytics.capture({ distinctId: actor(c), event: EVENTS.leadsSearched, workspaceId: c.var.workspaceId, properties: { kind, limit: input.limit ?? null } });
      return c.json(result, 201);
    });
  }

  // How this server connects Gmail, for the dashboard, CLI and MCP to offer the right way.
  v1.get("/mailboxes/connect", async (c) =>
    c.json({
      oauth: !!(deps.gmailOAuthConnect && deps.googleOAuth),
      outlook: !!deps.microsoftOAuth,
      // Where a person enters a mailbox password themselves (agents must never handle it).
      url: deps.appUrl ? new URL("/app/settings?connect=gmail", deps.appUrl).toString() : null,
    }),
  );

  v1.post("/mailboxes/gmail/app-password", async (c) => {
    const input = await parse(gmailAppPasswordInput, await c.req.json());
    // Each attempt signs in to Google, so don't let a workspace use this to test passwords.
    if (!connectAttempts.allow(c.var.workspaceId)) throw new HTTPException(429, { message: "Too many attempts. Wait a few minutes and try again." });
    const mailbox = await connectGmailAppPassword(
      db,
      box,
      c.var.workspaceId,
      { email: input.email, password: input.password, login: input.login, displayName: input.display_name },
      { enforcePlan: !!deps.billing, imap: deps.imap },
    );
    await analytics.capture({ distinctId: actor(c), event: EVENTS.mailboxConnected, workspaceId: c.var.workspaceId, properties: { provider: "gmail_imap" } });
    return c.json({ mailbox }, 201);
  });

  // Any provider over IMAP and SMTP: Zoho, Fastmail, a host's own mail server.
  v1.post("/mailboxes/imap", async (c) => {
    const input = await parse(imapMailboxInput, await c.req.json());
    if (!connectAttempts.allow(c.var.workspaceId)) throw new HTTPException(429, { message: "Too many attempts. Wait a few minutes and try again." });
    const mailbox = await connectImapMailbox(
      db,
      box,
      c.var.workspaceId,
      {
        email: input.email,
        password: input.password,
        login: input.login,
        displayName: input.display_name,
        servers: { imap: { host: input.imap_host, port: input.imap_port }, smtp: { host: input.smtp_host, port: input.smtp_port } },
      },
      { enforcePlan: !!deps.billing, imap: deps.imap },
    );
    await analytics.capture({ distinctId: actor(c), event: EVENTS.mailboxConnected, workspaceId: c.var.workspaceId, properties: { provider: "imap", imap_host: mailbox.servers?.imap.host ?? null } });
    return c.json({ mailbox }, 201);
  });

  v1.post("/mailboxes/outlook/connect", async (c) => {
    if (!deps.microsoftOAuth) throw new HTTPException(503, { message: "Outlook isn't configured on this server (set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET)" });
    const { login_hint, return_to } = await parse(oauthConnectInput, await c.req.json().catch(() => ({})));
    const returnTo = appReturnUrl(return_to);
    if (return_to && deps.appUrl && !returnTo) throw new HTTPException(400, { message: "return_to must be on the dashboard's URL (MEERKO_APP_URL)" });
    return c.json({ url: deps.microsoftOAuth.authUrl(createOAuthState(box, c.var.workspaceId, returnTo), login_hint) });
  });

  v1.post("/mailboxes/gmail/connect", async (c) => {
    if (!deps.gmailOAuthConnect) {
      throw new HTTPException(400, { message: "This server connects Gmail with an app password: use `meerko mailboxes connect`, or Settings → Mailboxes in the dashboard" });
    }
    const { login_hint, return_to } = await parse(oauthConnectInput, await c.req.json().catch(() => ({})));
    // Without MEERKO_APP_URL the server can't vouch for any return URL, so the callback shows its own page instead.
    const returnTo = appReturnUrl(return_to);
    if (return_to && deps.appUrl && !returnTo) throw new HTTPException(400, { message: "return_to must be on the dashboard's URL (MEERKO_APP_URL)" });
    return c.json({ url: googleOAuth().authUrl(createOAuthState(box, c.var.workspaceId, returnTo), login_hint) });
  });

  v1.get("/mailboxes", async (c) => c.json({ mailboxes: await listMailboxes(db, c.var.workspaceId) }));

  v1.patch("/mailboxes/:id", async (c) => {
    const input = await parse(updateMailboxInput, await c.req.json());
    const mailbox = await updateMailbox(db, c.var.workspaceId, c.req.param("id"), {
      dailyLimit: input.daily_limit,
      displayName: input.display_name,
      ramp: input.ramp,
    });
    return c.json({ mailbox });
  });

  v1.get("/mailboxes/health", async (c) => c.json({ domains: await mailboxDomainHealth(db, c.var.workspaceId) }));

  v1.delete("/mailboxes/:id", async (c) => c.json({ deleted: await deleteMailbox(db, c.var.workspaceId, c.req.param("id")) }));

  v1.post("/mailboxes/:id/test", async (c) => {
    const { to } = await parse(testEmailInput, await c.req.json());
    const sent = await sendTestEmail(db, c.var.workspaceId, c.req.param("id"), to, { box, oauth: deps.googleOAuth, microsoft: deps.microsoftOAuth, fetch: deps.gmailFetch, imap: deps.imap });
    return c.json({ sent: true, messageId: sent.id });
  });

  v1.get("/sequences", async (c) => c.json({ sequences: await listSequences(db, c.var.workspaceId) }));

  v1.post("/sequences", async (c) => {
    const input = await parse(createSequenceInput, await c.req.json());
    const seq = await createSequence(db, c.var.workspaceId, {
      ...toSequenceInput(input),
      tableId: input.table_id,
      mailboxIds: toSequenceInput(input).mailboxIds!,
      name: input.name,
      steps: input.steps.map((s) => ({ subject: s.subject, body: s.body, delayDays: s.delay_days })),
    });
    return c.json({ sequence: await getSequence(db, c.var.workspaceId, seq.id) }, 201);
  });

  v1.get("/sequences/:id", async (c) => c.json({ sequence: await getSequence(db, c.var.workspaceId, c.req.param("id")) }));

  v1.patch("/sequences/:id", async (c) => {
    const input = await parse(updateSequenceInput, await c.req.json());
    const patch = Object.fromEntries(Object.entries(toSequenceInput(input)).filter(([, v]) => v !== undefined));
    return c.json({ sequence: await updateSequence(db, c.var.workspaceId, c.req.param("id"), patch) });
  });

  v1.get("/sequences/:id/preview", async (c) =>
    c.json(await previewSequence(db, c.var.workspaceId, c.req.param("id"), (await parse(previewQuery, c.req.query())).row_id || undefined)),
  );

  v1.post("/sequences/:id/enroll", async (c) => {
    const input = await parse(enrollInput, await c.req.json());
    return c.json(await enrollSequenceRows(db, c.var.workspaceId, c.req.param("id"), { rowIds: input.row_ids, filter: input.filter, limit: input.limit }));
  });

  v1.post("/sequences/:id/start", async (c) => {
    const sequence = await setSequenceStatus(db, c.var.workspaceId, c.req.param("id"), "active");
    await analytics.capture({ distinctId: actor(c), event: EVENTS.sequenceStarted, workspaceId: c.var.workspaceId });
    return c.json({ sequence });
  });
  v1.post("/sequences/:id/pause", async (c) => c.json({ sequence: await setSequenceStatus(db, c.var.workspaceId, c.req.param("id"), "paused") }));
  v1.get("/sequences/:id/pool", async (c) => c.json(await sequencePool(db, c.var.workspaceId, c.req.param("id"))));
  v1.get("/sequences/:id/stats", async (c) => c.json(await sequenceStats(db, c.var.workspaceId, c.req.param("id"))));
  v1.get("/sequences/:id/recipients", async (c) =>
    c.json({ recipients: await listSequenceRecipients(db, c.var.workspaceId, c.req.param("id")) }),
  );

  v1.get("/replies", async (c) => {
    const q = await parse(listRepliesQuery, c.req.query());
    const replies = await listReplies(db, c.var.workspaceId, {
      sequenceId: q.sequence_id,
      intent: q.intent,
      unclassified: q.unclassified ? q.unclassified === "true" : undefined,
      includeAutomatic: q.include_automatic === "true",
      limit: q.limit,
    });
    return c.json({ replies });
  });

  v1.post("/replies/:id/classify", async (c) => {
    const { intent, handled } = await parse(classifyInput, await c.req.json());
    return c.json({ reply: await classifyReply(db, c.var.workspaceId, c.req.param("id"), intent, handled) });
  });

  v1.post("/replies/:id/draft", async (c) => {
    const { body } = await parse(draftInput, await c.req.json());
    return c.json({ draft: await draftReply(db, c.var.workspaceId, c.req.param("id"), body) }, 201);
  });

  v1.get("/drafts", async (c) => {
    const { status } = await parse(listDraftsQuery, c.req.query());
    return c.json({ drafts: await listDrafts(db, c.var.workspaceId, status) });
  });

  v1.post("/drafts/:id/approve", async (c) => {
    const { body } = await parse(approveDraftInput, await c.req.json().catch(() => ({})));
    const sent = await approveDraft(db, c.var.workspaceId, c.req.param("id"), { box, oauth: deps.googleOAuth, microsoft: deps.microsoftOAuth, fetch: deps.gmailFetch, imap: deps.imap }, body);
    await syncSlackDraft(db, slackDeps(), c.req.param("id"), "sent", c.var.user ? (c.var.user.name ?? c.var.user.email) : undefined);
    return c.json(sent);
  });

  v1.post("/drafts/:id/discard", async (c) => {
    await discardDraft(db, c.var.workspaceId, c.req.param("id"));
    await syncSlackDraft(db, slackDeps(), c.req.param("id"), "discarded", c.var.user ? (c.var.user.name ?? c.var.user.email) : undefined);
    return c.json({ discarded: true });
  });

  // POST rather than DELETE-with-a-body, which some HTTP clients drop.
  v1.post("/tables/:id/rows/delete", async (c) => {
    const { row_ids } = await parse(deleteRowsInput, await c.req.json());
    return c.json(await deleteRows(db, c.var.workspaceId, c.req.param("id"), row_ids));
  });

  v1.delete("/tables/:id", async (c) => c.json(await deleteTable(db, c.var.workspaceId, c.req.param("id"))));

  v1.post("/tables/:id/rows/stage", async (c) => {
    const { row_ids, stage } = await parse(moveStageInput, await c.req.json());
    return c.json(await moveStage(db, c.var.workspaceId, c.req.param("id"), row_ids, stage));
  });

  v1.get("/pipeline", async (c) => c.json(await pipelineSummary(db, c.var.workspaceId, (await parse(pipelineQuery, c.req.query())).table_id || undefined)));

  v1.get("/provider-keys", async (c) => c.json({ keys: await listProviderKeys(db, c.var.workspaceId) }));

  v1.put("/provider-keys/:provider", async (c) => {
    const provider = await parse(byokProvider, c.req.param("provider"));
    const { key } = await parse(providerKeyInput, await c.req.json());
    if (!box) throw new EncryptionNotConfiguredError();
    // A free call proves the key works before it's stored: an Icypeas count, or a Firecrawl catalog search.
    try {
      if (provider === "firecrawl") await firecrawlForKey(key).checkKey();
      else await icypeasForKey(key).countCompanies({ location: { include: ["US"] } });
    } catch (err) {
      throw new HTTPException(400, { message: `${provider === "firecrawl" ? "Firecrawl" : "Icypeas"} rejected this key: ${(err as Error).message}` });
    }
    await setProviderKey(db, box, c.var.workspaceId, provider, key);
    return c.json({ provider, last4: key.slice(-4) });
  });

  v1.delete("/provider-keys/:provider", async (c) => {
    const provider = await parse(byokProvider, c.req.param("provider"));
    return c.json({ deleted: await deleteProviderKey(db, c.var.workspaceId, provider) });
  });

  app.route("/v1", v1);

  app.onError(async (err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    if (err instanceof InsufficientCreditsError) return c.json({ error: err.message }, 402);
    if (err instanceof SequenceError || err instanceof ReplyError || err instanceof AgentHookError || err instanceof SlackError) return c.json({ error: err.message }, 400);
    if (err instanceof MailboxInUseError || err instanceof TableInUseError) return c.json({ error: err.message }, 409);
    if (err instanceof MailboxConnectError) return c.json({ error: err.message }, 400);
    if (err instanceof PlanLimitError) return c.json({ error: err.message }, 402);
    if (err instanceof BillingError) return c.json({ error: err.message }, 409);
    if (isStripeError(err)) {
      // Still an exception (a bad key or a Stripe outage needs looking at), but the person gets a plain answer.
      console.error(err);
      await analytics.captureException(err, (c.var as Partial<Env["Variables"]>).actorId, { $exception_fingerprint: `api.stripe:${c.req.routePath}` });
      return c.json({ error: "Payments are unavailable right now. Try again in a minute." }, 502);
    }
    if (err instanceof EncryptionNotConfiguredError) return c.json({ error: err.message }, 503);
    if (err instanceof GmailError) return c.json({ error: err.message }, err.needsReconnect ? 409 : 502);
    if (err instanceof IcypeasError) {
      // Rejected filters are the caller's fault; anything else is an upstream failure.
      if (err.code === "insufficient_funds") return c.json({ error: "Lead search provider is out of credits" }, 402);
      if (err.validation) return c.json({ error: `Invalid search: ${err.message}` }, 400);
      console.error(err);
      return c.json({ error: "Lead search provider failed" }, 502);
    }
    // Postgres "invalid input syntax for type uuid" -> treat as not found.
    if ((err as { code?: string }).code === "22P02" || (err as { cause?: { code?: string } }).cause?.code === "22P02")
      return c.json({ error: "Not found" }, 404);
    console.error(err);
    // Only the unexpected 500s are exceptions; the mapped errors above are expected outcomes.
    const who = (c.var as Partial<Env["Variables"]>).actorId;
    await analytics.captureException(err, who, { $exception_fingerprint: `api:${c.req.method} ${c.req.routePath}`, path: c.req.path });
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
