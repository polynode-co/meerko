import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { agentHooks, and, enrollments, eq, gte, inArray, messages, sql, workspaces, type AgentHookKind, type Db } from "@meerko/db";
import { EncryptionNotConfiguredError, type SecretBox } from "./provider-keys.ts";
import { NotFoundError } from "./tables.ts";

/**
 * Agent hooks: when new human replies arrive, Meerko rings the user's own agent (a Claude Code routine or any
 * webhook) so it can draft answers with the reply tools. Meerko makes one HTTP call and no LLM calls; drafts
 * still wait for a person to approve them.
 */

/** Claude Code routines' API trigger is a research preview behind this beta header (code.claude.com/docs/en/routines). */
export const CLAUDE_ROUTINE_BETA = "experimental-cc-routine-2026-04-01";
const ROUTINE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/[A-Za-z0-9_-]+\/fire$/;

/** A burst of replies becomes one call: ring only once the oldest waiting reply is this old. */
export const NOTIFY_DELAY_MS = 2 * 60_000;
/** At most one call per hook this often (routines allow 30 API fires an hour). */
export const MIN_INTERVAL_MS = 5 * 60_000;
/** A hook that has failed for this long is switched off; the dashboard shows why. */
export const DISABLE_AFTER_MS = 24 * 60 * 60_000;
const TIMEOUT_MS = 10_000;
/** Replies listed in one call; the agent fetches everything through list_replies anyway. */
const MAX_LISTED = 50;

export class AgentHookError extends Error {}

export interface AgentHookView {
  kind: AgentHookKind;
  url: string;
  secretLast4: string;
  enabled: boolean;
  lastFiredAt: Date | null;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: Date;
}

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
    throw new AgentHookError("Enter a full URL, starting with https://");
  }
  if (opts.allowPrivate) {
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new AgentHookError("The URL must start with https:// or http://");
    return url;
  }
  if (url.protocol !== "https:") throw new AgentHookError("The URL must start with https://");
  if (url.username || url.password) throw new AgentHookError("Put credentials in the token, not the URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const resolve = opts.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : await resolve(host);
  } catch {
    throw new AgentHookError(`Couldn't resolve ${host}`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new AgentHookError("The URL must point to a public internet address");
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

/**
 * Saves the workspace's hook, replacing any earlier one. A routine needs the token from its API trigger; a
 * webhook gets a new signing secret, returned once here and never shown again.
 */
export async function setAgentHook(
  db: Db,
  box: SecretBox | null,
  workspaceId: string,
  input: { kind: AgentHookKind; url: string; token?: string },
  opts: { allowPrivate?: boolean; resolve?: (host: string) => Promise<string[]> } = {},
): Promise<{ hook: AgentHookView; secret?: string }> {
  if (!box) throw new EncryptionNotConfiguredError();
  const url = input.url.trim();
  let secret: string;
  if (input.kind === "claude_routine") {
    if (!ROUTINE_URL.test(url)) throw new AgentHookError("Paste the routine's API trigger URL: https://api.anthropic.com/v1/claude_code/routines/<id>/fire");
    secret = input.token?.trim() ?? "";
    if (!secret) throw new AgentHookError("Paste the routine's API trigger token");
  } else {
    await assertSafeHookUrl(url, opts);
    secret = "whsec_" + randomBytes(24).toString("base64url");
  }
  const values = { workspaceId, kind: input.kind, url, encryptedSecret: box.encrypt(secret), secretLast4: secret.slice(-4) };
  await db
    .insert(agentHooks)
    .values(values)
    .onConflictDoUpdate({
      target: agentHooks.workspaceId,
      // A new hook starts clean, and only replies from now on are announced.
      set: { ...values, enabled: true, lastFiredAt: null, lastStatus: null, lastError: null, failingSince: null, createdAt: sql`now()` },
    });
  const hook = (await getAgentHook(db, workspaceId))!;
  return input.kind === "webhook" ? { hook, secret } : { hook };
}

export async function getAgentHook(db: Db, workspaceId: string): Promise<AgentHookView | null> {
  const [row] = await db
    .select({
      kind: agentHooks.kind,
      url: agentHooks.url,
      secretLast4: agentHooks.secretLast4,
      enabled: agentHooks.enabled,
      lastFiredAt: agentHooks.lastFiredAt,
      lastStatus: agentHooks.lastStatus,
      lastError: agentHooks.lastError,
      createdAt: agentHooks.createdAt,
    })
    .from(agentHooks)
    .where(eq(agentHooks.workspaceId, workspaceId));
  return row ?? null;
}

export async function deleteAgentHook(db: Db, workspaceId: string) {
  const deleted = await db.delete(agentHooks).where(eq(agentHooks.workspaceId, workspaceId)).returning({ id: agentHooks.id });
  if (!deleted.length) throw new NotFoundError("No agent hook is set up");
}

/** Turns a hook back on (e.g. after it switched itself off) without changing its URL or secret. */
export async function enableAgentHook(db: Db, workspaceId: string) {
  const updated = await db
    .update(agentHooks)
    .set({ enabled: true, failingSince: null })
    .where(eq(agentHooks.workspaceId, workspaceId))
    .returning({ id: agentHooks.id });
  if (!updated.length) throw new NotFoundError("No agent hook is set up");
}

/** `meerko-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`, the same scheme as Stripe's. */
export function signWebhook(secret: string, body: string, unixSeconds: number) {
  const v1 = createHmac("sha256", secret).update(`${unixSeconds}.${body}`).digest("hex");
  return `t=${unixSeconds},v1=${v1}`;
}

export interface WaitingReply {
  id: string;
  from: string;
  subject: string | null;
  receivedAt: Date;
  sequenceId: string | null;
}

export type HookEvent = { type: "replies.waiting"; replies: WaitingReply[] } | { type: "test" };

export interface AgentHookDeps {
  box: SecretBox | null;
  /** The dashboard's URL, for the inbox link in the payload. */
  appUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
  /** MEERKO_ALLOW_PRIVATE_HOOKS: self-hosted installs may call hooks on their own network. */
  allowPrivate?: boolean;
  /** DNS lookup override (tests). */
  resolve?: (host: string) => Promise<string[]>;
}

interface HookRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  kind: AgentHookKind;
  url: string;
  encryptedSecret: string;
}

/** Builds and sends one call. Returns the HTTP status, or throws on a network error or timeout. */
async function ring(hook: HookRow, event: HookEvent, deps: AgentHookDeps, now: Date): Promise<number> {
  const secret = deps.box!.decrypt(hook.encryptedSecret);
  const inboxUrl = deps.appUrl ? `${deps.appUrl.replace(/\/$/, "")}/app/inbox` : undefined;
  const replies = event.type === "replies.waiting" ? event.replies : [];
  let headers: Record<string, string>;
  let body: string;
  if (hook.kind === "claude_routine") {
    headers = { authorization: `Bearer ${secret}`, "anthropic-beta": CLAUDE_ROUTINE_BETA, "anthropic-version": "2023-06-01" };
    body = JSON.stringify({ text: routineText(hook.workspaceName, event) });
  } else {
    // Checked again on every call: the host's DNS may have changed since the hook was saved.
    await assertSafeHookUrl(hook.url, { allowPrivate: deps.allowPrivate, resolve: deps.resolve });
    body = JSON.stringify({
      id: "evt_" + randomBytes(12).toString("hex"),
      type: event.type,
      created_at: now.toISOString(),
      workspace: { id: hook.workspaceId, name: hook.workspaceName },
      replies: replies.map((r) => ({ id: r.id, from: r.from, subject: r.subject, received_at: r.receivedAt.toISOString(), sequence_id: r.sequenceId })),
      ...(inboxUrl ? { inbox_url: inboxUrl } : {}),
    });
    headers = { "meerko-signature": signWebhook(secret, body, Math.floor(now.getTime() / 1000)) };
  }
  const res = await (deps.fetch ?? fetch)(hook.url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Meerko-Hooks/1", ...headers },
    body,
    // A redirect could lead anywhere, including a private address; treat it as a failure.
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  await res.body?.cancel().catch(() => {});
  return res.status;
}

/**
 * The text a routine receives. It's only a summary (the routine treats it as untrusted input): the routine's
 * own prompt says what to do, and reply bodies are read through the Meerko connector.
 */
function routineText(workspaceName: string, event: HookEvent) {
  if (event.type === "test") return `Test from Meerko (workspace "${workspaceName}"). Nothing to do.`;
  const lines = event.replies.slice(0, 20).map((r) => `- ${r.from}: ${r.subject ?? "(no subject)"}`);
  const more = event.replies.length > 20 ? `\n- and ${event.replies.length - 20} more` : "";
  const n = event.replies.length;
  return `${n} new ${n === 1 ? "reply" : "replies"} in Meerko workspace "${workspaceName}":\n${lines.join("\n")}${more}`;
}

async function loadHook(db: Db, workspaceId: string): Promise<(HookRow & { enabled: boolean; lastFiredAt: Date | null; failingSince: Date | null; createdAt: Date }) | undefined> {
  const [row] = await db
    .select({
      id: agentHooks.id,
      workspaceId: agentHooks.workspaceId,
      workspaceName: workspaces.name,
      kind: agentHooks.kind,
      url: agentHooks.url,
      encryptedSecret: agentHooks.encryptedSecret,
      enabled: agentHooks.enabled,
      lastFiredAt: agentHooks.lastFiredAt,
      failingSince: agentHooks.failingSince,
      createdAt: agentHooks.createdAt,
    })
    .from(agentHooks)
    .innerJoin(workspaces, eq(agentHooks.workspaceId, workspaces.id))
    .where(eq(agentHooks.workspaceId, workspaceId));
  return row;
}

/** Fires a `test` event now, ignoring the timing rules, and records the outcome like a real call. */
export async function testAgentHook(db: Db, workspaceId: string, deps: AgentHookDeps) {
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const hook = await loadHook(db, workspaceId);
  if (!hook) throw new NotFoundError("No agent hook is set up");
  const now = (deps.now ?? (() => new Date()))();
  try {
    const status = await ring(hook, { type: "test" }, deps, now);
    const ok = status >= 200 && status < 300;
    const error = ok ? null : `The hook answered HTTP ${status}`;
    await db.update(agentHooks).set({ lastStatus: status, lastError: error }).where(eq(agentHooks.id, hook.id));
    return { ok, status, error };
  } catch (err) {
    const error = describeFailure(err);
    await db.update(agentHooks).set({ lastStatus: null, lastError: error }).where(eq(agentHooks.id, hook.id));
    return { ok: false, status: null, error };
  }
}

function describeFailure(err: unknown) {
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) return `No answer within ${TIMEOUT_MS / 1000}s`;
  return `Couldn't reach the hook: ${err instanceof Error ? err.message : String(err)}`;
}

export interface AgentNotifyResult {
  /** Hooks called successfully. */
  rung: number;
  /** Replies announced by those calls. */
  replies: number;
  /** Hooks whose call failed (they're retried on a later tick). */
  failed: number;
}

/**
 * One pass over every enabled hook with replies waiting. A reply waits when it's inbound, the rules didn't handle
 * it, the agent hasn't classified it, nobody marked it handled, it arrived after the hook was set up, and no
 * earlier call announced it. Replies are marked only after a 2xx, so a failed call is retried later.
 */
export async function runAgentNotifyTick(db: Db, deps: AgentHookDeps): Promise<AgentNotifyResult> {
  const result: AgentNotifyResult = { rung: 0, replies: 0, failed: 0 };
  if (!deps.box) return result;
  const now = (deps.now ?? (() => new Date()))();

  const waiting = await db
    .select({ workspaceId: messages.workspaceId, oldest: sql<string>`min(${messages.sentAt})` })
    .from(messages)
    .innerJoin(agentHooks, eq(agentHooks.workspaceId, messages.workspaceId))
    .where(
      and(
        eq(messages.direction, "in"),
        sql`${messages.intent} is null`,
        sql`${messages.handledAt} is null`,
        sql`${messages.agentNotifiedAt} is null`,
        gte(messages.sentAt, agentHooks.createdAt),
        eq(agentHooks.enabled, true),
      ),
    )
    .groupBy(messages.workspaceId);

  for (const w of waiting) {
    if (now.getTime() - new Date(w.oldest).getTime() < NOTIFY_DELAY_MS) continue;
    const hook = await loadHook(db, w.workspaceId);
    if (!hook || !hook.enabled) continue;
    if (hook.lastFiredAt && now.getTime() - hook.lastFiredAt.getTime() < MIN_INTERVAL_MS) continue;

    const replies = await db
      .select({ id: messages.id, from: messages.fromEmail, subject: messages.subject, receivedAt: messages.sentAt, sequenceId: enrollments.sequenceId })
      .from(messages)
      .leftJoin(enrollments, eq(messages.enrollmentId, enrollments.id))
      .where(
        and(
          eq(messages.workspaceId, w.workspaceId),
          eq(messages.direction, "in"),
          sql`${messages.intent} is null`,
          sql`${messages.handledAt} is null`,
          sql`${messages.agentNotifiedAt} is null`,
          gte(messages.sentAt, hook.createdAt),
        ),
      )
      .orderBy(messages.sentAt)
      .limit(MAX_LISTED);
    if (replies.length === 0) continue;

    let status: number | null = null;
    let error: string | null = null;
    try {
      status = await ring(hook, { type: "replies.waiting", replies }, deps, now);
      if (status < 200 || status >= 300) error = `The hook answered HTTP ${status}`;
    } catch (err) {
      error = describeFailure(err);
    }

    if (!error) {
      await db.transaction(async (tx) => {
        await tx.update(messages).set({ agentNotifiedAt: now }).where(inArray(messages.id, replies.map((r) => r.id)));
        await tx.update(agentHooks).set({ lastFiredAt: now, lastStatus: status, lastError: null, failingSince: null }).where(eq(agentHooks.id, hook.id));
      });
      result.rung++;
      result.replies += replies.length;
    } else {
      const failingSince = hook.failingSince ?? now;
      const disable = now.getTime() - failingSince.getTime() >= DISABLE_AFTER_MS;
      await db
        .update(agentHooks)
        .set({
          // Counts as a call for the interval, so a broken hook isn't hammered every tick.
          lastFiredAt: now,
          lastStatus: status,
          lastError: disable ? `${error}. Switched off after failing for a day; fix it and turn it back on.` : error,
          failingSince,
          enabled: !disable,
        })
        .where(eq(agentHooks.id, hook.id));
      result.failed++;
    }
  }
  return result;
}
