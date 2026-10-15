import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agentHooks, createDb, eq, messages, workspaces, type Db } from "@meerko/db";
import {
  CLAUDE_ROUTINE_BETA,
  DISABLE_AFTER_MS,
  getAgentHook,
  runAgentNotifyTick,
  setAgentHook,
  signWebhook,
  testAgentHook,
  type AgentHookDeps,
} from "./agent-hooks.ts";
import { SecretBox } from "./provider-keys.ts";
import { classifyReply } from "./replies/replies.ts";

const T0 = new Date("2026-10-15T09:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const ROUTINE = "https://api.anthropic.com/v1/claude_code/routines/trig_01abc/fire";

describe.skipIf(!process.env.DATABASE_URL)("agent hooks (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;
  let calls: { url: string; headers: Headers; body: string }[];
  let status: number;
  let failWith: Error | null;

  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: new Headers(init.headers), body: String(init.body) });
    if (failWith) throw failWith;
    return new Response("{}", { status });
  }) as unknown as typeof fetch;
  const deps = (minutes: number): AgentHookDeps => ({
    box,
    appUrl: "https://meerko.ai",
    fetch: fakeFetch,
    now: () => at(minutes),
    resolve: async () => ["93.184.216.34"],
  });

  const reply = async (minutes: number, fields: Partial<typeof messages.$inferInsert> = {}) =>
    (
      await db
        .insert(messages)
        .values({ workspaceId: ws, direction: "in", fromEmail: "pia@slalom.example", toEmail: "iker@meerko.ai", subject: "Re: Quick question", body: "Yes", sentAt: at(minutes), ...fields })
        .returning()
    )[0]!;
  const notified = async (id: string) => (await db.select().from(messages).where(eq(messages.id, id)))[0]!.agentNotifiedAt;
  /** Hooks are created "now"; pin the creation time so replies at T0+n count as arriving after it. */
  const createdAt = (minutes: number) => db.update(agentHooks).set({ createdAt: at(minutes) }).where(eq(agentHooks.workspaceId, ws));

  beforeEach(async () => {
    calls = [];
    status = 200;
    failWith = null;
    ws = (await db.insert(workspaces).values({ name: "Slalom outbound" }).returning())[0]!.id;
  });

  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  it("rings a webhook once for a burst of replies, signed, with no reply bodies", async () => {
    const { secret } = await setAgentHook(db, box, ws, { kind: "webhook", url: "https://hooks.example.com/meerko" }, { resolve: async () => ["93.184.216.34"] });
    expect(secret).toMatch(/^whsec_/);
    await createdAt(0);
    const a = await reply(10);
    const b = await reply(11, { fromEmail: "paula@webon.example" });

    // The oldest reply is only 1 minute old: wait for the burst to settle.
    expect(await runAgentNotifyTick(db, deps(11))).toMatchObject({ rung: 0 });
    expect(calls).toHaveLength(0);

    expect(await runAgentNotifyTick(db, deps(12))).toMatchObject({ rung: 1, replies: 2, failed: 0 });
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const payload = JSON.parse(call.body);
    expect(payload).toMatchObject({ type: "replies.waiting", workspace: { id: ws, name: "Slalom outbound" }, inbox_url: "https://meerko.ai/app/inbox" });
    expect(payload.replies.map((r: { id: string }) => r.id)).toEqual([a.id, b.id]);
    expect(call.body).not.toContain('"Yes"');
    const t = Math.floor(at(12).getTime() / 1000);
    expect(call.headers.get("meerko-signature")).toBe(signWebhook(secret!, call.body, t));

    expect(await notified(a.id)).toEqual(at(12));
    expect(await runAgentNotifyTick(db, deps(30))).toMatchObject({ rung: 0 });
    expect(calls).toHaveLength(1);
  });

  it("skips replies the rules or the agent already handled, and ones from before the hook existed", async () => {
    await setAgentHook(db, box, ws, { kind: "webhook", url: "https://hooks.example.com/meerko" }, { resolve: async () => ["93.184.216.34"] });
    await createdAt(0);
    await reply(-5); // before the hook
    await reply(5, { intent: "out_of_office", handledAt: at(5) });
    const classified = await reply(6);
    await classifyReply(db, ws, classified.id, "interested");
    const handled = await reply(7, { handledAt: at(8) });
    expect(await runAgentNotifyTick(db, deps(20))).toMatchObject({ rung: 0 });
    expect(calls).toHaveLength(0);
    expect(await notified(handled.id)).toBeNull();
  });

  it("calls a Claude Code routine with its token, the beta header and a summary", async () => {
    await setAgentHook(db, box, ws, { kind: "claude_routine", url: ROUTINE, token: "sk-ant-oat01-routine" });
    await createdAt(0);
    await reply(1, { subject: "Re: Pricing?" });
    await runAgentNotifyTick(db, deps(5));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(ROUTINE);
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer sk-ant-oat01-routine");
    expect(calls[0]!.headers.get("anthropic-beta")).toBe(CLAUDE_ROUTINE_BETA);
    expect(JSON.parse(calls[0]!.body)).toEqual({ text: '1 new reply in Meerko workspace "Slalom outbound":\n- pia@slalom.example: Re: Pricing?' });
  });

  it("leaves replies waiting when the call fails, retries after the interval, and switches off after a day", async () => {
    await setAgentHook(db, box, ws, { kind: "webhook", url: "https://hooks.example.com/meerko" }, { resolve: async () => ["93.184.216.34"] });
    await createdAt(0);
    const r = await reply(1);

    status = 500;
    expect(await runAgentNotifyTick(db, deps(5))).toMatchObject({ rung: 0, failed: 1 });
    expect(await notified(r.id)).toBeNull();
    expect((await getAgentHook(db, ws))!).toMatchObject({ enabled: true, lastStatus: 500, lastError: "The hook answered HTTP 500" });

    // Within the 5-minute interval: no new call.
    await runAgentNotifyTick(db, deps(8));
    expect(calls).toHaveLength(1);

    failWith = new TypeError("fetch failed");
    expect(await runAgentNotifyTick(db, deps(11))).toMatchObject({ failed: 1 });
    expect((await getAgentHook(db, ws))!.lastError).toBe("Couldn't reach the hook: fetch failed");

    // A day after the first failure, the hook turns itself off.
    const dayLater = 5 + DISABLE_AFTER_MS / 60_000;
    await runAgentNotifyTick(db, deps(dayLater));
    const hook = (await getAgentHook(db, ws))!;
    expect(hook.enabled).toBe(false);
    expect(hook.lastError).toMatch(/Switched off/);
    const before = calls.length;
    await runAgentNotifyTick(db, deps(dayLater + 60));
    expect(calls).toHaveLength(before);

    // Fixed and turned back on: the waiting reply goes out.
    failWith = null;
    status = 202;
    await db.update(agentHooks).set({ enabled: true, failingSince: null }).where(eq(agentHooks.workspaceId, ws));
    expect(await runAgentNotifyTick(db, deps(dayLater + 120))).toMatchObject({ rung: 1, replies: 1 });
    expect(await notified(r.id)).not.toBeNull();
  });

  it("announces a reply that arrives after a call on the next one", async () => {
    await setAgentHook(db, box, ws, { kind: "webhook", url: "https://hooks.example.com/meerko" }, { resolve: async () => ["93.184.216.34"] });
    await createdAt(0);
    await reply(1);
    await runAgentNotifyTick(db, deps(5));
    const late = await reply(6);
    await runAgentNotifyTick(db, deps(9)); // too soon after the last call
    expect(await notified(late.id)).toBeNull();
    await runAgentNotifyTick(db, deps(10));
    expect(await notified(late.id)).toEqual(at(10));
    expect(calls).toHaveLength(2);
  });

  it("refuses a webhook whose host now resolves to a private address", async () => {
    await setAgentHook(db, box, ws, { kind: "webhook", url: "https://hooks.example.com/meerko" }, { resolve: async () => ["93.184.216.34"] });
    await createdAt(0);
    await reply(1);
    expect(await runAgentNotifyTick(db, { ...deps(5), resolve: async () => ["10.0.0.7"] })).toMatchObject({ failed: 1 });
    expect(calls).toHaveLength(0);
  });

  it("validates input and sends test events", async () => {
    await expect(setAgentHook(db, box, ws, { kind: "claude_routine", url: "https://evil.example.com/fire", token: "x" })).rejects.toThrow(/API trigger URL/);
    await expect(setAgentHook(db, box, ws, { kind: "claude_routine", url: ROUTINE })).rejects.toThrow(/token/);
    await setAgentHook(db, box, ws, { kind: "claude_routine", url: ROUTINE, token: "tok_1234" });
    expect(await getAgentHook(db, ws)).toMatchObject({ kind: "claude_routine", secretLast4: "1234", enabled: true });
    expect(await testAgentHook(db, ws, deps(0))).toEqual({ ok: true, status: 200, error: null });
    expect(JSON.parse(calls[0]!.body).text).toMatch(/^Test from Meerko/);
    status = 401;
    expect(await testAgentHook(db, ws, deps(0))).toMatchObject({ ok: false, status: 401 });
  });
});
