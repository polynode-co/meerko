import { createHmac, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession, SecretBox } from "@meerko/core";
import { createDb, eq, memberships, slackConnections, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("Slack routes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const team = `T${run}`;
  let email: string;
  const slackCalls: string[] = [];
  const slackFetch = (async (url: string) => {
    slackCalls.push(url);
    if (url.endsWith("/oauth.v2.access")) return Response.json({ ok: true, access_token: "xoxb-1", team: { id: team, name: "Acme" }, incoming_webhook: { channel: "#sales", channel_id: "C1" } });
    if (url.endsWith("/users.info")) return Response.json({ ok: true, user: { profile: { email } } });
    return new Response("ok");
  }) as typeof fetch;
  const app = createApp(db, {
    secretBox: new SecretBox(randomBytes(32).toString("base64")),
    appUrl: "https://app.example",
    slack: { clientId: "1.2", clientSecret: "cs", signingSecret: "signing", redirectUri: "https://api.example/slack/oauth/callback" },
    slackFetch,
  });
  let ws: string;
  let userId: string;
  let session: string;

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `slack-api-${run}` }).returning())[0]!.id;
    email = `slack-${run}@test.example`;
    userId = (await db.insert(users).values({ googleSub: `sub-${run}`, email }).returning())[0]!.id;
    await db.insert(memberships).values({ userId, workspaceId: ws, role: "owner" });
    session = (await createSession(db, userId, ws)).token;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
    await db.delete(users).where(eq(users.id, userId));
  });

  const call = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { authorization: `Bearer ${session}`, "content-type": "application/json" } });
  const signed = (path: string, body: string, secret = "signing") => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");
    return app.request(path, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", "x-slack-request-timestamp": ts, "x-slack-signature": sig } });
  };

  it("installs the app: install link, then the callback stores the channel and goes back to Settings", async () => {
    expect(await (await call("/v1/slack")).json()).toEqual({ connection: null, app_available: true });
    const { url } = await (await call("/v1/slack/install")).json();
    const state = new URL(url).searchParams.get("state")!;

    const res = await app.request(`/slack/oauth/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://app.example/app/settings?slack=connected#slack");
    const { connection } = await (await call("/v1/slack")).json();
    expect(connection).toMatchObject({ kind: "app", teamName: "Acme", channelName: "sales", enabled: true });

    const bad = await app.request("/slack/oauth/callback?code=abc&state=forged");
    expect(bad.headers.get("location")).toBe("https://app.example/app/settings?slack=error#slack");
  });

  it("refuses unsigned clicks and commands, and answers signed ones", async () => {
    expect((await app.request("/slack/commands", { method: "POST", body: "team_id=x" })).status).toBe(401);
    expect((await signed("/slack/commands", "team_id=x", "wrong")).status).toBe(401);

    const res = await signed("/slack/commands", new URLSearchParams({ team_id: team, channel_id: "C1", user_id: "U1", text: "" }).toString());
    expect(res.status).toBe(200);
    expect((await res.json()).text).toContain("0 replies waiting");

    // A click on something that isn't a draft button is acknowledged and ignored.
    const click = new URLSearchParams({ payload: JSON.stringify({ type: "block_actions", team: { id: team }, actions: [{ action_id: "meerko_open" }] }) }).toString();
    expect((await signed("/slack/interactions", click)).status).toBe(200);
  });

  it("disconnects, and only a signed-in person can connect", async () => {
    expect((await call("/v1/slack", { method: "DELETE" })).status).toBe(204);
    expect(await db.select().from(slackConnections).where(eq(slackConnections.workspaceId, ws))).toEqual([]);
    const bad = await call("/v1/slack/webhook", { method: "PUT", body: JSON.stringify({ url: "https://example.com/x" }) });
    expect(bad.status).toBe(400);
  });
});
