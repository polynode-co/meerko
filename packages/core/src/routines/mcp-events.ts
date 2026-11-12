import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, mcpEventSubscriptions, memberships, routines, type Db } from "@meerko/db";
import type { SecretBox } from "../provider-keys.ts";
import { assertSafeHookUrl, CALL_TIMEOUT_MS, RoutineError } from "./http.ts";

/**
 * MCP Events for ChatGPT (https://developers.openai.com/plugins/build/mcp-events), ported from Antwork
 * (antwork.io src/lib/routines/mcp-events.ts). ChatGPT subscribes to `routine.due` on Meerko's MCP server
 * (`events/subscribe`, with a callback URL and a `whsec_` secret) and runs a task each time Meerko POSTs one.
 * Meerko sends it when a routine whose trigger is `chatgpt_events` is due, or when replies wait for a replies routine.
 *
 * What OpenAI's doc requires, and where it's done here:
 *   - the subscription belongs to the signed-in person, and the routine must be in a workspace they belong to;
 *   - a `whsec_` secret of 24-64 bytes; HTTPS to a public address, no redirects (`post`); a signed challenge the
 *     callback must echo before anything is delivered (`verifyCallback`);
 *   - a deterministic subscription id, so subscribing again is the same subscription; `refreshBefore` from us;
 *   - Standard Webhooks signatures and `X-MCP-Subscription-Id` on every POST; 2xx acknowledges; 410 ends the
 *     subscription.
 *
 * On by default; MEERKO_MCP_EVENTS=0 turns it off (`events/*` answer -32601, `initialize` carries no `events`).
 */

export const ROUTINE_DUE_EVENT = "routine.due";
/** How long a subscription lives before ChatGPT must refresh it. */
export const SUBSCRIPTION_TTL_MS = 30 * 86_400_000;
const MAX_BODY_BYTES = 256 * 1024;

export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL = -32603;
/** The callback didn't verify. */
export const RPC_CALLBACK_UNVERIFIED = -32015;

export const EVENTS_METHODS = ["events/list", "events/subscribe", "events/unsubscribe"] as const;
export type EventsMethod = (typeof EVENTS_METHODS)[number];
export const isEventsMethod = (m: unknown): m is EventsMethod => typeof m === "string" && (EVENTS_METHODS as readonly string[]).includes(m);
export const mcpEventsEnabled = (env: Record<string, string | undefined> = process.env) => env.MEERKO_MCP_EVENTS?.trim() !== "0";

export type RpcAnswer = { result: Record<string, unknown> } | { error: { code: number; message: string } };
const rpcError = (code: number, message: string): RpcAnswer => ({ error: { code, message } });

const ROUTINE_DUE_DEFINITION = {
  name: ROUTINE_DUE_EVENT,
  description:
    "A Meerko Autopilot routine is due, or replies are waiting for it. Run it: call Meerko's start_routine_run with this routine_id and follow the brief it returns.",
  delivery: ["webhook"],
  inputSchema: {
    type: "object",
    properties: { routine_id: { type: "string", description: "The Meerko routine to run, from Autopilot." } },
    required: ["routine_id"],
    additionalProperties: false,
  },
  payloadSchema: {
    type: "object",
    properties: {
      routine_id: { type: "string" },
      name: { type: "string" },
      reason: { type: "string", enum: ["schedule", "replies", "manual"] },
      due_at: { type: "string", format: "date-time" },
      replies: { type: "integer" },
      instructions: { type: "string" },
    },
    required: ["routine_id", "name", "reason", "instructions"],
    additionalProperties: false,
  },
};

export interface McpEventsDeps {
  box: SecretBox | null;
  fetch?: typeof fetch;
  allowPrivate?: boolean;
  resolve?: (host: string) => Promise<string[]>;
  now?: () => Date;
}

export function listMcpEvents(): RpcAnswer {
  return { result: { events: [ROUTINE_DUE_DEFINITION] } };
}

/** Same person, event, routine and callback: same subscription. */
export function subscriptionId(userId: string, name: string, routineId: string, url: string) {
  return "sub_" + createHash("sha256").update(JSON.stringify([userId, name, routineId, url])).digest("hex").slice(0, 32);
}

/** A Standard Webhooks secret: `whsec_` + base64 of 24-64 bytes. */
export function validEventSecret(secret: unknown): secret is string {
  if (typeof secret !== "string" || !secret.startsWith("whsec_")) return false;
  const b64 = secret.slice("whsec_".length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return false;
  const n = Buffer.from(b64, "base64").length;
  return n >= 24 && n <= 64;
}

/** Standard Webhooks: `v1,` + base64 HMAC-SHA256 of `<id>.<timestamp>.<body>`, keyed with the secret's bytes. */
export function standardWebhookSignature(secret: string, id: string, unixSeconds: number, body: string) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  return "v1," + createHmac("sha256", key).update(`${id}.${unixSeconds}.${body}`).digest("base64");
}

async function post(url: string, body: string, headers: Record<string, string>, deps: McpEventsDeps) {
  // Checked on every call: the host's DNS may have changed since it subscribed.
  await assertSafeHookUrl(url, { allowPrivate: deps.allowPrivate, resolve: deps.resolve });
  return (deps.fetch ?? fetch)(url, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "Meerko-MCP-Events/1 (+https://meerko.ai/docs/autopilot)", ...headers },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
}

function signedHeaders(secret: string, id: string, subId: string, body: string, now: Date) {
  const ts = Math.floor(now.getTime() / 1000);
  return { "webhook-id": id, "webhook-timestamp": String(ts), "webhook-signature": standardWebhookSignature(secret, id, ts, body), "X-MCP-Subscription-Id": subId };
}

/** POSTs the signed challenge; the callback must answer 2xx, echoing it. */
export async function verifyCallback(url: string, secret: string, subId: string, deps: McpEventsDeps): Promise<{ ok: true } | { ok: false; message: string }> {
  const challenge = randomBytes(24).toString("base64url");
  const body = JSON.stringify({ type: "verification", challenge });
  try {
    const res = await post(url, body, signedHeaders(secret, `msg_verification_${randomBytes(8).toString("hex")}`, subId, body, deps.now?.() ?? new Date()), deps);
    const text = await res.text().catch(() => "");
    if (res.status < 200 || res.status >= 300) return { ok: false, message: `The callback answered ${res.status} to the verification challenge.` };
    let echoed: unknown = null;
    try {
      echoed = (JSON.parse(text) as { challenge?: unknown }).challenge;
    } catch {
      // Not JSON: a failed verification, said below.
    }
    const a = Buffer.from(String(echoed ?? ""));
    const b = Buffer.from(challenge);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, message: "The callback did not echo the verification challenge." };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof RoutineError ? `The callback URL is not allowed: ${err.message}` : "The callback could not be reached." };
  }
}

function argsRoutineId(params: Record<string, unknown>) {
  const args = params.arguments as Record<string, unknown> | undefined;
  const id = typeof args?.routine_id === "string" ? args.routine_id.trim() : "";
  return /^[0-9a-f-]{36}$/i.test(id) ? id.toLowerCase() : null;
}

function deliveryUrl(params: Record<string, unknown>) {
  const d = params.delivery as Record<string, unknown> | undefined;
  if (d?.mode !== undefined && d.mode !== "webhook") return null;
  return typeof d?.url === "string" && d.url.startsWith("https://") ? d.url : null;
}

/** The routine, if it's in a workspace this person belongs to. */
async function routineFor(db: Db, userId: string, routineId: string) {
  const [row] = await db
    .select({ id: routines.id, workspaceId: routines.workspaceId })
    .from(routines)
    .innerJoin(memberships, and(eq(memberships.workspaceId, routines.workspaceId), eq(memberships.userId, userId)))
    .where(eq(routines.id, routineId));
  return row;
}

export async function subscribeMcpEvent(db: Db, userId: string, params: Record<string, unknown>, deps: McpEventsDeps): Promise<RpcAnswer> {
  if (params.name !== ROUTINE_DUE_EVENT) return rpcError(RPC_INVALID_PARAMS, `Unknown event "${String(params.name)}". Meerko offers ${ROUTINE_DUE_EVENT}.`);
  const routineId = argsRoutineId(params);
  if (!routineId) return rpcError(RPC_INVALID_PARAMS, "`arguments.routine_id` is required: the routine's id from Meerko's Autopilot.");
  const url = deliveryUrl(params);
  if (!url) return rpcError(RPC_INVALID_PARAMS, '`delivery` must be `{mode: "webhook", url: "https://…", secret}`.');
  const secret = (params.delivery as Record<string, unknown>).secret;
  if (!validEventSecret(secret)) return rpcError(RPC_INVALID_PARAMS, "`delivery.secret` must be a whsec_ secret of 24 to 64 bytes.");
  if (!deps.box) return rpcError(RPC_INTERNAL, "This Meerko can't store event subscriptions: MEERKO_ENCRYPTION_KEY isn't set.");

  const routine = await routineFor(db, userId, routineId);
  if (!routine) return rpcError(RPC_INVALID_PARAMS, `No routine "${routineId}" in your Meerko workspaces.`);

  const id = subscriptionId(userId, ROUTINE_DUE_EVENT, routineId, url);
  const [existing] = await db.select().from(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.id, id));
  let sameSecret = false;
  try {
    sameSecret = !!existing && deps.box.decrypt(existing.encryptedSecret) === secret;
  } catch {
    // Unreadable (the key rotated): verified again below.
  }
  // A refresh with the same secret isn't verified again; a new or rotated one is.
  if (!sameSecret) {
    const verified = await verifyCallback(url, secret, id, deps);
    if (!verified.ok) return rpcError(RPC_CALLBACK_UNVERIFIED, verified.message);
  }
  const now = deps.now?.() ?? new Date();
  const ttl = typeof params.ttlMs === "number" && params.ttlMs > 0 ? Math.min(params.ttlMs, SUBSCRIPTION_TTL_MS) : SUBSCRIPTION_TTL_MS;
  const refreshBefore = new Date(now.getTime() + ttl);
  const encryptedSecret = sameSecret ? existing!.encryptedSecret : deps.box.encrypt(secret);
  await db
    .insert(mcpEventSubscriptions)
    .values({ id, userId, workspaceId: routine.workspaceId, routineId, name: ROUTINE_DUE_EVENT, url, encryptedSecret, refreshBefore })
    .onConflictDoUpdate({ target: mcpEventSubscriptions.id, set: { encryptedSecret, refreshBefore, workspaceId: routine.workspaceId } });
  return { result: { id, refreshBefore: refreshBefore.toISOString(), cursor: null, truncated: false } };
}

export async function unsubscribeMcpEvent(db: Db, userId: string, params: Record<string, unknown>): Promise<RpcAnswer> {
  const routineId = argsRoutineId(params);
  const url = deliveryUrl(params);
  if (params.name === ROUTINE_DUE_EVENT && routineId && url) {
    await db.delete(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.id, subscriptionId(userId, ROUTINE_DUE_EVENT, routineId, url)));
  }
  // Idempotent: unknown or already gone is the same `{}`.
  return { result: {} };
}

/** Answers one `events/*` JSON-RPC request for the signed-in person. */
export async function answerEventsRequest(db: Db, userId: string | null, method: EventsMethod, params: unknown, deps: McpEventsDeps): Promise<RpcAnswer> {
  const p = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
  if (method === "events/list") return listMcpEvents();
  if (!userId) return rpcError(RPC_INVALID_PARAMS, "Sign in to Meerko (OAuth) to subscribe to events; an API key can't.");
  return method === "events/subscribe" ? subscribeMcpEvent(db, userId, p, deps) : unsubscribeMcpEvent(db, userId, p);
}

export interface RoutineDueCall {
  reason: "schedule" | "replies" | "manual";
  dueAt?: Date;
  replies?: number;
}

export function routineDueEvent(routine: { id: string; name: string }, call: RoutineDueCall, now: Date) {
  const instructions = `Call Meerko's start_routine_run with routine_id="${routine.id}" and follow the brief it returns. Don't ask anything; if something blocks a step, skip it and say why at the end.`;
  const at = call.dueAt ?? now;
  return {
    eventId: `evt_rt_${routine.id}_${at.getTime()}`,
    name: ROUTINE_DUE_EVENT,
    timestamp: now.toISOString(),
    data: {
      routine_id: routine.id,
      name: routine.name,
      reason: call.reason,
      ...(call.dueAt ? { due_at: call.dueAt.toISOString() } : {}),
      ...(call.replies !== undefined ? { replies: call.replies } : {}),
      instructions,
    },
    cursor: null,
  };
}

/**
 * Sends `routine.due` to every live subscription for the routine. A subscriber who left the workspace gets nothing
 * more and their subscription goes; a 410 ends one. Returns how many there were and how many acknowledged.
 */
export async function deliverRoutineDue(
  db: Db,
  routine: { id: string; name: string; workspaceId: string },
  call: RoutineDueCall,
  deps: McpEventsDeps,
): Promise<{ subscriptions: number; delivered: number; lastStatus: number | null; error: string | null }> {
  const now = deps.now?.() ?? new Date();
  const subs = await db
    .select({ sub: mcpEventSubscriptions, member: memberships.userId })
    .from(mcpEventSubscriptions)
    .leftJoin(memberships, and(eq(memberships.userId, mcpEventSubscriptions.userId), eq(memberships.workspaceId, mcpEventSubscriptions.workspaceId)))
    .where(and(eq(mcpEventSubscriptions.routineId, routine.id), gt(mcpEventSubscriptions.refreshBefore, now)));
  const event = routineDueEvent(routine, call, now);
  const body = JSON.stringify(event);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return { subscriptions: subs.length, delivered: 0, lastStatus: null, error: "The event is too large to send" };

  let delivered = 0;
  let lastStatus: number | null = null;
  let error: string | null = null;
  for (const { sub, member } of subs) {
    if (!member || sub.workspaceId !== routine.workspaceId) {
      await db.delete(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.id, sub.id));
      continue;
    }
    let secret: string;
    try {
      secret = deps.box!.decrypt(sub.encryptedSecret);
    } catch {
      error = "A ChatGPT subscription's secret can't be read; ask ChatGPT to subscribe again";
      continue;
    }
    try {
      const res = await post(sub.url, body, signedHeaders(secret, event.eventId, sub.id, body, now), deps);
      await res.body?.cancel().catch(() => {});
      lastStatus = res.status;
      await db.update(mcpEventSubscriptions).set({ lastDeliveryAt: now, lastStatus: res.status }).where(eq(mcpEventSubscriptions.id, sub.id));
      if (res.status >= 200 && res.status < 300) delivered++;
      else if (res.status === 410) await db.delete(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.id, sub.id));
      else error = `ChatGPT answered HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof RoutineError ? err.message : `Couldn't reach ChatGPT: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return { subscriptions: subs.length, delivered, lastStatus, error };
}
