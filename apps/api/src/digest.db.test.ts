import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, createSession, digestUnsubscribeToken, SecretBox } from "@meerko/core";
import { createDb, eq, memberships, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("daily digest settings and unsubscribe link (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const app = createApp(db, { secretBox: box, appUrl: "https://app.example" });
  let ws: string;
  let userId: string;
  let session: string;
  let key: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `digest-api-${run}` }).returning())[0]!.id;
    userId = (await db.insert(users).values({ email: `digest-${run}@test.example` }).returning())[0]!.id;
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
  const enabled = async () => ((await (await call("/v1/digest", session)).json()) as { digest: { enabled: boolean } }).digest.enabled;

  it("is on by default, and only a signed-in person changes it", async () => {
    expect(await (await call("/v1/digest", session)).json()).toEqual({ digest: { eligible: true, enabled: true, last_sent_at: null } });
    expect((await call("/v1/digest", key, { method: "PUT", body: JSON.stringify({ enabled: false }) })).status).toBe(403);
    const off = await call("/v1/digest", session, { method: "PUT", body: JSON.stringify({ enabled: false }) });
    expect(await off.json()).toMatchObject({ digest: { enabled: false } });
    await call("/v1/digest", session, { method: "PUT", body: JSON.stringify({ enabled: true }) });
    expect(await enabled()).toBe(true);
  });

  it("asks before unsubscribing on GET, and unsubscribes on POST (the mail app's one-click)", async () => {
    const token = digestUnsubscribeToken(box, userId, ws);
    const page = await app.request(`/digest/unsubscribe?t=${encodeURIComponent(token)}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Stop these emails");
    expect(await enabled()).toBe(true);

    const forged = await app.request(`/digest/unsubscribe?t=${encodeURIComponent(`${userId}.${ws}.nope`)}`, { method: "POST" });
    expect(forged.status).toBe(400);
    expect(await enabled()).toBe(true);

    const oneClick = await app.request(`/digest/unsubscribe?t=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(oneClick.status).toBe(200);
    expect(await enabled()).toBe(false);

    // The page's own button posts the token as a form field.
    await call("/v1/digest", session, { method: "PUT", body: JSON.stringify({ enabled: true }) });
    const button = await app.request("/digest/unsubscribe", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `t=${encodeURIComponent(token)}` });
    expect(button.status).toBe(200);
    expect(await enabled()).toBe(false);
  });
});
