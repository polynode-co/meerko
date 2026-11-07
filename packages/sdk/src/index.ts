import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { MailServers, ReplyIntent, Stage } from "./constants.ts";

export * from "./constants.ts";

export type ColumnType = "text" | "number" | "email" | "url" | "boolean" | "json";
export interface Column { key: string; name: string; type: ColumnType; prompt?: string }
export interface PendingCells {
  column: string;
  prompt: string;
  remaining: number;
  rows: { id: string; instruction: string; data: Record<string, unknown> }[];
}
export interface Table { id: string; name: string; columns: Column[]; rowCount: number; createdAt: string }
export interface Row { id: string; data: Record<string, unknown>; stage: Stage; stageChangedAt: string | null; createdAt: string }

export type LeadKind = "people" | "companies";
/** Icypeas filters, e.g. { currentJobTitle: { include: ["CTO"] }, "currentCompany.headcount": { ">=": 20 } }. */
export type LeadQuery = Record<string, Record<string, unknown>>;
export interface SearchResult {
  tableId: string;
  tableName: string;
  total: number;
  inserted: number;
  addedColumns: Column[];
}

export type EnrichField = "email" | "email_verification" | "phone";
export interface EnrichResult {
  processed: number;
  found: Record<EnrichField, number>;
  notFound: number;
  errors: number;
  firstError?: string;
  creditsSpent: number;
  remaining: number;
  stoppedReason?: "insufficient_credits";
  balance?: number;
}

export interface Me {
  user: { id: string; email: string; name: string | null; role: string } | null;
  workspace: { id: string; name: string };
}

/** A workspace is a brand. `role` is null for an API key, which belongs to the workspace rather than a person. */
export interface Workspace {
  id: string;
  name: string;
  role: "owner" | "member" | null;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  /** `replies`: may only read replies and save drafts. */
  scope: "full" | "replies";
  lastUsedAt: string | null;
  createdAt: string;
}

/** Where Meerko rings your own agent when replies arrive. The token or signing secret is never returned. */
export interface AgentHook {
  kind: "claude_routine" | "webhook";
  url: string;
  secretLast4: string;
  enabled: boolean;
  lastFiredAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
}

/** Where Meerko posts new replies and drafts in Slack: the Meerko Slack app (with buttons) or a pasted webhook. */
export interface SlackConnection {
  kind: "app" | "webhook";
  teamName: string | null;
  channelName: string | null;
  enabled: boolean;
  lastPostedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface Mailbox {
  id: string;
  /**
   * `gmail`: connected through Google's consent screen (Gmail API). `gmail_imap`: Gmail with an app password.
   * `imap`: any other provider over IMAP and SMTP, with its `servers`. `outlook`: Microsoft Graph, signed in with Microsoft.
   */
  provider: "gmail" | "gmail_imap" | "imap" | "outlook";
  email: string;
  /** The account it signs in as, when that isn't `email` (an alias, or a provider's own user name). */
  login: string | null;
  servers: MailServers | null;
  displayName: string | null;
  dailyLimit: number;
  /** Set while a new mailbox ramps up to its daily limit. */
  rampStartedAt: string | null;
  /** What it may send in the next 24 hours: lower than dailyLimit while ramping. */
  effectiveLimit: number;
  /** Day of the ramp (1-based), or null when not ramping. */
  rampDay: number | null;
  status: "active" | "error";
  lastError: string | null;
  createdAt: string;
}

export type MailboxAssignment = "capacity" | "even";

/** SPF, DKIM (Google selector) and DMARC for a sending domain. "managed": consumer Gmail, handled by Google. */
export interface DomainHealth {
  domain: string;
  spf: "pass" | "missing" | "managed";
  dkim: "pass" | "missing" | "managed";
  dmarc: "pass" | "missing" | "managed";
}

/** A sequence's mailboxes with today's sending, for the pool panel. */
export interface SequencePool {
  assignment: MailboxAssignment;
  sentToday: number;
  capacityToday: number;
  mailboxes: {
    id: string;
    email: string;
    displayName: string | null;
    status: "active" | "error";
    dailyLimit: number;
    effectiveLimit: number;
    rampDay: number | null;
    sentToday: number;
    leads: number;
  }[];
}

export interface SequenceStep {
  subject?: string | null;
  body: string;
  /** Days after the previous step; ignored for the first. Default 3. */
  delay_days?: number;
}
export interface SequenceInput {
  name: string;
  /** The mailbox pool: each lead gets one of these and keeps it for every step. */
  mailbox_ids: string[];
  /** How new leads are spread over the pool (default "capacity"). */
  assignment?: MailboxAssignment;
  steps: SequenceStep[];
  timezone?: string;
  window_start_hour?: number;
  window_end_hour?: number;
}
export interface Sequence {
  id: string;
  name: string;
  status: "draft" | "active" | "paused";
  tableId: string;
  mailboxIds: string[];
  assignment: MailboxAssignment;
  timezone: string;
  windowStartHour: number;
  windowEndHour: number;
  steps: { position: number; delayDays: number; subject: string | null; body: string }[];
}

/** One email in a conversation, oldest first. `step` is set for sequence emails (0 = the first). */
export interface ThreadMessage {
  id: string;
  direction: "in" | "out";
  step: number | null;
  subject: string | null;
  body: string;
  sentAt: string;
}

export interface Reply {
  id: string;
  from: string;
  subject: string | null;
  body: string;
  intent: string | null;
  receivedAt: string;
  handledAt: string | null;
  sequenceId: string | null;
  sequenceName: string | null;
  row: Record<string, unknown> | null;
  thread: ThreadMessage[];
}

export interface Draft {
  id: string;
  body: string;
  status: "pending" | "sent" | "discarded";
  updatedAt: string;
  replyId: string;
  to: string;
  replySubject: string | null;
  replyBody: string;
  intent: string | null;
  row: Record<string, unknown> | null;
  thread: ThreadMessage[];
}

export interface ConnectedApp {
  id: string;
  name: string;
  userEmail: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface MeerkoConfig {
  apiUrl: string;
  apiKey: string;
  /** Overrides fetch, e.g. so the API's hosted MCP endpoint can call itself in-process. */
  fetch?: typeof fetch;
  /** Gets a fresh access token when the API answers 401 (OAuth sign-in); null if it can't. */
  refresh?: (usedToken: string) => Promise<string | null>;
}

/** ~/.meerko/config.json: an API key, or the tokens from `meerko login` in the browser. */
export interface StoredConfig {
  apiUrl?: string;
  apiKey?: string;
  oauth?: { clientId: string; accessToken: string; refreshToken: string };
}

export function readStoredConfig(): StoredConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function writeStoredConfig(config: StoredConfig) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/**
 * Trades the stored refresh token for new tokens and saves them. Another process (the CLI and the MCP
 * server share the file) may have refreshed first, in which case its token is used.
 */
async function refreshStored(apiUrl: string, usedToken: string): Promise<string | null> {
  const stored = readStoredConfig();
  if (!stored.oauth) return null;
  if (stored.oauth.accessToken !== usedToken) return stored.oauth.accessToken;
  const res = await fetch(new URL("/oauth/token", apiUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.oauth.refreshToken, client_id: stored.oauth.clientId }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as { access_token: string; refresh_token: string };
  writeStoredConfig({ ...stored, oauth: { ...stored.oauth, accessToken: tokens.access_token, refreshToken: tokens.refresh_token } });
  return tokens.access_token;
}

export const CONFIG_PATH = join(homedir(), ".meerko", "config.json");
export const DEFAULT_API_URL = "http://localhost:8787";

/** Env vars win over ~/.meerko/config.json, so agents can be configured without a login step. */
export function loadConfig(): Partial<MeerkoConfig> & { oauth?: boolean } {
  const file = readStoredConfig();
  const apiUrl = process.env.MEERKO_API_URL ?? file.apiUrl ?? DEFAULT_API_URL;
  if (process.env.MEERKO_API_KEY) return { apiUrl, apiKey: process.env.MEERKO_API_KEY };
  return { apiUrl, apiKey: file.apiKey ?? file.oauth?.accessToken, oauth: !file.apiKey && !!file.oauth };
}

export class MeerkoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Billing =
  | { enabled: false }
  | {
      enabled: true;
      plan: "free" | "pro";
      /** Stripe's subscription status (`active`, `past_due`, `canceled`…); null without a subscription. */
      status: string | null;
      current_period_end: string | null;
      cancel_at_period_end: boolean;
      /** Whether there's a Stripe customer, i.e. anything for the billing portal to show. */
      has_customer: boolean;
      balance: number;
      pro_monthly_credits: number;
      /** Credits in one top-up pack. */
      credit_pack: number;
    };

export class MeerkoClient {
  constructor(private config: MeerkoConfig) {}

  static fromEnv(): MeerkoClient {
    const { apiUrl, apiKey, oauth } = loadConfig();
    if (!apiKey) throw new Error("Not logged in. Run `meerko login`, or set MEERKO_API_KEY.");
    return new MeerkoClient({ apiUrl: apiUrl!, apiKey, refresh: oauth ? (used) => refreshStored(apiUrl!, used) : undefined });
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.call<T>(method, `/v1${path}`, body);
  }

  private async call<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const res = await (this.config.fetch ?? fetch)(new URL(path, this.config.apiUrl), {
      method,
      headers: { authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // OAuth access tokens last an hour; refresh once and retry.
    if (res.status === 401 && this.config.refresh && !retried) {
      const token = await this.config.refresh(this.config.apiKey);
      if (token) {
        this.config = { ...this.config, apiKey: token };
        return this.call<T>(method, path, body, true);
      }
      throw new MeerkoApiError(401, "Your Meerko sign-in expired. Run `meerko login` again.");
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new MeerkoApiError(res.status, json.error ?? res.statusText);
    return json as T;
  }

  /** Whether the server offers "Sign in with Google", and whether anyone can sign up (public; no key needed). */
  authConfig() {
    return this.call<{ google: boolean; email?: boolean; signup: "open" | "invite" }>("GET", "/auth/config");
  }

  /** Reads a public website's home page (title, description, headings, text), for working out who it sells to. Free. */
  readWebsite(url: string) {
    return this.request<{ url: string; title: string | null; description: string | null; headings: string[]; text: string; truncated: boolean }>("POST", "/websites/read", { url });
  }

  /** Emails a sign-in link to `email` (public; the server needs MEERKO_SMTP_URL). `source` is the visit's attribution. */
  requestEmailSignIn(email: string, source?: Record<string, string>) {
    return this.call<void>("POST", "/auth/email/start", { email, source });
  }

  /** Uses the token from a sign-in link and returns a session token, once (public). */
  verifyEmailSignIn(token: string) {
    return this.call<{ token: string; expires_at: string }>("POST", "/auth/email/verify", { token });
  }

  /** Trades the one-time code from the Google sign-in callback for a session token (public; no key needed). */
  exchangeAuthCode(code: string) {
    return this.call<{ token: string; expires_at: string }>("POST", "/auth/exchange", { code });
  }

  /** Ends the dashboard session this client was built with. */
  logout() {
    return this.call<void>("POST", "/auth/logout");
  }

  /** The workspace this key or session acts on, and the signed-in person (null for API keys). */
  me() {
    return this.request<Me>("GET", "/me");
  }

  /** Your workspaces (brands), with the one this credential acts on marked `current`. An API key sees only its own. */
  listWorkspaces() {
    return this.request<{ workspaces: (Workspace & { current: boolean })[] }>("GET", "/workspaces").then((r) => r.workspaces);
  }

  /** A new workspace sharing the plan and credits of the ones you own. Doesn't switch to it. Not for API keys. */
  createWorkspace(name: string) {
    return this.request<{ workspace: Workspace }>("POST", "/workspaces", { name }).then((r) => r.workspace);
  }

  /** Owners only. */
  renameWorkspace(id: string, name: string) {
    return this.request<{ workspace: Workspace }>("PATCH", `/workspaces/${encodeURIComponent(id)}`, { name }).then((r) => r.workspace);
  }

  /** Points this session or app connection (not others) at another of your workspaces. Not for API keys. */
  switchWorkspace(workspaceId: string) {
    return this.request<{ workspace: Workspace }>("POST", "/workspaces/switch", { workspace_id: workspaceId }).then((r) => r.workspace);
  }

  /** What the OAuth consent page shows for a pending authorization request (dashboard session only). */
  describeOAuthRequest(request: string) {
    return this.request<{ client_name: string; redirect_to: string; workspace: string }>("POST", "/oauth/requests/describe", { request });
  }

  /** Approves or declines an app's authorization request; returns where to send the browser next. */
  decideOAuthRequest(request: string, approve: boolean) {
    return this.request<{ redirect_to: string }>("POST", "/oauth/requests/decide", { request, approve });
  }

  /** Apps (MCP clients, the CLI) that were given access to this workspace with OAuth. */
  listConnectedApps() {
    return this.request<{ apps: ConnectedApp[] }>("GET", "/connected-apps").then((r) => r.apps);
  }

  revokeConnectedApp(id: string) {
    return this.request<void>("DELETE", `/connected-apps/${encodeURIComponent(id)}`);
  }

  listApiKeys() {
    return this.request<{ api_keys: ApiKey[] }>("GET", "/api-keys").then((r) => r.api_keys);
  }

  /** Needs a dashboard session. The returned `key` is shown once; only its prefix is kept. */
  createApiKey(name: string, scope: ApiKey["scope"] = "full") {
    return this.request<{ id: string; name: string; scope: ApiKey["scope"]; key: string }>("POST", "/api-keys", { name, scope });
  }

  getAgentHook() {
    return this.request<{ hook: AgentHook | null }>("GET", "/agent-hook").then((r) => r.hook);
  }

  /** Needs a dashboard session. A webhook's signing `secret` is returned once. */
  setAgentHook(input: { kind: AgentHook["kind"]; url: string; token?: string }) {
    return this.request<{ hook: AgentHook; secret?: string }>("PUT", "/agent-hook", input);
  }

  deleteAgentHook() {
    return this.request<void>("DELETE", "/agent-hook");
  }

  enableAgentHook() {
    return this.request<{ hook: AgentHook }>("POST", "/agent-hook/enable").then((r) => r.hook);
  }

  /** Sends a test call now and reports how the hook answered. */
  testAgentHook() {
    return this.request<{ ok: boolean; status: number | null; error: string | null }>("POST", "/agent-hook/test");
  }

  /** The Slack connection, and whether this server has the Meerko Slack app (with Approve buttons) set up. */
  getSlack() {
    return this.request<{ connection: SlackConnection | null; app_available: boolean }>("GET", "/slack");
  }

  /** The Slack page that installs the Meerko app into a channel (signed-in person only). */
  slackInstallUrl() {
    return this.request<{ url: string }>("GET", "/slack/install").then((r) => r.url);
  }

  /** Connects a Slack incoming webhook: posts only, no buttons. Meerko posts a hello first to check it. */
  setSlackWebhook(url: string) {
    return this.request<{ connection: SlackConnection }>("PUT", "/slack/webhook", { url }).then((r) => r.connection);
  }

  testSlack() {
    return this.request<{ ok: boolean; error: string | null }>("POST", "/slack/test");
  }

  deleteSlack() {
    return this.request<void>("DELETE", "/slack");
  }

  revokeApiKey(id: string) {
    return this.request<void>("DELETE", `/api-keys/${id}`);
  }

  listTables() {
    return this.request<{ tables: Table[] }>("GET", "/tables").then((r) => r.tables);
  }

  getTable(id: string) {
    return this.request<{ table: Table }>("GET", `/tables/${id}`).then((r) => r.table);
  }

  createTable(input: { name: string; columns?: { name: string; type?: ColumnType }[] }) {
    return this.request<{ table: Table }>("POST", "/tables", input).then((r) => r.table);
  }

  addColumn(tableId: string, column: { name: string; type?: ColumnType; prompt?: string }) {
    return this.request<{ table: Table }>("POST", `/tables/${tableId}/columns`, column).then((r) => r.table);
  }

  insertRows(tableId: string, rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number; addedColumns: Column[] }>("POST", `/tables/${tableId}/rows`, { rows });
  }

  /** Free: how many leads match, before spending credits on a search. */
  countLeads(kind: LeadKind, query: LeadQuery) {
    return this.request<{ total: number }>("POST", `/search/${kind}/count`, { query }).then((r) => r.total);
  }

  /** Searches people or companies and writes the results into `tableId`, or a new table named `tableName`. */
  searchLeads(kind: LeadKind, input: { query: LeadQuery; limit?: number; tableId?: string; tableName?: string }) {
    return this.request<SearchResult & { creditsSpent: number; cappedByCredits?: boolean }>("POST", `/search/${kind}`, {
      query: input.query,
      limit: input.limit,
      table_id: input.tableId,
      table_name: input.tableName,
    });
  }

  /** Finds and/or verifies emails for rows that don't have them yet. Call again while `remaining > 0`. */
  enrichRows(
    tableId: string,
    input: { fields?: EnrichField[]; filter?: Record<string, unknown>; limit?: number; overwrite?: boolean } = {},
  ) {
    return this.request<EnrichResult>("POST", `/tables/${tableId}/enrich`, input);
  }

  /**
   * How this server connects Gmail: `oauth` when Google's consent screen is on, and `url`, the dashboard page
   * where a person enters an app password (null without MEERKO_APP_URL).
   */
  mailboxConnectOptions() {
    return this.request<{ oauth: boolean; outlook: boolean; url: string | null }>("GET", "/mailboxes/connect");
  }

  /**
   * Connects a Gmail or Google Workspace inbox with a 16-letter app password (IMAP and SMTP). Gmail checks
   * the password first, so a wrong one is refused with the reason. `login` is the Google account to sign in
   * as when `email` is an alias of it.
   */
  connectGmailAppPassword(input: { email: string; password: string; login?: string; displayName?: string }) {
    return this.request<{ mailbox: Mailbox }>("POST", "/mailboxes/gmail/app-password", {
      email: input.email,
      password: input.password,
      login: input.login,
      display_name: input.displayName,
    }).then((r) => r.mailbox);
  }

  /**
   * Connects any provider's inbox over IMAP and SMTP (see MAIL_PROVIDERS for presets). The server signs in to
   * both first and refuses with the reason. Only TLS ports (IMAP 993, SMTP 465 or 587) and public servers.
   */
  connectImapMailbox(input: { email: string; password: string; servers: MailServers; login?: string; displayName?: string }) {
    return this.request<{ mailbox: Mailbox }>("POST", "/mailboxes/imap", {
      email: input.email,
      password: input.password,
      login: input.login,
      display_name: input.displayName,
      imap_host: input.servers.imap.host,
      imap_port: input.servers.imap.port,
      smtp_host: input.servers.smtp.host,
      smtp_port: input.servers.smtp.port,
    }).then((r) => r.mailbox);
  }

  /**
   * Returns a Microsoft sign-in URL for an Outlook / Microsoft 365 mailbox; it appears in listMailboxes once the
   * user approves. With `returnTo` (on the server's MEERKO_APP_URL), the browser is sent back there afterwards.
   */
  connectOutlook(loginHint?: string, returnTo?: string) {
    return this.request<{ url: string }>("POST", "/mailboxes/outlook/connect", { login_hint: loginHint, return_to: returnTo });
  }

  /**
   * Returns a Google consent URL; the mailbox appears in listMailboxes once the user approves.
   * With `returnTo` (on the server's MEERKO_APP_URL), the browser is sent back there afterwards.
   */
  connectGmail(loginHint?: string, returnTo?: string) {
    return this.request<{ url: string }>("POST", "/mailboxes/gmail/connect", { login_hint: loginHint, return_to: returnTo });
  }

  listMailboxes() {
    return this.request<{ mailboxes: Mailbox[] }>("GET", "/mailboxes").then((r) => r.mailboxes);
  }

  updateMailbox(id: string, patch: { dailyLimit?: number; displayName?: string | null; ramp?: boolean }) {
    return this.request<{ mailbox: Mailbox }>("PATCH", `/mailboxes/${id}`, {
      daily_limit: patch.dailyLimit,
      display_name: patch.displayName,
      ramp: patch.ramp,
    }).then((r) => r.mailbox);
  }

  /** SPF, DKIM and DMARC for every domain the workspace sends from. */
  mailboxHealth() {
    return this.request<{ domains: DomainHealth[] }>("GET", "/mailboxes/health").then((r) => r.domains);
  }

  deleteMailbox(id: string) {
    return this.request<{ deleted: boolean }>("DELETE", `/mailboxes/${id}`);
  }

  sendTestEmail(id: string, to: string) {
    return this.request<{ sent: boolean; messageId: string | null }>("POST", `/mailboxes/${id}/test`, { to });
  }

  listSequences() {
    return this.request<{ sequences: (Omit<Sequence, "steps" | "timezone" | "windowStartHour" | "windowEndHour"> & { enrolled: number })[] }>(
      "GET",
      "/sequences",
    ).then((r) => r.sequences);
  }

  createSequence(input: SequenceInput & { table_id: string }) {
    return this.request<{ sequence: Sequence }>("POST", "/sequences", input).then((r) => r.sequence);
  }

  getSequence(id: string) {
    return this.request<{ sequence: Sequence }>("GET", `/sequences/${id}`).then((r) => r.sequence);
  }

  updateSequence(id: string, patch: Partial<SequenceInput>) {
    return this.request<{ sequence: Sequence }>("PATCH", `/sequences/${id}`, patch).then((r) => r.sequence);
  }

  previewSequence(id: string, rowId?: string) {
    const qs = rowId ? `?row_id=${encodeURIComponent(rowId)}` : "";
    return this.request<{
      rowId: string;
      to: string | null;
      missingVars: string[];
      steps: { position: number; delayDays: number; subject: string; body: string }[];
    }>("GET", `/sequences/${id}/preview${qs}`);
  }

  enrollRows(id: string, opts: { row_ids?: string[]; filter?: Record<string, unknown>; limit?: number } = {}) {
    return this.request<{ enrolled: number; skipped: Record<string, number>; byMailbox: Record<string, number> }>("POST", `/sequences/${id}/enroll`, opts);
  }

  sequencePool(id: string) {
    return this.request<SequencePool>("GET", `/sequences/${id}/pool`);
  }

  startSequence(id: string) {
    return this.request<{ sequence: Sequence }>("POST", `/sequences/${id}/start`).then((r) => r.sequence);
  }

  pauseSequence(id: string) {
    return this.request<{ sequence: Sequence }>("POST", `/sequences/${id}/pause`).then((r) => r.sequence);
  }

  sequenceStats(id: string) {
    return this.request<{
      id: string;
      name: string;
      status: string;
      enrolled: number;
      /** People who will still get emails. */
      remaining: number;
      emailsSent: number;
      states: Record<string, number>;
      replyRate: number;
      steps: { position: number; sent: number; repliedAfter: number }[];
    }>("GET", `/sequences/${id}/stats`);
  }

  /** Everyone in a sequence and where they stand. */
  sequenceRecipients(id: string) {
    return this.request<{
      recipients: {
        enrollmentId: string;
        rowId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        company: string | null;
        /** The mailbox this person is emailed from (null if it was removed). */
        mailboxEmail: string | null;
        state: "active" | "completed" | "replied" | "unsubscribed" | "bounced" | "stopped" | "failed";
        stepsSent: number;
        nextSendAt: string | null;
        lastError: string | null;
        lastSentAt: string | null;
      }[];
    }>("GET", `/sequences/${id}/recipients`).then((r) => r.recipients);
  }

  /** Unclassified replies by default, newest first, each with its thread and the prospect's row. */
  listReplies(opts: { sequenceId?: string; intent?: string; unclassified?: boolean; includeAutomatic?: boolean; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.sequenceId) params.set("sequence_id", opts.sequenceId);
    if (opts.intent) params.set("intent", opts.intent);
    if (opts.unclassified !== undefined) params.set("unclassified", String(opts.unclassified));
    if (opts.includeAutomatic) params.set("include_automatic", "true");
    if (opts.limit) params.set("limit", String(opts.limit));
    const qs = params.size ? `?${params}` : "";
    return this.request<{ replies: Reply[] }>("GET", `/replies${qs}`).then((r) => r.replies);
  }

  classifyReply(id: string, intent: ReplyIntent, handled?: boolean) {
    return this.request<{ reply: { id: string; intent: string; handledAt: string | null } }>("POST", `/replies/${id}/classify`, { intent, handled });
  }

  /** Saves a draft answer to a reply (replaces an earlier pending draft). Nothing is sent until approved. */
  draftReply(replyId: string, body: string) {
    return this.request<{ draft: { id: string; body: string } }>("POST", `/replies/${replyId}/draft`, { body }).then((r) => r.draft);
  }

  listDrafts(status?: Draft["status"]) {
    return this.request<{ drafts: Draft[] }>("GET", `/drafts${status ? `?status=${status}` : ""}`).then((r) => r.drafts);
  }

  /** Sends the draft (or `body`, if the human edited it) as a reply in the same thread. */
  approveDraft(id: string, body?: string) {
    return this.request<{ sent: boolean; to: string; subject: string }>("POST", `/drafts/${id}/approve`, body ? { body } : {});
  }

  discardDraft(id: string) {
    return this.request<{ discarded: boolean }>("POST", `/drafts/${id}/discard`);
  }

  /** Delete leads. Their sequence enrollments stop; sent emails and do-not-email entries are kept. */
  deleteRows(tableId: string, rowIds: string[]) {
    return this.request<{ deleted: number }>("POST", `/tables/${tableId}/rows/delete`, { row_ids: rowIds });
  }

  /** Delete a table with its rows and its paused or draft sequences. Refused (409) while a sequence is active. */
  deleteTable(tableId: string) {
    return this.request<{ deleted: boolean; rows: number; sequences: number }>("DELETE", `/tables/${tableId}`);
  }

  /** Move leads to a pipeline stage by hand (e.g. meeting, won, lost). */
  moveStage(tableId: string, rowIds: string[], stage: Stage) {
    return this.request<{ moved: number }>("POST", `/tables/${tableId}/rows/stage`, { row_ids: rowIds, stage });
  }

  /** Lead counts per stage, for one table or the whole workspace. */
  pipeline(tableId?: string) {
    const qs = tableId ? `?table_id=${encodeURIComponent(tableId)}` : "";
    return this.request<{ tableId: string | null; stages: Record<Stage, number>; total: number }>("GET", `/pipeline${qs}`);
  }

  listProviderKeys() {
    return this.request<{ keys: { provider: string; last4: string; createdAt: string }[] }>("GET", "/provider-keys").then((r) => r.keys);
  }

  /** Stores your own provider key (validated first); calls through it cost no Meerko credits. */
  setProviderKey(provider: string, key: string) {
    return this.request<{ provider: string; last4: string }>("PUT", `/provider-keys/${provider}`, { key });
  }

  deleteProviderKey(provider: string) {
    return this.request<{ deleted: boolean }>("DELETE", `/provider-keys/${provider}`);
  }

  getCredits() {
    /** `plan` and `buy_url` only on Meerko Cloud, where credits can be bought. */
    return this.request<{ enabled: boolean; balance: number | null; plan?: "free" | "pro"; buy_url?: string }>("GET", "/credits");
  }

  /** The workspace's plan and subscription on Meerko Cloud; `{ enabled: false }` on a self-hosted install. */
  getBilling() {
    return this.request<Billing>("GET", "/billing");
  }

  /** A Stripe Checkout URL for Pro or for credit packs (dashboard session, workspace owner). */
  startCheckout(input: { kind: "pro" } | { kind: "credits"; packs?: number }) {
    return this.request<{ url: string }>("POST", "/billing/checkout", input).then((r) => r.url);
  }

  /** A Stripe customer portal URL: card, invoices, cancelling Pro (dashboard session, workspace owner). */
  openBillingPortal() {
    return this.request<{ url: string }>("POST", "/billing/portal").then((r) => r.url);
  }

  updateRows(tableId: string, updates: { id: string; data: Record<string, unknown> }[]) {
    return this.request<{ updated: number; addedColumns: Column[] }>("PATCH", `/tables/${tableId}/rows`, { updates });
  }

  /** Rows whose AI column is still empty, with the column's instruction rendered per row. */
  getPendingCells(tableId: string, column: string, opts: { filter?: Record<string, unknown>; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.filter) params.set("filter", JSON.stringify(opts.filter));
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    const qs = params.size ? `?${params}` : "";
    return this.request<PendingCells>("GET", `/tables/${tableId}/columns/${encodeURIComponent(column)}/pending${qs}`);
  }

  queryRows(tableId: string, opts: { filter?: Record<string, unknown>; stage?: Stage; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.filter) params.set("filter", JSON.stringify(opts.filter));
    if (opts.stage) params.set("stage", opts.stage);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    const qs = params.size ? `?${params}` : "";
    return this.request<{ rows: Row[] }>("GET", `/tables/${tableId}/rows${qs}`).then((r) => r.rows);
  }
}
