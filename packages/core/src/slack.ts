import { createHmac, timingSafeEqual } from "node:crypto";
import {
  routines,
  and,
  asc,
  eq,
  gte,
  inArray,
  memberships,
  messages,
  replyDrafts,
  sequences,
  slackConnections,
  sql,
  users,
  workspaces,
  type Db,
  type SlackConnectionKind,
} from "@meerko/db";
import { EncryptionNotConfiguredError, type SecretBox } from "./provider-keys.ts";
import { approveDraft, discardDraft, type ApproveDeps } from "./replies/drafts.ts";
import { ReplyError } from "./replies/replies.ts";
import { NotFoundError } from "./tables.ts";

/**
 * Slack: Meerko posts new replies and the drafts the user's agent wrote to a channel. With the Meerko Slack app,
 * each draft has Approve and Discard buttons, and `/meerko` shows what's waiting. A pasted incoming webhook only
 * posts, with links to the inbox. Either way Meerko makes no LLM calls, and only a person can approve a draft.
 */

/** What the app asks for: posting (also to public channels it isn't in), the channel picker, `/meerko`, and the
 * clicker's email, which is how a click is matched to a Meerko member. */
export const SLACK_SCOPES = ["chat:write", "chat:write.public", "commands", "incoming-webhook", "users:read", "users:read.email"] as const;
const WEBHOOK_URL = /^https:\/\/hooks\.slack\.com\/(services|workflows|triggers)\/[A-Za-z0-9/_-]+$/;
/** Replies wait this long before they're posted, so a burst becomes one message. */
export const SLACK_REPLY_DELAY_MS = 2 * 60_000;
/** With an Autopilot replies routine on, a reply waits this long for its draft, so it shows up once, with the draft. */
export const SLACK_DRAFT_GRACE_MS = 15 * 60_000;
/** A connection that has failed for this long is switched off. */
const DISABLE_AFTER_MS = 24 * 60 * 60_000;
/** Slack ignores requests signed more than 5 minutes ago (replay protection). */
const SIGNATURE_MAX_AGE_S = 5 * 60;
const MAX_DRAFTS_PER_TICK = 10;
const MAX_LISTED_REPLIES = 10;
/** Errors after which retrying can't help: the app was removed or the workspace deleted. */
const FATAL = new Set(["invalid_auth", "token_revoked", "account_inactive", "no_service", "no_team", "team_disabled", "channel_is_archived"]);
const RULE_INTENTS = ["bounce", "out_of_office", "unsubscribe"];

export class SlackError extends Error {
  constructor(
    message: string,
    readonly code = "slack_error",
  ) {
    super(message);
  }
}

export interface SlackAppConfig {
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  /** `<MEERKO_PUBLIC_URL>/slack/oauth/callback`, also listed in the Slack app's redirect URLs. */
  redirectUri: string;
}

export interface SlackConnectionView {
  kind: SlackConnectionKind;
  teamName: string | null;
  channelName: string | null;
  enabled: boolean;
  lastPostedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

// --- Slack Web API ---

type SlackJson = { ok: boolean; error?: string; [k: string]: unknown };

// Slack's read methods (users.info and the like) ignore a JSON body and answer as if no arguments were sent, so
// those go form-encoded; the write methods take JSON, which is what nested blocks need.
const FORM_METHODS = new Set(["users.info"]);

async function slackApi<T extends SlackJson>(fetchFn: typeof fetch, method: string, token: string, body: Record<string, unknown>): Promise<T> {
  const form = FORM_METHODS.has(method);
  const res = await fetchFn(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, ...(form ? {} : { "content-type": "application/json; charset=utf-8" }) },
    body: form ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])) : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({ ok: false, error: `http_${res.status}` }))) as T;
  if (!json.ok) throw new SlackError(`Slack answered ${json.error ?? "an error"}`, json.error ?? "slack_error");
  return json;
}

/** The Slack app's install page; `state` ties the callback to the person and workspace that started it. */
export function slackInstallUrl(config: SlackAppConfig, box: SecretBox, input: { workspaceId: string; userId: string }, now = new Date()) {
  const state = box.encrypt(JSON.stringify({ w: input.workspaceId, u: input.userId, exp: now.getTime() + 15 * 60_000 }));
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", SLACK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Exchanges the install code for a bot token and stores the connection, replacing any earlier one. */
export async function completeSlackInstall(
  db: Db,
  box: SecretBox | null,
  config: SlackAppConfig,
  input: { code: string; state: string },
  deps: { fetch?: typeof fetch; now?: Date } = {},
): Promise<{ workspaceId: string; userId: string }> {
  if (!box) throw new EncryptionNotConfiguredError();
  let state: { w: string; u: string; exp: number };
  try {
    state = JSON.parse(box.decrypt(input.state));
  } catch {
    throw new SlackError("This Slack link is invalid. Start again from Connections.", "bad_state");
  }
  if (state.exp < (deps.now ?? new Date()).getTime()) throw new SlackError("This Slack link expired. Start again from Connections.", "expired_state");

  const res = await (deps.fetch ?? fetch)("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: input.code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({ ok: false }))) as SlackJson & {
    access_token?: string;
    team?: { id: string; name: string };
    incoming_webhook?: { channel?: string; channel_id?: string };
  };
  if (!json.ok || !json.access_token) throw new SlackError(`Slack didn't finish the install (${json.error ?? "no token"})`, json.error ?? "oauth_failed");

  await saveConnection(db, box, state.w, {
    kind: "app",
    secret: json.access_token,
    teamId: json.team?.id ?? null,
    teamName: json.team?.name ?? null,
    channelId: json.incoming_webhook?.channel_id ?? null,
    channelName: json.incoming_webhook?.channel?.replace(/^#/, "") ?? null,
  });
  return { workspaceId: state.w, userId: state.u };
}

/** Connects a pasted incoming webhook (no Slack app needed: posts only, no buttons). Posts a hello to check it. */
export async function setSlackWebhook(db: Db, box: SecretBox | null, workspaceId: string, url: string, deps: { fetch?: typeof fetch } = {}) {
  if (!box) throw new EncryptionNotConfiguredError();
  const trimmed = url.trim();
  if (!WEBHOOK_URL.test(trimmed)) throw new SlackError("Paste a Slack incoming webhook URL: https://hooks.slack.com/services/…", "bad_webhook");
  await postWebhook(deps.fetch ?? fetch, trimmed, { text: "Meerko is connected. New replies and your agent's drafts will show up here." });
  await saveConnection(db, box, workspaceId, { kind: "webhook", secret: trimmed, teamId: null, teamName: null, channelId: null, channelName: null });
  return (await getSlackConnection(db, workspaceId))!;
}

async function saveConnection(
  db: Db,
  box: SecretBox,
  workspaceId: string,
  input: { kind: SlackConnectionKind; secret: string; teamId: string | null; teamName: string | null; channelId: string | null; channelName: string | null },
) {
  const values = {
    workspaceId,
    kind: input.kind,
    encryptedSecret: box.encrypt(input.secret),
    teamId: input.teamId,
    teamName: input.teamName,
    channelId: input.channelId,
    channelName: input.channelName,
  };
  await db
    .insert(slackConnections)
    .values(values)
    .onConflictDoUpdate({
      target: slackConnections.workspaceId,
      // A new connection starts clean, and only replies and drafts from now on are posted.
      set: { ...values, enabled: true, lastPostedAt: null, lastError: null, failingSince: null, createdAt: sql`now()` },
    });
}

export async function getSlackConnection(db: Db, workspaceId: string): Promise<SlackConnectionView | null> {
  const [row] = await db
    .select({
      kind: slackConnections.kind,
      teamName: slackConnections.teamName,
      channelName: slackConnections.channelName,
      enabled: slackConnections.enabled,
      lastPostedAt: slackConnections.lastPostedAt,
      lastError: slackConnections.lastError,
      createdAt: slackConnections.createdAt,
    })
    .from(slackConnections)
    .where(eq(slackConnections.workspaceId, workspaceId));
  return row ?? null;
}

export async function deleteSlackConnection(db: Db, workspaceId: string) {
  const deleted = await db.delete(slackConnections).where(eq(slackConnections.workspaceId, workspaceId)).returning({ id: slackConnections.id });
  if (!deleted.length) throw new NotFoundError("Slack isn't connected");
}

// --- Request signatures ---

/**
 * Checks Slack's `x-slack-signature` (`v0=` + HMAC-SHA256 of `v0:<timestamp>:<raw body>`) and that the request is
 * recent. https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(signingSecret: string, input: { timestamp?: string | null; signature?: string | null; body: string }, now = new Date()) {
  const ts = Number(input.timestamp);
  if (!input.signature || !Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > SIGNATURE_MAX_AGE_S) return false;
  const expected = Buffer.from("v0=" + createHmac("sha256", signingSecret).update(`v0:${input.timestamp}:${input.body}`).digest("hex"));
  const given = Buffer.from(input.signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// --- Messages ---

type Block = Record<string, unknown>;

/** Reply and draft text comes from strangers and agents: shown as plain text, so `<!channel>` or links do nothing. */
const plain = (text: string, max = 1500) => ({ type: "plain_text", text: text.length > max ? `${text.slice(0, max - 1)}…` : text || " ", emoji: false });
/** For our own mrkdwn lines: Slack's three control characters, escaped. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inboxUrl = (appUrl?: string) => (appUrl ? `${appUrl.replace(/\/$/, "")}/app/inbox` : undefined);

/** Only the newest part of a reply, without the quoted thread under it. */
function replyExcerpt(body: string) {
  const cut = body.search(/\n(On .+wrote:|El .+escribió:|-{2,}\s*Original Message|>)/i);
  return (cut > 0 ? body.slice(0, cut) : body).trim();
}

export interface DraftForSlack {
  id: string;
  body: string;
  to: string;
  replySubject: string | null;
  replyBody: string;
  intent: string | null;
}

export function draftBlocks(d: DraftForSlack, opts: { appUrl?: string; interactive: boolean }): Block[] {
  const inbox = inboxUrl(opts.appUrl);
  const blocks: Block[] = [
    { type: "section", text: { type: "mrkdwn", text: `*Draft ready* · reply from ${esc(d.to)}${d.intent ? ` · _${esc(d.intent.replace(/_/g, " "))}_` : ""}` } },
    { type: "context", elements: [{ type: "mrkdwn", text: `*They wrote* (${esc(d.replySubject ?? "no subject")}):` }] },
    { type: "section", text: plain(replyExcerpt(d.replyBody), 1200) },
    { type: "context", elements: [{ type: "mrkdwn", text: "*Your agent's draft:*" }] },
    { type: "section", text: plain(d.body, 2500) },
  ];
  const buttons: Block[] = [];
  if (opts.interactive) {
    buttons.push(
      { type: "button", action_id: "meerko_approve", text: plain("Approve and send"), style: "primary", value: d.id,
        confirm: { title: plain("Send this reply?"), text: plain(`Meerko sends the draft to ${d.to} from your mailbox.`), confirm: plain("Send"), deny: plain("Cancel") } },
      { type: "button", action_id: "meerko_discard", text: plain("Discard"), value: d.id },
    );
  }
  if (inbox) buttons.push({ type: "button", action_id: "meerko_open", text: plain(opts.interactive ? "Edit in Meerko" : "Review in Meerko"), url: inbox });
  if (buttons.length) blocks.push({ type: "actions", block_id: `draft:${d.id}`, elements: buttons });
  return blocks;
}

/** The draft's message once it's dealt with: the buttons give way to who did what. */
export function resolvedDraftBlocks(d: { to: string; body: string }, outcome: "sent" | "discarded", by: string): Block[] {
  const what = outcome === "sent" ? `:white_check_mark: *Sent* to ${esc(d.to)} by ${by}` : `:wastebasket: *Discarded* by ${by}`;
  return [{ type: "section", text: { type: "mrkdwn", text: what } }, { type: "section", text: plain(d.body, 2500) }];
}

export interface ReplyForSlack {
  from: string;
  subject: string | null;
  body: string;
  intent: string | null;
}

export function repliesBlocks(replies: ReplyForSlack[], opts: { appUrl?: string; total: number }): Block[] {
  const n = opts.total;
  const blocks: Block[] = [{ type: "section", text: { type: "mrkdwn", text: `*${n} new ${n === 1 ? "reply" : "replies"}* in Meerko` } }];
  for (const r of replies) {
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `*${esc(r.from)}* · ${esc(r.subject ?? "no subject")}${r.intent ? ` · _${esc(r.intent.replace(/_/g, " "))}_` : ""}` }] });
    blocks.push({ type: "section", text: plain(replyExcerpt(r.body), 400) });
  }
  if (n > replies.length) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `…and ${n - replies.length} more` }] });
  const inbox = inboxUrl(opts.appUrl);
  if (inbox) blocks.push({ type: "actions", elements: [{ type: "button", action_id: "meerko_open", text: plain("Open the inbox"), url: inbox }] });
  return blocks;
}

async function postWebhook(fetchFn: typeof fetch, url: string, payload: { text: string; blocks?: Block[] }) {
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new SlackError(`Slack answered HTTP ${res.status}${text ? `: ${text}` : ""}`, text || `http_${res.status}`);
}

interface ConnectionRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  kind: SlackConnectionKind;
  encryptedSecret: string;
  channelId: string | null;
  createdAt: Date;
  failingSince: Date | null;
}

/** Posts to the connection's channel. Returns the message's channel and ts (app only; webhooks don't say). */
async function post(conn: ConnectionRow, box: SecretBox, fetchFn: typeof fetch, payload: { text: string; blocks: Block[] }) {
  const secret = box.decrypt(conn.encryptedSecret);
  if (conn.kind === "webhook") {
    await postWebhook(fetchFn, secret, payload);
    return null;
  }
  if (!conn.channelId) throw new SlackError("No channel was picked when Slack was connected; connect it again", "no_channel");
  const res = await slackApi<SlackJson & { channel: string; ts: string }>(fetchFn, "chat.postMessage", secret, {
    channel: conn.channelId,
    ...payload,
    unfurl_links: false,
    unfurl_media: false,
  });
  return { channel: res.channel, ts: res.ts };
}

export interface SlackDeps {
  box: SecretBox | null;
  appUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

/** Sends a hello to the channel now and records the outcome. */
export async function testSlack(db: Db, workspaceId: string, deps: SlackDeps) {
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const conn = await loadConnection(db, workspaceId);
  if (!conn) throw new NotFoundError("Slack isn't connected");
  try {
    await post(conn, deps.box, deps.fetch ?? fetch, { text: `Test from Meerko (workspace "${conn.workspaceName}"). This is where replies and drafts show up.`, blocks: [] });
    await db.update(slackConnections).set({ lastError: null, failingSince: null }).where(eq(slackConnections.id, conn.id));
    return { ok: true as const, error: null };
  } catch (err) {
    const error = describe(err);
    await db.update(slackConnections).set({ lastError: error }).where(eq(slackConnections.id, conn.id));
    return { ok: false as const, error };
  }
}

/**
 * Posts a one-off notice (e.g. a mailbox put on hold) to the workspace's Slack channel, if Slack is connected and on.
 * Resolves true when Slack accepted it, false when there's no connection or it failed; never throws.
 */
export async function postSlackNotice(db: Db, deps: Pick<SlackDeps, "box" | "fetch">, workspaceId: string, text: string): Promise<boolean> {
  if (!deps.box) return false;
  try {
    const conn = await loadConnection(db, workspaceId);
    if (!conn?.enabled) return false;
    await post(conn, deps.box, deps.fetch ?? fetch, { text, blocks: [] });
    return true;
  } catch {
    return false;
  }
}

const describe = (err: unknown) => (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError") ? "Slack didn't answer within 10s" : err instanceof Error ? err.message : String(err));

async function loadConnection(db: Db, workspaceId: string): Promise<(ConnectionRow & { enabled: boolean }) | undefined> {
  const [row] = await db
    .select({
      id: slackConnections.id,
      workspaceId: slackConnections.workspaceId,
      workspaceName: workspaces.name,
      kind: slackConnections.kind,
      encryptedSecret: slackConnections.encryptedSecret,
      channelId: slackConnections.channelId,
      createdAt: slackConnections.createdAt,
      failingSince: slackConnections.failingSince,
      enabled: slackConnections.enabled,
    })
    .from(slackConnections)
    .innerJoin(workspaces, eq(slackConnections.workspaceId, workspaces.id))
    .where(eq(slackConnections.workspaceId, workspaceId));
  return row;
}

// --- The notifier ---

export interface SlackNotifyResult {
  drafts: number;
  replies: number;
  failed: number;
}

/** A human reply that nobody has dealt with yet: not a bounce, out-of-office or unsubscribe. */
/** Inbound replies from a person (not a bounce, auto-reply or unsubscribe) that nobody has dealt with yet. */
export const humanReply = () =>
  and(eq(messages.direction, "in"), sql`${messages.handledAt} is null`, sql`(${messages.intent} is null or ${messages.intent} not in ${RULE_INTENTS})`)!;

/**
 * One pass over every enabled Slack connection. Pending drafts are posted one message each (with buttons on the app);
 * replies without a draft are posted together once they're a couple of minutes old, or, when a replies routine is on,
 * once the agent has had time to draft them. Something is marked posted only after Slack accepts it.
 */
export async function runSlackNotifyTick(db: Db, deps: SlackDeps): Promise<SlackNotifyResult> {
  const result: SlackNotifyResult = { drafts: 0, replies: 0, failed: 0 };
  if (!deps.box) return result;
  const box = deps.box;
  const now = (deps.now ?? (() => new Date()))();
  const fetchFn = deps.fetch ?? fetch;

  const conns = await db
    .select({
      id: slackConnections.id,
      workspaceId: slackConnections.workspaceId,
      workspaceName: workspaces.name,
      kind: slackConnections.kind,
      encryptedSecret: slackConnections.encryptedSecret,
      channelId: slackConnections.channelId,
      createdAt: slackConnections.createdAt,
      failingSince: slackConnections.failingSince,
      // A replies routine Meerko starts: the agent gets time to draft before the reply is posted.
      hookEnabled: sql<boolean>`${routines.id} is not null`,
    })
    .from(slackConnections)
    .innerJoin(workspaces, eq(slackConnections.workspaceId, workspaces.id))
    .leftJoin(
      routines,
      and(eq(routines.workspaceId, slackConnections.workspaceId), eq(routines.when, "replies"), eq(routines.status, "active"), sql`${routines.trigger} <> 'own_scheduler'`),
    )
    .where(eq(slackConnections.enabled, true));

  for (const conn of conns) {
    try {
      // 1. Drafts, each with the reply it answers.
      const drafts = await db
        .select({
          id: replyDrafts.id,
          body: replyDrafts.body,
          replyId: messages.id,
          to: messages.fromEmail,
          replySubject: messages.subject,
          replyBody: messages.body,
          intent: messages.intent,
        })
        .from(replyDrafts)
        .innerJoin(messages, eq(replyDrafts.replyId, messages.id))
        .where(
          and(
            eq(replyDrafts.workspaceId, conn.workspaceId),
            eq(replyDrafts.status, "pending"),
            sql`${replyDrafts.slackNotifiedAt} is null`,
            gte(replyDrafts.createdAt, conn.createdAt),
          ),
        )
        .orderBy(asc(replyDrafts.createdAt))
        .limit(MAX_DRAFTS_PER_TICK);
      for (const d of drafts) {
        const where = await post(conn, box, fetchFn, { text: `Draft ready: reply from ${d.to}`, blocks: draftBlocks(d, { appUrl: deps.appUrl, interactive: conn.kind === "app" }) });
        await db.transaction(async (tx) => {
          await tx
            .update(replyDrafts)
            .set({ slackNotifiedAt: now, slackChannel: where?.channel ?? null, slackTs: where?.ts ?? null })
            .where(eq(replyDrafts.id, d.id));
          await tx.update(messages).set({ slackNotifiedAt: sql`coalesce(${messages.slackNotifiedAt}, ${now.toISOString()}::timestamptz)` }).where(eq(messages.id, d.replyId));
        });
        result.drafts += 1;
      }

      // 2. Replies still without a draft.
      const waiting = await db
        .select({ id: messages.id, from: messages.fromEmail, subject: messages.subject, body: messages.body, intent: messages.intent, sentAt: messages.sentAt })
        .from(messages)
        .where(
          and(
            eq(messages.workspaceId, conn.workspaceId),
            humanReply(),
            sql`${messages.slackNotifiedAt} is null`,
            gte(messages.sentAt, conn.createdAt),
            sql`not exists (select 1 from ${replyDrafts} where ${replyDrafts.replyId} = ${messages.id} and ${replyDrafts.status} = 'pending')`,
          ),
        )
        .orderBy(asc(messages.sentAt));
      const wait = conn.hookEnabled ? SLACK_DRAFT_GRACE_MS : SLACK_REPLY_DELAY_MS;
      const postReplies = waiting.length > 0 && now.getTime() - waiting[0]!.sentAt.getTime() >= wait;
      if (postReplies) {
        const n = waiting.length;
        await post(conn, box, fetchFn, {
          text: `${n} new ${n === 1 ? "reply" : "replies"} in Meerko`,
          blocks: repliesBlocks(waiting.slice(0, MAX_LISTED_REPLIES), { appUrl: deps.appUrl, total: n }),
        });
        await db.update(messages).set({ slackNotifiedAt: now }).where(inArray(messages.id, waiting.map((w) => w.id)));
        result.replies += n;
      }

      if (drafts.length || postReplies) {
        await db.update(slackConnections).set({ lastPostedAt: now, lastError: null, failingSince: null }).where(eq(slackConnections.id, conn.id));
      }
    } catch (err) {
      result.failed += 1;
      const error = describe(err);
      const failingSince = conn.failingSince ?? now;
      const fatal = err instanceof SlackError && FATAL.has(err.code);
      const disable = fatal || now.getTime() - failingSince.getTime() >= DISABLE_AFTER_MS;
      await db
        .update(slackConnections)
        .set({ lastError: disable ? `Turned off: ${error}` : error, failingSince, ...(disable ? { enabled: false } : {}) })
        .where(eq(slackConnections.id, conn.id));
    }
  }
  return result;
}

// --- Buttons and /meerko ---

/** The Meerko member behind a Slack user: matched on the email Slack has for them. */
async function memberFor(db: Db, fetchFn: typeof fetch, token: string, workspaceId: string, slackUserId: string) {
  const info = await slackApi<SlackJson & { user?: { profile?: { email?: string } } }>(fetchFn, "users.info", token, { user: slackUserId });
  const email = info.user?.profile?.email?.toLowerCase();
  if (!email) return null;
  const [member] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(and(eq(memberships.workspaceId, workspaceId), sql`lower(${users.email}) = ${email}`));
  return member ?? null;
}

async function respond(fetchFn: typeof fetch, responseUrl: string | undefined, body: Record<string, unknown>) {
  if (!responseUrl?.startsWith("https://hooks.slack.com/")) return;
  await fetchFn(responseUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) }).catch(() => {});
}

export interface SlackInteractionDeps extends SlackDeps {
  approve: ApproveDeps;
}

export interface SlackInteraction {
  type: string;
  team?: { id: string };
  user?: { id: string };
  response_url?: string;
  actions?: { action_id: string; value?: string }[];
}

/**
 * A button click from a draft message. Only a member of the Meerko workspace (matched by email) can approve or
 * discard; anyone else gets a private note. The message is then replaced with the outcome.
 */
export async function handleSlackInteraction(db: Db, deps: SlackInteractionDeps, payload: SlackInteraction): Promise<{ outcome: string }> {
  const fetchFn = deps.fetch ?? fetch;
  const action = payload.actions?.[0];
  if (payload.type !== "block_actions" || !action || (action.action_id !== "meerko_approve" && action.action_id !== "meerko_discard")) {
    return { outcome: "ignored" };
  }
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const note = (text: string) => respond(fetchFn, payload.response_url, { response_type: "ephemeral", replace_original: false, text });

  const [draft] = action.value
    ? await db
        .select({ id: replyDrafts.id, workspaceId: replyDrafts.workspaceId, status: replyDrafts.status, body: replyDrafts.body, to: messages.fromEmail })
        .from(replyDrafts)
        .innerJoin(messages, eq(replyDrafts.replyId, messages.id))
        .where(sql`${replyDrafts.id}::text = ${action.value}`)
    : [];
  const [conn] = draft
    ? await db
        .select({ encryptedSecret: slackConnections.encryptedSecret, teamId: slackConnections.teamId })
        .from(slackConnections)
        .where(and(eq(slackConnections.workspaceId, draft.workspaceId), eq(slackConnections.kind, "app")))
    : [];
  // The click must come from the Slack workspace this Meerko workspace connected.
  if (!draft || !conn || !payload.team?.id || conn.teamId !== payload.team.id || !payload.user?.id) {
    await note("This draft isn't connected to this Slack workspace.");
    return { outcome: "unknown_draft" };
  }
  const token = deps.box.decrypt(conn.encryptedSecret);
  let member: Awaited<ReturnType<typeof memberFor>>;
  try {
    member = await memberFor(db, fetchFn, token, draft.workspaceId, payload.user.id);
  } catch (err) {
    // Slack refused the lookup (a revoked token, a missing scope): say so in Slack instead of failing the click.
    if (!(err instanceof SlackError)) throw err;
    await note(`Couldn't check who you are in Slack (${err.code}). Approve or discard it in Meerko.`);
    return { outcome: "lookup_failed" };
  }
  if (!member) {
    await note("Only members of this Meerko workspace can approve or discard drafts. Your Slack email has to match your Meerko login.");
    return { outcome: "not_member" };
  }

  const by = `<@${payload.user.id}>`;
  try {
    if (action.action_id === "meerko_approve") {
      await approveDraft(db, draft.workspaceId, draft.id, deps.approve);
      await respond(fetchFn, payload.response_url, { replace_original: true, text: `Sent to ${draft.to}`, blocks: resolvedDraftBlocks(draft, "sent", by) });
      return { outcome: "sent" };
    }
    await discardDraft(db, draft.workspaceId, draft.id);
    await respond(fetchFn, payload.response_url, { replace_original: true, text: "Draft discarded", blocks: resolvedDraftBlocks(draft, "discarded", by) });
    return { outcome: "discarded" };
  } catch (err) {
    if (err instanceof ReplyError || err instanceof NotFoundError) {
      await note(`Couldn't do that: ${err.message}`);
      return { outcome: "error" };
    }
    throw err;
  }
}

/**
 * After a draft is approved or discarded anywhere else (dashboard, API), the Slack message loses its buttons too.
 * Best effort: a failure here never fails the approval.
 */
export async function syncSlackDraft(db: Db, deps: SlackDeps, draftId: string, outcome: "sent" | "discarded", by = "someone in Meerko") {
  if (!deps.box) return;
  const [row] = await db
    .select({ channel: replyDrafts.slackChannel, ts: replyDrafts.slackTs, body: replyDrafts.body, to: messages.fromEmail, secret: slackConnections.encryptedSecret, kind: slackConnections.kind })
    .from(replyDrafts)
    .innerJoin(messages, eq(replyDrafts.replyId, messages.id))
    .innerJoin(slackConnections, eq(slackConnections.workspaceId, replyDrafts.workspaceId))
    .where(eq(replyDrafts.id, draftId));
  if (!row?.channel || !row.ts || row.kind !== "app") return;
  await slackApi(deps.fetch ?? fetch, "chat.update", deps.box.decrypt(row.secret), {
    channel: row.channel,
    ts: row.ts,
    text: outcome === "sent" ? `Sent to ${row.to}` : "Draft discarded",
    blocks: resolvedDraftBlocks(row, outcome, esc(by)),
  }).catch(() => {});
}

/** `/meerko` (or `/meerko status`): what's waiting, privately. `/meerko help` lists the commands. */
export async function handleSlackCommand(db: Db, deps: SlackDeps, form: { team_id?: string; channel_id?: string; user_id?: string; text?: string }) {
  const fetchFn = deps.fetch ?? fetch;
  const ephemeral = (text: string) => ({ response_type: "ephemeral", text });
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const text = (form.text ?? "").trim().toLowerCase();
  if (text === "help") {
    return ephemeral("`/meerko` shows the replies and drafts waiting for you. Approve drafts from their messages in the channel Meerko posts to.");
  }
  if (text && text !== "status") return ephemeral(`Unknown command \`${esc(text)}\`. Try \`/meerko\` or \`/meerko help\`.`);

  const conns = form.team_id
    ? await db
        .select({ workspaceId: slackConnections.workspaceId, workspaceName: workspaces.name, channelId: slackConnections.channelId, secret: slackConnections.encryptedSecret })
        .from(slackConnections)
        .innerJoin(workspaces, eq(workspaces.id, slackConnections.workspaceId))
        .where(and(eq(slackConnections.teamId, form.team_id), eq(slackConnections.kind, "app")))
    : [];
  // A Slack workspace connected to several Meerko workspaces: the one posting to this channel wins.
  const conn = conns.find((c) => c.channelId === form.channel_id) ?? conns[0];
  if (!conn || !form.user_id) return ephemeral("This Slack workspace isn't connected to Meerko. Connect it under Connections → Slack.");
  const member = await memberFor(db, fetchFn, deps.box.decrypt(conn.secret), conn.workspaceId, form.user_id);
  if (!member) return ephemeral("Only members of the connected Meerko workspace can use /meerko. Your Slack email has to match your Meerko login.");

  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const n = sql<number>`count(*)::int`;
  const [replies, drafts, active, sent] = await Promise.all([
    count(db.select({ n }).from(messages).where(and(eq(messages.workspaceId, conn.workspaceId), humanReply()))),
    count(db.select({ n }).from(replyDrafts).where(and(eq(replyDrafts.workspaceId, conn.workspaceId), eq(replyDrafts.status, "pending")))),
    count(db.select({ n }).from(sequences).where(and(eq(sequences.workspaceId, conn.workspaceId), eq(sequences.status, "active")))),
    count(
      db
        .select({ n })
        .from(messages)
        .where(and(eq(messages.workspaceId, conn.workspaceId), eq(messages.direction, "out"), sql`${messages.sentAt} > now() - interval '24 hours'`)),
    ),
  ]);
  const c = { replies, drafts, sequences: active, sent };
  const inbox = inboxUrl(deps.appUrl);
  const lines = [
    `*${esc(conn.workspaceName)}*`,
    `• ${c.replies} ${c.replies === 1 ? "reply" : "replies"} waiting`,
    `• ${c.drafts} ${c.drafts === 1 ? "draft" : "drafts"} to approve`,
    `• ${c.sequences} active ${c.sequences === 1 ? "sequence" : "sequences"}, ${c.sent} ${c.sent === 1 ? "email" : "emails"} sent in the last 24h`,
  ];
  return { response_type: "ephemeral", text: lines.join("\n") + (inbox ? `\n<${inbox}|Open the inbox>` : "") };
}
