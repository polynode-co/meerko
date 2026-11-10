import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, messages, routineRuns, routines, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "../provider-keys.ts";
import { classifyReply } from "../replies/replies.ts";
import { CLAUDE_ROUTINE_BETA, signWebhook } from "./http.ts";
import {
  createRoutine,
  getRoutine,
  listRoutines,
  PAUSE_AFTER_MS,
  routineSetup,
  runRoutineNow,
  runRoutinesTick,
  setRoutineTrigger,
  startRoutineRun,
  updateRoutine,
  type RoutineDeps,
} from "./routines.ts";

// Monday 2026-11-09, 09:00 in Madrid is 08:00 UTC.
const T0 = new Date("2026-11-09T07:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const ROUTINE = "https://api.anthropic.com/v1/claude_code/routines/trig_01abc/fire";
const PUBLIC = { resolve: async () => ["93.184.216.34"] };
const WEEKDAYS_9 = { days: [1, 2, 3, 4, 5], time: "09:00", timezone: "Europe/Madrid" };

describe.skipIf(!process.env.DATABASE_URL)("routines (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;
  let calls: { url: string; headers: Headers; body: string }[];
  let status: number;
  let failWith: Error | null;
  let answer: unknown;

  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: new Headers(init.headers), body: String(init.body) });
    if (failWith) throw failWith;
    return new Response(JSON.stringify(answer), { status });
  }) as unknown as typeof fetch;
  const deps = (minutes: number): RoutineDeps => ({ box, appUrl: "https://meerko.ai", fetch: fakeFetch, now: () => at(minutes), ...PUBLIC });

  const reply = async (minutes: number, fields: Partial<typeof messages.$inferInsert> = {}) =>
    (
      await db
        .insert(messages)
        .values({ workspaceId: ws, direction: "in", fromEmail: "pia@slalom.example", toEmail: "iker@meerko.ai", subject: "Re: Quick question", body: "Yes", sentAt: at(minutes), ...fields })
        .returning()
    )[0]!;
  const notified = async (id: string) => (await db.select().from(messages).where(eq(messages.id, id)))[0]!.agentNotifiedAt;
  const repliesRoutine = (kind: "webhook" | "claude_routine" = "webhook") =>
    createRoutine(db, ws, { name: "Answer new replies", brief: "Draft answers to new replies", when: "replies" }, at(0)).then(async (r) => {
      const res = await setRoutineTrigger(db, box, ws, r.id, kind === "webhook" ? { kind, url: "https://hooks.example.com/meerko" } : { kind, url: ROUTINE, token: "sk-ant-oat01-routine" }, { ...PUBLIC, now: at(0) });
      return { routine: res.routine, secret: res.secret };
    });
  const runs = async (routineId: string) => db.select().from(routineRuns).where(eq(routineRuns.routineId, routineId)).orderBy(routineRuns.createdAt);

  beforeEach(async () => {
    calls = [];
    status = 200;
    failWith = null;
    answer = {};
    ws = (await db.insert(workspaces).values({ name: "Slalom outbound" }).returning())[0]!.id;
  });

  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  describe("replies routines", () => {
    it("start once for a burst of replies, signed, with no reply bodies", async () => {
      const { routine, secret } = await repliesRoutine();
      expect(secret).toMatch(/^whsec_/);
      const a = await reply(10);
      const b = await reply(11, { fromEmail: "paula@webon.example" });

      // The oldest reply is only 1 minute old: wait for the burst to settle.
      expect(await runRoutinesTick(db, deps(11))).toMatchObject({ started: 0 });
      expect(await runRoutinesTick(db, deps(12))).toMatchObject({ started: 1, replies: 2, failed: 0 });
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      const payload = JSON.parse(call.body);
      expect(payload).toMatchObject({
        type: "replies.waiting",
        reason: "replies",
        workspace: { id: ws, name: "Slalom outbound" },
        routine: { id: routine.id, name: "Answer new replies", brief: "Draft answers to new replies", when: "replies" },
        inbox_url: "https://meerko.ai/app/inbox",
      });
      expect(payload.replies.map((r: { id: string }) => r.id)).toEqual([a.id, b.id]);
      expect(call.body).not.toContain('"Yes"');
      expect(call.headers.get("meerko-signature")).toBe(signWebhook(secret!, call.body, Math.floor(at(12).getTime() / 1000)));

      expect(await notified(a.id)).toEqual(at(12));
      expect(await runs(routine.id)).toMatchObject([{ reason: "replies", outcome: "fired", replies: 2, httpStatus: 200 }]);
      expect(await runRoutinesTick(db, deps(30))).toMatchObject({ started: 0 });
    });

    it("skip replies already handled, and ones from before the routine existed", async () => {
      await repliesRoutine();
      await reply(-5);
      await reply(5, { intent: "out_of_office", handledAt: at(5) });
      const classified = await reply(6);
      await classifyReply(db, ws, classified.id, "interested");
      await reply(7, { handledAt: at(8) });
      expect(await runRoutinesTick(db, deps(20))).toMatchObject({ started: 0 });
      expect(calls).toHaveLength(0);
    });

    it("start a Claude routine with its token, the beta header and a summary naming the routine", async () => {
      const { routine } = await repliesRoutine("claude_routine");
      answer = { type: "routine_fire", claude_code_session_url: "https://claude.ai/code/session_1" };
      await reply(1, { subject: "Re: Pricing?" });
      await runRoutinesTick(db, deps(5));
      expect(calls[0]!.url).toBe(ROUTINE);
      expect(calls[0]!.headers.get("authorization")).toBe("Bearer sk-ant-oat01-routine");
      expect(calls[0]!.headers.get("anthropic-beta")).toBe(CLAUDE_ROUTINE_BETA);
      expect(JSON.parse(calls[0]!.body)).toEqual({
        text: `1 new reply in Meerko workspace "Slalom outbound" for routine "Answer new replies":\n- pia@slalom.example: Re: Pricing?\nCall Meerko's start_routine_run with routine_id="${routine.id}" and follow the brief it returns.`,
      });
      expect((await runs(routine.id))[0]).toMatchObject({ sessionUrl: "https://claude.ai/code/session_1" });
    });

    it("leave replies waiting when a start fails, retry after the interval, and pause after a day", async () => {
      const { routine } = await repliesRoutine();
      const r = await reply(1);
      status = 500;
      expect(await runRoutinesTick(db, deps(5))).toMatchObject({ started: 0, failed: 1 });
      expect(await notified(r.id)).toBeNull();
      expect(await getRoutine(db, ws, routine.id)).toMatchObject({ status: "active", lastError: "It answered HTTP 500" });

      await runRoutinesTick(db, deps(8)); // within the interval
      expect(calls).toHaveLength(1);

      failWith = new TypeError("fetch failed");
      await runRoutinesTick(db, deps(11));
      expect((await getRoutine(db, ws, routine.id)).lastError).toBe("Couldn't reach it: fetch failed");

      const dayLater = 5 + PAUSE_AFTER_MS / 60_000;
      await runRoutinesTick(db, deps(dayLater));
      const paused = await getRoutine(db, ws, routine.id);
      expect(paused).toMatchObject({ status: "paused", statusReason: "failing" });
      expect(paused.lastError).toMatch(/Paused after failing for a day/);
      const before = calls.length;
      await runRoutinesTick(db, deps(dayLater + 60));
      expect(calls).toHaveLength(before);

      // Fixed and resumed: the waiting reply goes out.
      failWith = null;
      status = 202;
      await updateRoutine(db, ws, routine.id, { status: "active" }, at(dayLater + 100));
      expect(await runRoutinesTick(db, deps(dayLater + 120))).toMatchObject({ started: 1, replies: 1 });
      expect(await notified(r.id)).not.toBeNull();
    });

    it("refuse a webhook whose host now resolves to a private address", async () => {
      await repliesRoutine();
      await reply(1);
      expect(await runRoutinesTick(db, { ...deps(5), resolve: async () => ["10.0.0.7"] })).toMatchObject({ failed: 1 });
      expect(calls).toHaveLength(0);
    });

    it("allow one per workspace, and don't run on the AI's own scheduler", async () => {
      const r = await createRoutine(db, ws, { name: "Replies", brief: "Draft", when: "replies" }, at(0));
      expect(r).toMatchObject({ needsSetup: true, trigger: "own_scheduler" });
      expect(routineSetup(r, { mcpUrl: "https://api/mcp", drafterUrl: "https://api/mcp/drafter" }).prompt).toBeUndefined();
      await expect(createRoutine(db, ws, { name: "Again", brief: "Draft", when: "replies" })).rejects.toThrow(/already has a routine for new replies/);
      await reply(1);
      expect(await runRoutinesTick(db, deps(10))).toMatchObject({ started: 0 });
    });
  });

  describe("scheduled routines started by Meerko", () => {
    const scheduled = async () => {
      const r = await createRoutine(db, ws, { name: "Morning leads", brief: "Find 10 leads", when: "schedule", cadence: WEEKDAYS_9 }, at(0));
      await setRoutineTrigger(db, box, ws, r.id, { kind: "claude_routine", url: ROUTINE, token: "sk-ant-oat01-x" }, { now: at(0) });
      return r;
    };

    it("start at the due time, once, and record the AI's check-in", async () => {
      const r = await scheduled();
      expect(r.nextDueAt).toEqual(at(60));
      expect(await runRoutinesTick(db, deps(59))).toMatchObject({ started: 0 });
      expect(await runRoutinesTick(db, deps(60))).toMatchObject({ started: 1 });
      expect(await runRoutinesTick(db, deps(61))).toMatchObject({ started: 0 });
      expect(calls).toHaveLength(1);
      expect(JSON.parse(calls[0]!.body).text).toContain(`Meerko routine "Morning leads" in workspace "Slalom outbound" is due now (scheduled for Monday 9 November at 09:00 Europe/Madrid`);

      const start = await startRoutineRun(db, ws, r.id, at(65));
      expect(start).toMatchObject({ brief: "Find 10 leads", routine: { id: r.id, name: "Morning leads", schedule: "Weekdays at 09:00 (Europe/Madrid)" } });
      expect(await runs(r.id)).toMatchObject([{ id: start.run_id, reason: "schedule", outcome: "ran", dueAt: at(60), startedAt: at(65) }]);
    });

    it("mark a started run nobody checked in to", async () => {
      const r = await scheduled();
      await runRoutinesTick(db, deps(60));
      expect(await runRoutinesTick(db, deps(60 + 179))).toMatchObject({ noCallback: 0 });
      expect(await runRoutinesTick(db, deps(60 + 181))).toMatchObject({ noCallback: 1 });
      expect((await runs(r.id))[0]).toMatchObject({ outcome: "no_callback" });
    });

    it("start one late run after downtime, not a burst", async () => {
      const r = await scheduled();
      // Meerko was down from Monday 09:00 until Wednesday 10:00 (Madrid).
      await runRoutinesTick(db, deps(60 + 2 * 24 * 60 + 60));
      expect(calls).toHaveLength(1);
      expect((await runs(r.id)).map((x) => x.dueAt)).toEqual([at(60 + 2 * 24 * 60)]);
    });

    it("record a refused token with a reason the person can act on", async () => {
      const r = await scheduled();
      status = 401;
      expect(await runRoutinesTick(db, deps(60))).toMatchObject({ failed: 1 });
      expect((await runs(r.id))[0]).toMatchObject({ outcome: "fire_failed", httpStatus: 401 });
      expect((await getRoutine(db, ws, r.id)).lastError).toMatch(/refused the token/);
    });

    it("run now, whatever the time", async () => {
      const r = await scheduled();
      const res = await runRoutineNow(db, ws, r.id, deps(10));
      expect(res).toMatchObject({ started: true, error: null, run: { reason: "manual", outcome: "fired" } });
      expect(JSON.parse(calls[0]!.body).text).toContain("is due now.");
    });
  });

  describe("scheduled routines on the AI's own scheduler", () => {
    const own = () => createRoutine(db, ws, { name: "Morning leads", brief: "Find 10 leads", when: "schedule", cadence: WEEKDAYS_9 }, at(0));

    it("match an early or late check-in to the due time, and mark the ones nobody ran", async () => {
      const r = await own();
      expect(routineSetup(r, { mcpUrl: "https://api/mcp", drafterUrl: "https://api/mcp/drafter" }).prompt).toBe(
        `Run my Meerko routine "Morning leads". Call Meerko's start_routine_run with routine_id="${r.id}", then follow the brief it returns. Don't ask me anything; if something blocks a step, skip it and say why at the end.`,
      );
      // Monday's run checks in 20 minutes early.
      await startRoutineRun(db, ws, r.id, at(40));
      // Tuesday's never comes.
      const tuesday = 60 + 24 * 60;
      expect(await runRoutinesTick(db, deps(tuesday + 6 * 60 - 1))).toMatchObject({ missed: 0 });
      expect(await runRoutinesTick(db, deps(tuesday + 6 * 60 + 1))).toMatchObject({ missed: 1 });
      expect((await runs(r.id)).map((x) => [x.dueAt, x.outcome])).toEqual([
        [at(60), "ran"],
        [at(tuesday), "missed"],
      ]);
      // Meerko can't start it.
      expect(await runRoutineNow(db, ws, r.id, deps(tuesday + 400))).toEqual({ started: false, run: null, error: null });
      expect(calls).toHaveLength(0);
    });

    it("record a check-in outside any due time as the AI's own run, and refuse a paused routine", async () => {
      const r = await own();
      expect((await startRoutineRun(db, ws, r.id, at(60 + 12 * 60))).run_id).toBeTruthy();
      expect((await runs(r.id))[0]).toMatchObject({ reason: "ai", outcome: "ran", dueAt: null });
      await updateRoutine(db, ws, r.id, { status: "paused" });
      await expect(startRoutineRun(db, ws, r.id)).rejects.toThrow(/paused/);
    });

    it("don't count due times from before a resume as missed", async () => {
      const r = await own();
      await updateRoutine(db, ws, r.id, { status: "paused" }, at(1));
      await updateRoutine(db, ws, r.id, { status: "active" }, at(3 * 24 * 60));
      expect(await runRoutinesTick(db, deps(3 * 24 * 60 + 1))).toMatchObject({ missed: 0 });
      expect(await runs(r.id)).toEqual([]);
    });
  });

  it("validates fields and triggers, and keeps a saved token for the same URL", async () => {
    await expect(createRoutine(db, ws, { name: "", brief: "x", when: "schedule", cadence: WEEKDAYS_9 })).rejects.toThrow(/name/);
    await expect(createRoutine(db, ws, { name: "x", brief: "x", when: "schedule" })).rejects.toThrow(/cadence/);
    const r = await createRoutine(db, ws, { name: "x", brief: "x", when: "schedule", cadence: WEEKDAYS_9 });
    await expect(setRoutineTrigger(db, box, ws, r.id, { kind: "claude_routine", url: "https://evil.example.com/fire", token: "x" })).rejects.toThrow(/API trigger URL/);
    await expect(setRoutineTrigger(db, box, ws, r.id, { kind: "claude_routine", url: ROUTINE })).rejects.toThrow(/token/);
    await setRoutineTrigger(db, box, ws, r.id, { kind: "claude_routine", url: ROUTINE, token: "tok_1234" });
    expect(await setRoutineTrigger(db, box, ws, r.id, { kind: "claude_routine", url: ROUTINE })).toMatchObject({ routine: { trigger: "claude_routine", secretLast4: "1234" } });
    expect(await setRoutineTrigger(db, box, ws, r.id, { kind: "own_scheduler" })).toMatchObject({ routine: { trigger: "own_scheduler", triggerUrl: null, secretLast4: null } });
    await expect(getRoutine(db, ws, "not-a-uuid")).rejects.toThrow(/not found/);
    const other = (await db.insert(workspaces).values({ name: "Other" }).returning())[0]!.id;
    try {
      await expect(getRoutine(db, other, r.id)).rejects.toThrow(/not found/);
      expect(await listRoutines(db, other)).toEqual([]);
    } finally {
      await db.delete(workspaces).where(eq(workspaces.id, other));
    }
    expect((await db.select().from(routines).where(eq(routines.workspaceId, ws))).length).toBe(1);
  });
});
