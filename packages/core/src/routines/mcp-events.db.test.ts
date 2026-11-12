import { createHmac, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, mcpEventSubscriptions, memberships, routineRuns, users, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "../provider-keys.ts";
import { answerEventsRequest, RPC_CALLBACK_UNVERIFIED, RPC_INVALID_PARAMS, standardWebhookSignature, subscriptionId, validEventSecret } from "./mcp-events.ts";
import { createRoutine, routineSetup, runRoutineNow, runRoutinesTick, setRoutineTrigger } from "./routines.ts";

const T0 = new Date("2026-11-09T07:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const PUBLIC = { resolve: async () => ["93.184.216.34"] };
const CALLBACK = "https://chatgpt.example/events/cb_123";
const WEEKDAYS_9 = { days: [1, 2, 3, 4, 5], time: "09:00", timezone: "Europe/Madrid" };

describe.skipIf(!process.env.DATABASE_URL)("MCP Events (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const secret = "whsec_" + randomBytes(32).toString("base64");
  let ws: string;
  let userId: string;
  let calls: { url: string; headers: Headers; body: string }[];
  let status: number;
  let echo: boolean;

  const fakeFetch = (async (url: string, init: RequestInit) => {
    const body = String(init.body);
    calls.push({ url, headers: new Headers(init.headers), body });
    const parsed = JSON.parse(body) as { type?: string; challenge?: string };
    if (parsed.type === "verification") return Response.json(echo ? { challenge: parsed.challenge } : {}, { status: 200 });
    return new Response("", { status });
  }) as unknown as typeof fetch;
  const deps = (minutes = 0) => ({ box, fetch: fakeFetch, now: () => at(minutes), ...PUBLIC });
  const subscribe = (routineId: string, s = secret) =>
    answerEventsRequest(db, userId, "events/subscribe", { name: "routine.due", arguments: { routine_id: routineId }, delivery: { mode: "webhook", url: CALLBACK, secret: s } }, deps());

  beforeEach(async () => {
    calls = [];
    status = 200;
    echo = true;
    ws = (await db.insert(workspaces).values({ name: "Events test" }).returning())[0]!.id;
    userId = (await db.insert(users).values({ email: `events-${randomBytes(4).toString("hex")}@meerko.test` }).returning())[0]!.id;
    await db.insert(memberships).values({ userId, workspaceId: ws, role: "owner" });
  });
  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("lists routine.due and checks secrets", async () => {
    const list = await answerEventsRequest(db, null, "events/list", {}, deps());
    expect(list).toMatchObject({ result: { events: [{ name: "routine.due", delivery: ["webhook"] }] } });
    expect(validEventSecret(secret)).toBe(true);
    expect(validEventSecret("whsec_c2hvcnQ=")).toBe(false);
    expect(await answerEventsRequest(db, null, "events/subscribe", {}, deps())).toMatchObject({ error: { code: RPC_INVALID_PARAMS } });
  });

  it("subscribes after a verified challenge, once, and delivers routine.due signed when the routine is due", async () => {
    const r = await createRoutine(db, ws, { name: "Find leads", brief: "Find 10 fintech CTOs", when: "schedule", cadence: WEEKDAYS_9 }, at(0));
    await setRoutineTrigger(db, box, ws, r.id, { kind: "chatgpt_events" }, { now: at(0) });
    expect(routineSetup({ ...r, trigger: "chatgpt_events" }, { mcpUrl: "https://api.meerko.ai/mcp", drafterUrl: "" }).prompt).toContain(`routine_id "${r.id}"`);

    const sub = await subscribe(r.id);
    expect(sub).toMatchObject({ result: { id: subscriptionId(userId, "routine.due", r.id, CALLBACK) } });
    expect(calls).toHaveLength(1);
    // Refreshing with the same secret isn't verified again.
    await subscribe(r.id);
    expect(calls).toHaveLength(1);
    expect(await db.select().from(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.routineId, r.id))).toHaveLength(1);

    calls = [];
    // 09:00 Madrid = 08:00 UTC, 60 minutes after T0.
    const tick = await runRoutinesTick(db, { box, fetch: fakeFetch, now: () => at(61), ...PUBLIC });
    expect(tick.started).toBe(1);
    const [call] = calls;
    expect(call!.url).toBe(CALLBACK);
    const event = JSON.parse(call!.body);
    expect(event).toMatchObject({ name: "routine.due", data: { routine_id: r.id, name: "Find leads", reason: "schedule" } });
    const id = call!.headers.get("webhook-id")!;
    const ts = Number(call!.headers.get("webhook-timestamp"));
    expect(call!.headers.get("webhook-signature")).toBe(standardWebhookSignature(secret, id, ts, call!.body));
    const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${call!.body}`).digest("base64");
    expect(call!.headers.get("webhook-signature")).toBe(`v1,${expected}`);
    expect(call!.headers.get("x-mcp-subscription-id")).toBe(sub && "result" in sub ? sub.result.id : "");
    const [run] = await db.select().from(routineRuns).where(eq(routineRuns.routineId, r.id));
    expect(run).toMatchObject({ outcome: "fired", httpStatus: 200 });
  });

  it("refuses a callback that doesn't echo, a routine elsewhere, and reports a run with nobody subscribed", async () => {
    const r = await createRoutine(db, ws, { name: "Find leads", brief: "b", when: "schedule", cadence: WEEKDAYS_9 }, at(0));
    await setRoutineTrigger(db, box, ws, r.id, { kind: "chatgpt_events" }, { now: at(0) });
    echo = false;
    expect(await subscribe(r.id)).toMatchObject({ error: { code: RPC_CALLBACK_UNVERIFIED } });

    const other = (await db.insert(workspaces).values({ name: "Not mine" }).returning())[0]!.id;
    try {
      const theirs = await createRoutine(db, other, { name: "x", brief: "b", when: "schedule", cadence: WEEKDAYS_9 }, at(0));
      echo = true;
      expect(await subscribe(theirs.id)).toMatchObject({ error: { code: RPC_INVALID_PARAMS } });
    } finally {
      await db.delete(workspaces).where(eq(workspaces.id, other));
    }

    const result = await runRoutineNow(db, ws, r.id, { box, fetch: fakeFetch, now: () => at(5), ...PUBLIC });
    expect(result.error).toMatch(/No ChatGPT task is subscribed/);
  });

  it("drops a subscription on 410 and after the person leaves the workspace", async () => {
    const r = await createRoutine(db, ws, { name: "Find leads", brief: "b", when: "schedule", cadence: WEEKDAYS_9 }, at(0));
    await setRoutineTrigger(db, box, ws, r.id, { kind: "chatgpt_events" }, { now: at(0) });
    await subscribe(r.id);
    status = 410;
    const gone = await runRoutineNow(db, ws, r.id, { box, fetch: fakeFetch, now: () => at(5), ...PUBLIC });
    expect(gone.error).toBeTruthy();
    expect(await db.select().from(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.routineId, r.id))).toHaveLength(0);

    status = 200;
    await subscribe(r.id, "whsec_" + randomBytes(32).toString("base64"));
    await db.delete(memberships).where(eq(memberships.userId, userId));
    calls = [];
    const left = await runRoutineNow(db, ws, r.id, { box, fetch: fakeFetch, now: () => at(10), ...PUBLIC });
    expect(left.error).toBeTruthy();
    expect(calls).toHaveLength(0);
    expect(await db.select().from(mcpEventSubscriptions).where(eq(mcpEventSubscriptions.routineId, r.id))).toHaveLength(0);
  });

  it("unsubscribes idempotently", async () => {
    const r = await createRoutine(db, ws, { name: "Find leads", brief: "b", when: "schedule", cadence: WEEKDAYS_9 }, at(0));
    await subscribe(r.id);
    const params = { name: "routine.due", arguments: { routine_id: r.id }, delivery: { mode: "webhook", url: CALLBACK } };
    expect(await answerEventsRequest(db, userId, "events/unsubscribe", params, deps())).toEqual({ result: {} });
    expect(await answerEventsRequest(db, userId, "events/unsubscribe", params, deps())).toEqual({ result: {} });
    expect(await db.select().from(mcpEventSubscriptions)).not.toContainEqual(expect.objectContaining({ routineId: r.id }));
  });
});
