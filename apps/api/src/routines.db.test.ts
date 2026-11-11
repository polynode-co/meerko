import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createSession, SecretBox } from "@meerko/core";
import { createDb, eq, memberships, messages, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("Autopilot routines and drafts-only credentials (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const hookCalls: string[] = [];
  const app = createApp(db, {
    secretBox: new SecretBox(randomBytes(32).toString("base64")),
    appUrl: "https://app.example",
    // Lets the test point a webhook at a made-up host without real DNS.
    allowPrivateHooks: true,
    hookFetch: (async (url: string) => {
      hookCalls.push(url);
      return new Response("ok");
    }) as unknown as typeof fetch,
  });
  let ws: string;
  let userId: string;
  let session: string;
  let fullKey: string;
  let repliesKey: string;
  let replyId: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `hooks-${run}` }).returning())[0]!.id;
    userId = (await db.insert(users).values({ googleSub: `sub-${run}`, email: `hooks-${run}@test.example` }).returning())[0]!.id;
    await db.insert(memberships).values({ userId, workspaceId: ws, role: "owner" });
    session = (await createSession(db, userId, ws)).token;
    fullKey = (await createApiKey(db, ws, "full")).key;
    repliesKey = (await createApiKey(db, ws, "drafter", "replies")).key;
    replyId = (
      await db.insert(messages).values({ workspaceId: ws, direction: "in", fromEmail: "pia@slalom.example", toEmail: "me@x.example", body: "Pricing?" }).returning()
    )[0]!.id;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
    await db.delete(users).where(eq(users.id, userId));
  });

  const call = (path: string, token: string, init: RequestInit & { scopeHeader?: string } = {}) =>
    app.request(path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.scopeHeader ? { "x-meerko-scope": init.scopeHeader } : {}) },
    });

  it("lets a replies key read replies and save drafts, and nothing else", async () => {
    expect((await call("/v1/replies", repliesKey)).status).toBe(200);
    expect((await call(`/v1/replies/${replyId}/draft`, repliesKey, { method: "POST", body: JSON.stringify({ body: "Happy to share pricing." }) })).status).toBe(201);
    const drafts = await (await call("/v1/drafts", repliesKey)).json();
    expect(drafts.drafts).toHaveLength(1);

    const forbidden: [string, string][] = [
      ["POST", `/v1/drafts/${drafts.drafts[0].id}/approve`],
      ["POST", `/v1/drafts/${drafts.drafts[0].id}/discard`],
      ["GET", "/v1/sequences"],
      ["GET", "/v1/tables"],
      ["GET", "/v1/api-keys"],
      ["GET", "/v1/routines"],
    ];
    for (const [method, path] of forbidden) {
      const res = await call(path, repliesKey, { method });
      expect(res.status, `${method} ${path}`).toBe(403);
      expect((await res.json()).error).toMatch(/only read replies and save drafts/);
    }
  });

  it("narrows a full credential with the scope header, and never widens one", async () => {
    expect((await call("/v1/tables", fullKey)).status).toBe(200);
    expect((await call("/v1/tables", fullKey, { scopeHeader: "replies" })).status).toBe(403);
    expect((await call("/v1/tables", repliesKey, { scopeHeader: "full" })).status).toBe(403);
  });

  it("serves only the reply tools at /mcp/drafter", async () => {
    const list = async (path: string) => {
      const res = await app.request(path, {
        method: "POST",
        headers: { authorization: `Bearer ${fullKey}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      });
      return ((await res.json()).result.tools as { name: string }[]).map((t) => t.name).sort();
    };
    expect(await list("/mcp/drafter")).toEqual(["classify_reply", "draft_reply", "list_drafts", "list_replies", "start_routine_run"]);
    expect((await list("/mcp")).length).toBeGreaterThan(20);

    // Even through a tool, the drafter endpoint can't approve: the API refuses the call.
    const res = await app.request("/mcp/drafter", {
      method: "POST",
      headers: { authorization: `Bearer ${fullKey}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "approve_draft", arguments: { draft_id: "x" } } }),
    });
    expect(JSON.stringify(await res.json())).toMatch(/not found|isError/i);
  });

  it("speaks MCP Events on /mcp: initialize advertises events, events/list answers, an API key can't subscribe", async () => {
    const rpc = async (path: string, method: string, params: object = {}) =>
      (
        await app.request(path, {
          method: "POST",
          headers: { authorization: `Bearer ${fullKey}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
        })
      ).json();
    const init = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "chatgpt", version: "1" } };
    expect((await rpc("/mcp", "initialize", init)).result.capabilities.events).toEqual({});
    expect((await rpc("/mcp/drafter", "initialize", init)).result.capabilities.events).toBeUndefined();
    expect(await rpc("/mcp", "events/list")).toMatchObject({ id: 7, result: { events: [{ name: "routine.due" }] } });
    expect(await rpc("/mcp", "events/subscribe", { name: "routine.due" })).toMatchObject({ id: 7, error: { message: expect.stringMatching(/API key/) } });
  });

  it("lets any credential manage routines, but only a signed-in person choose what starts one", async () => {
    const created = await call("/v1/routines", fullKey, { method: "POST", body: JSON.stringify({ name: "Answer replies", brief: "Draft answers", when: "replies" }) });
    expect(created.status).toBe(201);
    const { routine } = await created.json();
    expect(routine).toMatchObject({ when: "replies", trigger: "own_scheduler", needsSetup: true, setup: { howItRuns: expect.stringMatching(/Meerko has to start this one/) } });

    const put = (token: string) =>
      call(`/v1/routines/${routine.id}/trigger`, token, { method: "PUT", body: JSON.stringify({ kind: "webhook", url: "https://n8n.internal/webhook/meerko" }) });
    expect((await put(fullKey)).status).toBe(403);
    const set = await (await put(session)).json();
    expect(set.secret).toMatch(/^whsec_/);
    expect(set.routine).toMatchObject({ trigger: "webhook", triggerUrl: "https://n8n.internal/webhook/meerko", needsSetup: false });
    expect(JSON.stringify(await (await call(`/v1/routines/${routine.id}`, fullKey)).json())).not.toContain(set.secret);

    const ran = await (await call(`/v1/routines/${routine.id}/run`, fullKey, { method: "POST" })).json();
    expect(ran).toMatchObject({ started: true, run: { reason: "manual", outcome: "fired" } });
    expect(hookCalls).toEqual(["https://n8n.internal/webhook/meerko"]);

    // The woken agent checks in with a drafts-only key and gets the brief.
    const start = await call(`/v1/routines/${routine.id}/start`, repliesKey, { method: "POST" });
    expect(start.status).toBe(200);
    expect(await start.json()).toMatchObject({ brief: "Draft answers", routine: { id: routine.id } });

    const bad = await call(`/v1/routines/${routine.id}/trigger`, session, { method: "PUT", body: JSON.stringify({ kind: "claude_routine", url: "https://example.com", token: "t" }) });
    expect(bad.status).toBe(400);
    expect((await call("/v1/routines", fullKey, { method: "POST", body: JSON.stringify({ name: "x", brief: "y", when: "replies" }) })).status).toBe(400);

    expect((await call(`/v1/routines/${routine.id}`, fullKey, { method: "DELETE" })).status).toBe(204);
    expect(await (await call("/v1/routines", fullKey)).json()).toEqual({ routines: [] });
  });

  it("creates replies-scoped keys from the dashboard", async () => {
    const res = await call("/v1/api-keys", session, { method: "POST", body: JSON.stringify({ name: "Routine", scope: "replies" }) });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: "Routine", scope: "replies" });
  });
});
