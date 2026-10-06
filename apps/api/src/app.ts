import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  addColumn,
  countLeads,
  createTable,
  enrichRows,
  AGENT_INTENTS,
  moveStage,
  pipelineSummary,
  approveDraft,
  discardDraft,
  draftReply,
  listDrafts,
  classifyReply,
  connectGmail,
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
  IcypeasClient,
  icypeasProvider,
  InsufficientCreditsError,
  listProviderKeys,
  setProviderKey,
  BYOK_PROVIDERS,
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
  type CreditPolicy,
  type GoogleOAuth,
  type SecretBox,
  type IcypeasQuery,
} from "@meerko/core";
import { STAGES, type Db } from "@meerko/db";

type Env = {
  Variables: {
    workspaceId: string;
    workspaceName: string;
    /** Set for dashboard sessions; null for API keys (CLI, MCP, scripts). */
    user: { id: string; email: string; name: string | null; role: string } | null;
  };
};

const columnType = z.enum(["text", "number", "email", "url", "boolean", "json"]);
const columnInput = z.object({
  name: z.string().min(1),
  type: columnType.default("text"),
  prompt: z.string().min(1).optional(),
});
const updateRowsInput = z.object({
  updates: z.array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) })).max(1000),
});
const createTableInput = z.object({ name: z.string().min(1), columns: z.array(columnInput).optional() });
const insertRowsInput = z.object({ rows: z.array(z.record(z.string(), z.unknown())).max(10_000) });
const queryInput = z.object({
  filter: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return undefined;
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      } catch {}
      ctx.addIssue({ code: "custom", message: "filter must be a JSON object, e.g. {\"country\":\"Spain\"}" });
      return z.NEVER;
    }),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  stage: z.enum(STAGES).optional(),
});
// Filters are passed through to Icypeas, which validates field names and shapes itself.
const leadQuery = z.record(z.string(), z.record(z.string(), z.unknown())).refine((q) => Object.keys(q).length > 0, {
  message: "query needs at least one filter",
});
const searchInput = z.object({
  query: leadQuery,
  // Hard cap per call to bound credit spend until the credit ledger lands.
  limit: z.number().int().min(1).max(1000).default(25),
  table_id: z.string().optional(),
  table_name: z.string().min(1).optional(),
});
const countInput = z.object({ query: leadQuery });
const stepInput = z.object({
  subject: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(20_000),
  delay_days: z.number().int().min(0).max(60).optional(),
});
const sequenceFields = {
  name: z.string().min(1).max(200),
  mailbox_id: z.string(),
  steps: z.array(stepInput).min(1).max(10),
  timezone: z.string().optional(),
  window_start_hour: z.number().int().min(0).max(23).optional(),
  window_end_hour: z.number().int().min(1).max(24).optional(),
};
const createSequenceInput = z.object({ table_id: z.string(), ...sequenceFields });
const updateSequenceInput = z.object(sequenceFields).partial();
const toSequenceInput = (i: z.infer<typeof updateSequenceInput>) => ({
  name: i.name,
  mailboxId: i.mailbox_id,
  steps: i.steps?.map((s) => ({ subject: s.subject, body: s.body, delayDays: s.delay_days })),
  timezone: i.timezone,
  windowStartHour: i.window_start_hour,
  windowEndHour: i.window_end_hour,
});
const enrollInput = z.object({
  row_ids: z.array(z.string()).max(5000).optional(),
  filter: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});
const enrichInput = z.object({
  fields: z.array(z.enum(["email", "email_verification"])).min(1).default(["email", "email_verification"]),
  filter: z.record(z.string(), z.unknown()).optional(),
  // Rows are enriched synchronously, one at a time (~3s each), so keep calls small.
  limit: z.number().int().min(1).max(50).default(25),
  overwrite: z.boolean().default(false),
});

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
  /** Unset when GOOGLE_CLIENT_ID/SECRET aren't configured; Gmail routes then return 503. */
  googleOAuth?: GoogleOAuth;
  /** Overrides fetch for Gmail API calls (tests). */
  gmailFetch?: typeof fetch;
  /**
   * Enables POST /internal/tick for Cloud Scheduler (cloud runs no worker process). Unset when
   * MEERKO_TICK_SECRET isn't configured, and the route then answers 404.
   */
  tick?: { secret: string; publicUrl: string };
  /** The web dashboard's URL (MEERKO_APP_URL). Gmail connect may only send the browser back to this origin. */
  appUrl?: string;
  /**
   * "Sign in with Google" for the dashboard: an OAuth client whose redirect is /auth/google/callback.
   * Unset (self-hosting without Google, or no MEERKO_APP_URL) means the dashboard logs in with an API key.
   */
  googleSignIn?: GoogleOAuth;
  /** Who may sign in with Google: anyone (`open`) or invited emails only (`invite`, the default). */
  signup?: SignupMode;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const resultPage = (title: string, message: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body>`;

export function createApp(db: Db, deps: AppDeps = {}) {
  const credits = deps.credits ?? { enabled: false };
  const box = deps.secretBox ?? null;
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
      { box, oauth: googleOAuth(), publicUrl: deps.tick.publicUrl, fetch: deps.gmailFetch },
      { replies: c.req.query("replies") !== "0" },
    );
    if (result.replyError) console.error("reply scan failed:", result.replyError);
    return c.json(result);
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
      const mailbox = await connectGmail(db, box, googleOAuth(), state, code, deps.gmailFetch);
      if (returnTo) return c.redirect(backToApp(returnTo, { gmail_connected: mailbox.email }));
      return c.html(resultPage("Gmail connected", `Meerko can now send from ${mailbox.email}. You can close this tab.`));
    } catch (err) {
      if (!(err instanceof GmailError) && !(err instanceof OAuthStateError)) console.error(err);
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

  app.get("/auth/config", (c) => c.json({ google: signInEnabled() }));

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
      const { userId, workspaceId } = await signInWithGoogle(db, profile, deps.signup ?? "invite");
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

  const v1 = new Hono<Env>();

  v1.use(async (c, next) => {
    // Dashboard sessions (ms_…) and API keys (mk_…) both act on one workspace.
    const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const session = await verifySession(db, token);
    const auth = session ?? (token ? await verifyApiKey(db, token) : null);
    if (!auth) throw new HTTPException(401, { message: "Missing or invalid API key" });
    c.set("workspaceId", auth.workspaceId);
    c.set("workspaceName", auth.workspaceName);
    c.set("user", session ? { id: session.userId, email: session.email, name: session.name, role: session.role } : null);
    await next();
  });

  v1.get("/me", (c) => c.json({ user: c.var.user, workspace: { id: c.var.workspaceId, name: c.var.workspaceName } }));

  // Keys are listed with any credential, but only a signed-in person can mint or revoke one,
  // so a leaked key can't create more.
  const requireUser = (c: { var: Env["Variables"] }) => {
    if (!c.var.user) throw new HTTPException(403, { message: "Sign in to the dashboard to manage API keys" });
  };

  v1.get("/api-keys", async (c) => c.json({ api_keys: await listApiKeys(db, c.var.workspaceId) }));

  v1.post("/api-keys", async (c) => {
    requireUser(c);
    const { name } = await parse(z.object({ name: z.string().trim().min(1).max(100) }), await c.req.json().catch(() => ({})));
    const { id, key } = await createApiKey(db, c.var.workspaceId, name);
    return c.json({ id, name, key }, 201);
  });

  v1.delete("/api-keys/:id", async (c) => {
    requireUser(c);
    await revokeApiKey(db, c.var.workspaceId, c.req.param("id"));
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
    c.json({ enabled: credits.enabled, balance: credits.enabled ? await getBalance(db, c.var.workspaceId) : null }),
  );

  v1.post("/tables/:id/enrich", async (c) => {
    const input = await parse(enrichInput, await c.req.json());
    const icy = await icypeasFor(c.var.workspaceId);
    return c.json(await enrichRows(db, c.var.workspaceId, c.req.param("id"), [icypeasProvider(icy.client)], input, icy.credits));
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
      return c.json(result, 201);
    });
  }

  v1.post("/mailboxes/gmail/connect", async (c) => {
    const { login_hint, return_to } = await parse(
      z.object({ login_hint: z.string().email().optional(), return_to: z.string().url().optional() }),
      await c.req.json().catch(() => ({})),
    );
    // Without MEERKO_APP_URL the server can't vouch for any return URL, so the callback shows its own page instead.
    const returnTo = appReturnUrl(return_to);
    if (return_to && deps.appUrl && !returnTo) throw new HTTPException(400, { message: "return_to must be on the dashboard's URL (MEERKO_APP_URL)" });
    return c.json({ url: googleOAuth().authUrl(createOAuthState(box, c.var.workspaceId, returnTo), login_hint) });
  });

  v1.get("/mailboxes", async (c) => c.json({ mailboxes: await listMailboxes(db, c.var.workspaceId) }));

  v1.patch("/mailboxes/:id", async (c) => {
    const input = await parse(
      z.object({ daily_limit: z.number().int().min(1).max(500).optional(), display_name: z.string().max(100).nullable().optional() }),
      await c.req.json(),
    );
    const mailbox = await updateMailbox(db, c.var.workspaceId, c.req.param("id"), {
      dailyLimit: input.daily_limit,
      displayName: input.display_name,
    });
    return c.json({ mailbox });
  });

  v1.delete("/mailboxes/:id", async (c) => c.json({ deleted: await deleteMailbox(db, c.var.workspaceId, c.req.param("id")) }));

  v1.post("/mailboxes/:id/test", async (c) => {
    const { to } = await parse(z.object({ to: z.string().email() }), await c.req.json());
    const sent = await sendTestEmail(db, box, googleOAuth(), c.var.workspaceId, c.req.param("id"), to, deps.gmailFetch);
    return c.json({ sent: true, messageId: sent.id });
  });

  v1.get("/sequences", async (c) => c.json({ sequences: await listSequences(db, c.var.workspaceId) }));

  v1.post("/sequences", async (c) => {
    const input = await parse(createSequenceInput, await c.req.json());
    const seq = await createSequence(db, c.var.workspaceId, {
      ...toSequenceInput(input),
      tableId: input.table_id,
      mailboxId: input.mailbox_id,
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
    c.json(await previewSequence(db, c.var.workspaceId, c.req.param("id"), c.req.query("row_id") || undefined)),
  );

  v1.post("/sequences/:id/enroll", async (c) => {
    const input = await parse(enrollInput, await c.req.json());
    return c.json(await enrollSequenceRows(db, c.var.workspaceId, c.req.param("id"), { rowIds: input.row_ids, filter: input.filter, limit: input.limit }));
  });

  v1.post("/sequences/:id/start", async (c) => c.json({ sequence: await setSequenceStatus(db, c.var.workspaceId, c.req.param("id"), "active") }));
  v1.post("/sequences/:id/pause", async (c) => c.json({ sequence: await setSequenceStatus(db, c.var.workspaceId, c.req.param("id"), "paused") }));
  v1.get("/sequences/:id/stats", async (c) => c.json(await sequenceStats(db, c.var.workspaceId, c.req.param("id"))));

  v1.get("/replies", async (c) => {
    const q = await parse(
      z.object({
        sequence_id: z.string().optional(),
        intent: z.string().optional(),
        unclassified: z.enum(["true", "false"]).optional(),
        include_automatic: z.enum(["true", "false"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      c.req.query(),
    );
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
    const { intent, handled } = await parse(z.object({ intent: z.enum(AGENT_INTENTS), handled: z.boolean().optional() }), await c.req.json());
    return c.json({ reply: await classifyReply(db, c.var.workspaceId, c.req.param("id"), intent, handled) });
  });

  v1.post("/replies/:id/draft", async (c) => {
    const { body } = await parse(z.object({ body: z.string().min(1).max(20_000) }), await c.req.json());
    return c.json({ draft: await draftReply(db, c.var.workspaceId, c.req.param("id"), body) }, 201);
  });

  v1.get("/drafts", async (c) => {
    const { status } = await parse(z.object({ status: z.enum(["pending", "sent", "discarded"]).optional() }), c.req.query());
    return c.json({ drafts: await listDrafts(db, c.var.workspaceId, status) });
  });

  v1.post("/drafts/:id/approve", async (c) => {
    const { body } = await parse(z.object({ body: z.string().min(1).max(20_000).optional() }), await c.req.json().catch(() => ({})));
    return c.json(await approveDraft(db, c.var.workspaceId, c.req.param("id"), { box, oauth: googleOAuth(), fetch: deps.gmailFetch }, body));
  });

  v1.post("/drafts/:id/discard", async (c) => {
    await discardDraft(db, c.var.workspaceId, c.req.param("id"));
    return c.json({ discarded: true });
  });

  v1.post("/tables/:id/rows/stage", async (c) => {
    const { row_ids, stage } = await parse(z.object({ row_ids: z.array(z.string()).min(1).max(1000), stage: z.enum(STAGES) }), await c.req.json());
    return c.json(await moveStage(db, c.var.workspaceId, c.req.param("id"), row_ids, stage));
  });

  v1.get("/pipeline", async (c) => c.json(await pipelineSummary(db, c.var.workspaceId, c.req.query("table_id") || undefined)));

  v1.get("/provider-keys", async (c) => c.json({ keys: await listProviderKeys(db, c.var.workspaceId) }));

  v1.put("/provider-keys/:provider", async (c) => {
    const provider = await parse(z.enum(BYOK_PROVIDERS), c.req.param("provider"));
    const { key } = await parse(z.object({ key: z.string().min(8) }), await c.req.json());
    if (!box) throw new EncryptionNotConfiguredError();
    // A free count call proves the key works before it's stored.
    try {
      await icypeasForKey(key).countCompanies({ location: { include: ["US"] } });
    } catch (err) {
      throw new HTTPException(400, { message: `Icypeas rejected this key: ${(err as Error).message}` });
    }
    await setProviderKey(db, box, c.var.workspaceId, provider, key);
    return c.json({ provider, last4: key.slice(-4) });
  });

  v1.delete("/provider-keys/:provider", async (c) => {
    const provider = await parse(z.enum(BYOK_PROVIDERS), c.req.param("provider"));
    return c.json({ deleted: await deleteProviderKey(db, c.var.workspaceId, provider) });
  });

  app.route("/v1", v1);

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    if (err instanceof InsufficientCreditsError) return c.json({ error: err.message }, 402);
    if (err instanceof SequenceError || err instanceof ReplyError) return c.json({ error: err.message }, 400);
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
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
