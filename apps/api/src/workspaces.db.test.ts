import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FREE_TIER_CREDITS, PlanLimitError, assertMailboxAllowed, createApiKey, createSession, getBalance, grantCredits, setPlan } from "@meerko/core";
import { createDb, eq, inArray, mailboxes, memberships, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("workspaces (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const app = createApp(db, {});
  const made: string[] = [];
  let userId = "";
  let otherId = "";
  let first = "";
  let session = "";
  let key = "";

  const v1 = (path: string, token: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/v1${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  beforeAll(async () => {
    const [u] = await db.insert(users).values({ googleSub: `ws-${run}`, email: `ws-${run}@workspaces-test.example` }).returning();
    const [o] = await db.insert(users).values({ googleSub: `ws-o-${run}`, email: `ws-o-${run}@workspaces-test.example` }).returning();
    userId = u!.id;
    otherId = o!.id;
    const [ws] = await db.insert(workspaces).values({ name: `First ${run}` }).returning();
    first = ws!.id;
    made.push(first);
    await db.insert(memberships).values({ userId, workspaceId: first, role: "owner" });
    await grantCredits(db, first, 500, "test");
    session = (await createSession(db, userId, first)).token;
    key = (await createApiKey(db, first, "test")).key;
  });

  afterAll(async () => {
    // Pointers first: a paying workspace can't go while others bill to it.
    const rows = await db.select({ id: workspaces.id, billing: workspaces.billingWorkspaceId }).from(workspaces).where(inArray(workspaces.id, made));
    const pointers = rows.filter((r) => r.billing).map((r) => r.id);
    if (pointers.length) await db.delete(workspaces).where(inArray(workspaces.id, pointers));
    await db.delete(workspaces).where(inArray(workspaces.id, made));
    await db.delete(users).where(inArray(users.id, [userId, otherId]));
  });

  it("creates a brand workspace that shares the owner's plan and credits, without switching to it", async () => {
    const res = await v1("/workspaces", session, { method: "POST", body: { name: `  Second   ${run} ` } });
    expect(res.status).toBe(201);
    const { workspace } = await res.json();
    made.push(workspace.id);
    expect(workspace).toMatchObject({ name: `Second ${run}`, role: "owner" });

    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspace.id));
    expect(row!.billingWorkspaceId).toBe(first);
    // No second free tier: the balance is the first workspace's.
    expect(await getBalance(db, workspace.id)).toBe(500);
    expect(await getBalance(db, first)).toBe(500);

    const { workspaces: list } = await (await v1("/workspaces", session)).json();
    expect(list.map((w: { name: string; current: boolean }) => [w.name, w.current])).toEqual([
      [`First ${run}`, true],
      [`Second ${run}`, false],
    ]);
  });

  it("switches only the session it's called on, and only into the person's own workspaces", async () => {
    const other = (await createSession(db, userId, first)).token;
    const { workspaces: list } = await (await v1("/workspaces", session)).json();
    const second = list.find((w: { current: boolean }) => !w.current).id;

    const res = await v1("/workspaces/switch", session, { method: "POST", body: { workspace_id: second } });
    expect(res.status).toBe(200);
    expect((await (await v1("/me", session)).json()).workspace.id).toBe(second);
    expect((await (await v1("/me", other)).json()).workspace.id).toBe(first);

    // Someone else's workspace, or nonsense, is not found rather than forbidden.
    const [foreign] = await db.insert(workspaces).values({ name: `Foreign ${run}` }).returning();
    made.push(foreign!.id);
    expect((await v1("/workspaces/switch", session, { method: "POST", body: { workspace_id: foreign!.id } })).status).toBe(404);
    expect((await v1("/workspaces/switch", session, { method: "POST", body: { workspace_id: "nope" } })).status).toBe(404);

    await v1("/workspaces/switch", session, { method: "POST", body: { workspace_id: first } });
  });

  it("keeps an API key in its own workspace", async () => {
    const { workspaces: list } = await (await v1("/workspaces", key)).json();
    expect(list).toEqual([{ id: first, name: `First ${run}`, role: null, current: true }]);
    expect((await v1("/workspaces", key, { method: "POST", body: { name: "x" } })).status).toBe(403);
    expect((await v1("/workspaces/switch", key, { method: "POST", body: { workspace_id: first } })).status).toBe(403);
  });

  it("lets only an owner rename", async () => {
    expect((await (await v1(`/workspaces/${first}`, session, { method: "PATCH", body: { name: `Renamed ${run}` } })).json()).workspace.name).toBe(`Renamed ${run}`);
    await db.insert(memberships).values({ userId: otherId, workspaceId: first, role: "member" });
    const member = (await createSession(db, otherId, first)).token;
    expect((await v1(`/workspaces/${first}`, member, { method: "PATCH", body: { name: "Hijack" } })).status).toBe(403);
    expect((await v1(`/workspaces/${first}`, session, { method: "PATCH", body: { name: "  " } })).status).toBe(400);
  });

  it("gives a person who owns nothing yet a workspace that pays for itself, with the free tier", async () => {
    const member = (await createSession(db, otherId, first)).token;
    const { workspace } = await (await v1("/workspaces", member, { method: "POST", body: { name: `Own ${run}` } })).json();
    made.push(workspace.id);
    const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspace.id));
    expect(row!.billingWorkspaceId).toBeNull();
    expect(await getBalance(db, workspace.id)).toBe(FREE_TIER_CREDITS);
  });

  it("shares the plan and its mailbox limit across a person's workspaces", async () => {
    const [second] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.billingWorkspaceId, first));
    await db.insert(mailboxes).values({ workspaceId: first, provider: "gmail_imap", email: `a-${run}@workspaces-test.example`, encryptedPassword: "x" });
    // Free includes one mailbox in total, not one per brand.
    await expect(assertMailboxAllowed(db, second!.id, `b-${run}@workspaces-test.example`)).rejects.toBeInstanceOf(PlanLimitError);
    // Pro set on either workspace lands on the one that pays, and lifts the limit for both.
    await setPlan(db, second!.id, "pro");
    const [payer] = await db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, first));
    expect(payer!.plan).toBe("pro");
    await expect(assertMailboxAllowed(db, second!.id, `b-${run}@workspaces-test.example`)).resolves.toBeUndefined();
    await db.delete(mailboxes).where(eq(mailboxes.workspaceId, first));
  });
});
