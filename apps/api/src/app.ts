import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  addColumn,
  countLeads,
  createTable,
  enrichRows,
  connectGmail,
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
  createOAuthState,
  deleteMailbox,
  deleteProviderKey,
  GmailError,
  listMailboxes,
  OAuthStateError,
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
import type { Db } from "@meerko/db";

type Env = { Variables: { workspaceId: string } };

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

  app.get("/health", (c) => c.json({ ok: true }));

  const googleOAuth = () => {
    if (!deps.googleOAuth) throw new HTTPException(503, { message: "Gmail isn't configured on this server (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)" });
    return deps.googleOAuth;
  };

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
    if (error) return c.html(resultPage("Gmail not connected", `Google said: ${error}. Run \`meerko mailboxes connect\` to try again.`), 400);
    if (!code || !state) return c.html(resultPage("Gmail not connected", "This link is missing its sign-in code."), 400);
    try {
      const mailbox = await connectGmail(db, box, googleOAuth(), state, code, deps.gmailFetch);
      return c.html(resultPage("Gmail connected", `Meerko can now send from ${mailbox.email}. You can close this tab.`));
    } catch (err) {
      if (!(err instanceof GmailError) && !(err instanceof OAuthStateError)) console.error(err);
      return c.html(resultPage("Gmail not connected", (err as Error).message), 400);
    }
  });

  const v1 = new Hono<Env>();

  v1.use(async (c, next) => {
    const key = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const auth = key ? await verifyApiKey(db, key) : null;
    if (!auth) throw new HTTPException(401, { message: "Missing or invalid API key" });
    c.set("workspaceId", auth.workspaceId);
    await next();
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
    const { login_hint } = await parse(z.object({ login_hint: z.string().email().optional() }), await c.req.json().catch(() => ({})));
    return c.json({ url: googleOAuth().authUrl(createOAuthState(box, c.var.workspaceId), login_hint) });
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
    if (err instanceof SequenceError) return c.json({ error: err.message }, 400);
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
