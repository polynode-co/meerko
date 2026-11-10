import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createSession } from "@meerko/core";
import { createDb, eq, memberships, users, workspaces, type Db } from "@meerko/db";
import type { Analytics } from "./analytics.ts";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("optional sign-up questions (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const captured: Parameters<Analytics["capture"]>[0][] = [];
  const analytics = { capture: async (e: Parameters<Analytics["capture"]>[0]) => void captured.push(e), captureException: async () => {} } as unknown as Analytics;
  const app = createApp(db, { analytics });
  let ws: string;
  let userId: string;
  let session: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `about-${run}` }).returning())[0]!.id;
    userId = (await db.insert(users).values({ email: `about-${run}@test.example` }).returning())[0]!.id;
    await db.insert(memberships).values({ userId, workspaceId: ws, role: "owner" });
    session = (await createSession(db, userId, ws)).token;
    key = (await createApiKey(db, ws, "full")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
    await db.delete(users).where(eq(users.id, userId));
  });

  const post = (token: string, body: unknown) =>
    app.request("/v1/me/profile", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });

  it("stores the answers as person properties, and a blank form as a skip", async () => {
    expect((await post(session, { role: "founder", company_size: "2-10", agent: "claude_code" })).status).toBe(204);
    expect(captured.at(-1)).toMatchObject({
      distinctId: userId,
      event: "profile_answered",
      set: { role: "founder", company_size: "2-10", agent: "claude_code" },
      properties: { skipped: false },
    });
    expect((await post(session, {})).status).toBe(204);
    expect(captured.at(-1)).toMatchObject({ event: "profile_answered", set: {}, properties: { skipped: true } });
  });

  it("refuses unknown answers and API keys", async () => {
    expect((await post(session, { role: "ceo" })).status).toBe(400);
    expect((await post(key, { role: "founder" })).status).toBe(403);
  });
});
