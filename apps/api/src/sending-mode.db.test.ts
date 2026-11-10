import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createSession, SecretBox } from "@meerko/core";
import { createDb, eq, memberships, messages, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("sending mode: approval before sending (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const app = createApp(db, { secretBox: new SecretBox(randomBytes(32).toString("base64")) });
  let ws: string;
  let userId: string;
  let session: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `mode-${run}` }).returning())[0]!.id;
    userId = (await db.insert(users).values({ email: `mode-${run}@test.example` }).returning())[0]!.id;
    await db.insert(memberships).values({ userId, workspaceId: ws, role: "owner" });
    session = (await createSession(db, userId, ws)).token;
    key = (await createApiKey(db, ws, "full")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
    await db.delete(users).where(eq(users.id, userId));
  });

  const call = (path: string, token: string, init: RequestInit = {}) =>
    app.request(path, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });

  it("approves everything by default, and only a signed-in person turns that off", async () => {
    expect(await (await call("/v1/sending-mode", key)).json()).toEqual({ mode: { sequence_emails: "approve", reply_drafts: "approve" } });
    expect((await call("/v1/sending-mode", key, { method: "PUT", body: JSON.stringify({ reply_drafts: "auto" }) })).status).toBe(403);
    expect((await call("/v1/sending-mode", session, { method: "PUT", body: JSON.stringify({}) })).status).toBe(400);
    const res = await call("/v1/sending-mode", session, { method: "PUT", body: JSON.stringify({ reply_drafts: "auto" }) });
    expect(await res.json()).toEqual({ mode: { sequence_emails: "approve", reply_drafts: "auto" } });
  });

  it("tries to send a draft at once in auto mode, and keeps it pending when it can't", async () => {
    // A reply whose mailbox is gone: the auto-send fails, so the draft waits for a person as usual.
    const [reply] = await db.insert(messages).values({ workspaceId: ws, direction: "in", fromEmail: "pia@slalom.example", toEmail: "me@x.example", body: "Pricing?" }).returning();
    const res = await call(`/v1/replies/${reply!.id}/draft`, key, { method: "POST", body: JSON.stringify({ body: "Here it is." }) });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { draft: { id: string }; sent?: unknown; send_error?: string };
    expect(body.sent).toBeUndefined();
    expect(body.send_error).toContain("mailbox");
    const drafts = (await (await call("/v1/drafts", key)).json()) as { drafts: { id: string; status: string }[] };
    expect(drafts.drafts).toMatchObject([{ id: body.draft.id, status: "pending" }]);
  });

  it("lists no pending emails when there's nothing waiting, and refuses an empty approval", async () => {
    expect(await (await call("/v1/pending-emails", key)).json()).toEqual({ emails: [] });
    expect((await call("/v1/pending-emails/approve", key, { method: "POST", body: JSON.stringify({}) })).status).toBe(400);
  });
});
