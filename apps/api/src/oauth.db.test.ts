import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession, SecretBox } from "@meerko/core";
import { createDb, eq, memberships, oauthClients, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("OAuth for MCP clients (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const app = createApp(db, { secretBox: new SecretBox(randomBytes(32).toString("base64")), appUrl: "https://app.example", publicUrl: "https://api.example" });
  const redirectUri = "http://127.0.0.1:33418/callback";
  let session = "";
  let workspaceId = "";
  let userId = "";
  const clientIds: string[] = [];

  beforeAll(async () => {
    const [ws] = await db.insert(workspaces).values({ name: `OAuth ${run}` }).returning();
    const [user] = await db.insert(users).values({ googleSub: `oauth-${run}`, email: `oauth-${run}@test.example` }).returning();
    await db.insert(memberships).values({ userId: user!.id, workspaceId: ws!.id, role: "owner" });
    workspaceId = ws!.id;
    userId = user!.id;
    session = (await createSession(db, userId, workspaceId)).token;
  });
  afterAll(async () => {
    for (const id of clientIds) await db.delete(oauthClients).where(eq(oauthClients.id, id));
    // Brands made in the test bill to this workspace, so they go first.
    await db.delete(workspaces).where(eq(workspaces.billingWorkspaceId, workspaceId));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(eq(users.id, userId));
  });

  const json = (path: string, body: unknown, token?: string) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const form = (path: string, fields: Record<string, string>) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields).toString() });
  const mcp = (body: unknown, token?: string) =>
    app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });

  async function register() {
    const res = await json("/oauth/register", { client_name: "Claude Code", redirect_uris: [redirectUri] });
    expect(res.status).toBe(201);
    const client = (await res.json()) as { client_id: string; token_endpoint_auth_method: string };
    expect(client.token_endpoint_auth_method).toBe("none");
    clientIds.push(client.client_id);
    return client.client_id;
  }

  /** /authorize → consent page → approve; returns the code and the PKCE verifier. */
  async function authorize(clientId: string, port = 33418) {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const q = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: `http://127.0.0.1:${port}/callback`,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "xyz",
    });
    const res = await app.request(`/oauth/authorize?${q}`);
    expect(res.status).toBe(302);
    const consent = new URL(res.headers.get("location")!);
    expect(`${consent.origin}${consent.pathname}`).toBe("https://app.example/oauth/consent");
    const request = consent.searchParams.get("request")!;

    const described = await json("/v1/oauth/requests/describe", { request }, session);
    expect(await described.json()).toEqual({ client_name: "Claude Code", redirect_to: `127.0.0.1:${port}`, workspace: `OAuth ${run}` });

    const decided = (await (await json("/v1/oauth/requests/decide", { request, approve: true }, session)).json()) as { redirect_to: string };
    const back = new URL(decided.redirect_to);
    expect(back.searchParams.get("state")).toBe("xyz");
    expect(back.searchParams.get("iss")).toBe("https://api.example");
    return { code: back.searchParams.get("code")!, verifier, redirect: `http://127.0.0.1:${port}/callback` };
  }

  it("publishes discovery metadata", async () => {
    const resource = await (await app.request("/.well-known/oauth-protected-resource/mcp")).json();
    expect(resource).toMatchObject({ resource: "https://api.example/mcp", authorization_servers: ["https://api.example"] });
    const server = await (await app.request("/.well-known/oauth-authorization-server")).json();
    expect(server).toMatchObject({ issuer: "https://api.example", code_challenge_methods_supported: ["S256"], registration_endpoint: "https://api.example/oauth/register" });
  });

  it("refuses unsafe redirect URIs and bad authorize requests", async () => {
    expect((await json("/oauth/register", { redirect_uris: ["http://evil.example/cb"] })).status).toBe(400);
    expect((await json("/oauth/register", { redirect_uris: ["javascript:alert(1)"] })).status).toBe(400);
    const clientId = await register();
    // An unregistered redirect is shown as an error, never followed.
    const wrong = await app.request(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=https://evil.example/cb&code_challenge=x&code_challenge_method=S256`);
    expect(wrong.status).toBe(400);
    // No PKCE: the error goes back to the client.
    const noPkce = await app.request(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=s`);
    expect(new URL(noPkce.headers.get("location")!).searchParams.get("error")).toBe("invalid_request");
  });

  it("asks MCP clients to sign in", async () => {
    const res = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe('Bearer resource_metadata="https://api.example/.well-known/oauth-protected-resource/mcp"');
  });

  it("runs the whole flow: code with PKCE, MCP tools, refresh, revoke", async () => {
    const clientId = await register();

    // A wrong verifier fails, and burns the code.
    const first = await authorize(clientId, 50111); // any loopback port is accepted
    const bad = await form("/oauth/token", { grant_type: "authorization_code", code: first.code, client_id: clientId, redirect_uri: first.redirect, code_verifier: "nope" });
    expect(await bad.json()).toMatchObject({ error: "invalid_grant" });
    const reused = await form("/oauth/token", { grant_type: "authorization_code", code: first.code, client_id: clientId, redirect_uri: first.redirect, code_verifier: first.verifier });
    expect(reused.status).toBe(400);

    const { code, verifier, redirect } = await authorize(clientId);
    const res = await form("/oauth/token", { grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirect, code_verifier: verifier });
    expect(res.status).toBe(200);
    const tokens = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
    expect(tokens.access_token).toMatch(/^mo_/);
    expect(tokens.expires_in).toBe(3600);

    // The hosted MCP server, calling the API as this workspace.
    const init = await mcp(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } },
      tokens.access_token,
    );
    expect(init.status).toBe(200);
    const list = (await (await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, tokens.access_token)).json()) as { result: { tools: unknown[] } };
    expect(list.result.tools).toHaveLength(44);
    const call = (await (
      await mcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_tables", arguments: {} } }, tokens.access_token)
    ).json()) as { result: { isError?: boolean; content: { text: string }[] } };
    expect(call.result.isError).toBeUndefined();
    expect(JSON.parse(call.result.content[0]!.text)).toEqual([]);

    // An app token uses the API but can't mint keys or connect more apps.
    expect((await json("/v1/api-keys", { name: "x" }, tokens.access_token)).status).toBe(403);

    // Connected apps lists it.
    const apps = (await (await app.request("/v1/connected-apps", { headers: { authorization: `Bearer ${session}` } })).json()) as { apps: { id: string; name: string }[] };
    expect(apps.apps.map((a) => a.name)).toEqual(["Claude Code"]);

    // The agent makes a second brand and moves this connection to it; the dashboard session stays put.
    const tool = async (name: string, args: Record<string, unknown> = {}) => {
      const out = (await (await mcp({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name, arguments: args } }, tokens.access_token)).json()) as {
        result: { isError?: boolean; content: { text: string }[] };
      };
      expect(out.result.isError, out.result.content[0]?.text).toBeUndefined();
      return JSON.parse(out.result.content[0]!.text);
    };
    const brand = await tool("create_workspace", { name: `Brand ${run}` });
    expect((await tool("whoami")).workspace.id).toBe(workspaceId);
    await tool("switch_workspace", { workspace_id: brand.id });
    expect((await tool("whoami")).workspace).toEqual({ id: brand.id, name: `Brand ${run}` });
    expect((await tool("list_workspaces")).map((w: { name: string; current: boolean }) => [w.name, w.current])).toEqual([
      [`OAuth ${run}`, false],
      [`Brand ${run}`, true],
    ]);
    const me = (await (await app.request("/v1/me", { headers: { authorization: `Bearer ${session}` } })).json()) as { workspace: { id: string } };
    expect(me.workspace.id).toBe(workspaceId);
    await tool("switch_workspace", { workspace_id: workspaceId });

    // Refresh rotates both tokens.
    const refreshed = (await (await form("/oauth/token", { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: clientId })).json()) as {
      access_token: string;
      refresh_token: string;
    };
    expect(refreshed.access_token).toMatch(/^mo_/);
    expect((await form("/oauth/token", { grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: clientId })).status).toBe(400);
    expect((await mcp({ jsonrpc: "2.0", id: 4, method: "tools/list" }, tokens.access_token)).status).toBe(401);
    expect((await mcp({ jsonrpc: "2.0", id: 5, method: "tools/list" }, refreshed.access_token)).status).toBe(200);

    // Disconnecting from Settings ends access.
    const del = await app.request(`/v1/connected-apps/${apps.apps[0]!.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session}` } });
    expect(del.status).toBe(204);
    expect((await mcp({ jsonrpc: "2.0", id: 6, method: "tools/list" }, refreshed.access_token)).status).toBe(401);
  });

  it("sends a declined request back with access_denied", async () => {
    const clientId = await register();
    const challenge = createHash("sha256").update("v").digest("base64url");
    const res = await app.request(
      `/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${challenge}&code_challenge_method=S256&state=s`,
    );
    const request = new URL(res.headers.get("location")!).searchParams.get("request")!;
    const decided = (await (await json("/v1/oauth/requests/decide", { request, approve: false }, session)).json()) as { redirect_to: string };
    expect(new URL(decided.redirect_to).searchParams.get("error")).toBe("access_denied");
  });
});
