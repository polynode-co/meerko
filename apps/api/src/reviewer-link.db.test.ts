import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientIpFromForwarded, createReviewerLink, ReviewerLinkError, revokeReviewerLinks, SecretBox } from "@meerko/core";
import { createDb, eq, inArray, memberships, oauthClients, reviewerLinks, reviewerLinkUses, sessions, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe("clientIpFromForwarded", () => {
  it("reads the visitor's address, not what the visitor sent", () => {
    expect(clientIpFromForwarded("203.0.113.7, 35.191.0.1")).toBe("203.0.113.7"); // visitor, load balancer
    expect(clientIpFromForwarded("1.1.1.1, 203.0.113.7, 35.191.0.1")).toBe("203.0.113.7"); // a forged first entry
    expect(clientIpFromForwarded("203.0.113.7")).toBe("203.0.113.7");
    expect(clientIpFromForwarded(null)).toBe("unknown");
    expect(clientIpFromForwarded(" , ")).toBe("unknown");
  });
});

describe.skipIf(!process.env.DATABASE_URL)("reviewer sign-in links (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const email = `reviewer-${run}@reviewer-link-test.example`;
  const other = `other-${run}@reviewer-link-test.example`;
  const app = createApp(db, { secretBox: new SecretBox(randomBytes(32).toString("base64")), appUrl: "https://app.example", publicUrl: "https://api.example" });
  // Each test comes from its own address, so one test's attempts don't count against another's limit.
  const ip = (n: number) => `198.51.100.${n}-${run}`;
  const clientIds: string[] = [];
  let userId = "";
  let workspaceId = "";

  beforeAll(async () => {
    const [ws] = await db.insert(workspaces).values({ name: `Reviewer ${run}` }).returning();
    const [user] = await db.insert(users).values({ email }).returning();
    await db.insert(memberships).values({ userId: user!.id, workspaceId: ws!.id, role: "owner" });
    await db.insert(users).values({ email: other }); // a user with no workspace
    userId = user!.id;
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    for (const id of clientIds) await db.delete(oauthClients).where(eq(oauthClients.id, id));
    await db.delete(reviewerLinkUses).where(inArray(reviewerLinkUses.ip, [1, 2, 3, 4, 5, 6, 7].map(ip)));
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    await db.delete(users).where(inArray(users.email, [email, other]));
    await db.close();
  });

  const json = (path: string, body: unknown, token?: string) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const open = (token: string, from: string, userAgent = "ReviewBrowser/1.0") =>
    json("/auth/reviewer-link", { token, forwarded_for: `${from}, 35.191.0.1`, user_agent: userAgent });
  const uses = (from: string) => db.select().from(reviewerLinkUses).where(eq(reviewerLinkUses.ip, from));

  it("signs in as the link's user, any number of times, and logs each use without the token", async () => {
    const link = await createReviewerLink(db, ` ${email.toUpperCase()} `, 60);
    expect(link.token).toMatch(/^mr_[A-Za-z0-9_-]{43}$/); // 32 random bytes
    expect(Math.round((link.expiresAt.getTime() - Date.now()) / 86_400_000)).toBe(60);
    // Only the hash is stored.
    const [row] = await db.select().from(reviewerLinks).where(eq(reviewerLinks.userId, userId));
    expect(row!.tokenHash).toBe(createHash("sha256").update(link.token).digest("hex"));
    expect(JSON.stringify(row)).not.toContain(link.token);

    for (let i = 0; i < 3; i++) {
      const res = await open(link.token, ip(1));
      expect(res.status).toBe(200);
      const { token } = (await res.json()) as { token: string; expires_at: string };
      expect(token).toMatch(/^ms_/);
      const me = (await (await app.request("/v1/me", { headers: { authorization: `Bearer ${token}` } })).json()) as { user: { email: string }; workspace: { id: string } };
      expect(me.user.email).toBe(email);
      expect(me.workspace.id).toBe(workspaceId);
    }
    const logged = await uses(ip(1));
    expect(logged).toHaveLength(3);
    expect(logged.every((u) => u.outcome === "signed_in" && u.linkId === row!.id && u.userAgent === "ReviewBrowser/1.0")).toBe(true);
    expect(JSON.stringify(logged)).not.toContain(link.token);
    const [used] = await db.select().from(reviewerLinks).where(eq(reviewerLinks.id, row!.id));
    expect(used!.lastUsedAt).not.toBeNull();
  });

  it("gives a wrong, an expired and a revoked token the same answer", async () => {
    const expired = await createReviewerLink(db, email, 1);
    await db.update(reviewerLinks).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(reviewerLinks.tokenHash, createHash("sha256").update(expired.token).digest("hex")));
    const revoked = await createReviewerLink(db, email, 1);
    const result = await revokeReviewerLinks(db, email);
    expect(result.revoked).toBeGreaterThanOrEqual(1);

    const answers = [];
    for (const token of [`mr_${randomBytes(32).toString("base64url")}`, "nonsense", expired.token, revoked.token]) {
      const res = await open(token, ip(2));
      answers.push({ status: res.status, body: await res.text() });
    }
    expect(answers[0]!.status).toBe(400);
    expect(new Set(answers.map((a) => `${a.status} ${a.body}`)).size).toBe(1);
    expect((await uses(ip(2))).map((u) => u.outcome).sort()).toEqual(["expired", "revoked", "unknown", "unknown"]);
  });

  it("revokes every working link, and can end the sessions they started", async () => {
    const a = await createReviewerLink(db, email, 30);
    const b = await createReviewerLink(db, email, 30);
    expect(b.others).toBe(1);
    const { token: session } = (await (await open(a.token, ip(3))).json()) as { token: string };

    expect(await revokeReviewerLinks(db, email)).toMatchObject({ revoked: 2, sessionsEnded: 0 });
    expect((await open(a.token, ip(3))).status).toBe(400);
    expect((await open(b.token, ip(3))).status).toBe(400);
    // The session it already started still works until the maintainer ends it too.
    expect((await app.request("/v1/me", { headers: { authorization: `Bearer ${session}` } })).status).toBe(200);
    const again = await revokeReviewerLinks(db, email, { signOut: true });
    expect(again.revoked).toBe(0);
    expect(again.sessionsEnded).toBeGreaterThanOrEqual(1);
    expect((await app.request("/v1/me", { headers: { authorization: `Bearer ${session}` } })).status).toBe(401);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
  });

  it("limits attempts per IP, right or wrong, and not other IPs", async () => {
    const link = await createReviewerLink(db, email, 1);
    for (let i = 0; i < 20; i++) expect((await open("mr_guess" + i, ip(4))).status).toBe(400);
    // The 21st is refused even with the right token, and isn't logged.
    expect((await open(link.token, ip(4))).status).toBe(429);
    expect(await uses(ip(4))).toHaveLength(20);
    // A forged first hop doesn't get around it; another visitor is unaffected.
    expect((await json("/auth/reviewer-link", { token: link.token, forwarded_for: `10.9.8.7, ${ip(4)}, 35.191.0.1` })).status).toBe(429);
    expect((await open(link.token, ip(5))).status).toBe(200);
    // Attempts older than the window no longer count.
    await db.update(reviewerLinkUses).set({ createdAt: new Date(Date.now() - 11 * 60_000) }).where(eq(reviewerLinkUses.ip, ip(4)));
    expect((await open(link.token, ip(4))).status).toBe(200);
  });

  it("only makes links for a real user with a workspace, for a sane number of days", async () => {
    await expect(createReviewerLink(db, `nobody-${run}@reviewer-link-test.example`, 60)).rejects.toThrow(ReviewerLinkError);
    await expect(createReviewerLink(db, other, 60)).rejects.toThrow(/no workspace/);
    await expect(createReviewerLink(db, email, 0)).rejects.toThrow(ReviewerLinkError);
    await expect(createReviewerLink(db, email, 1.5)).rejects.toThrow(ReviewerLinkError);
    await expect(createReviewerLink(db, email, 9999)).rejects.toThrow(ReviewerLinkError);
    await expect(revokeReviewerLinks(db, `nobody-${run}@reviewer-link-test.example`)).rejects.toThrow(ReviewerLinkError);
  });

  it("has no API to create a link", async () => {
    const link = await createReviewerLink(db, email, 1);
    const { token: session } = (await (await open(link.token, ip(6))).json()) as { token: string };
    for (const path of ["/auth/reviewer-link/create", "/v1/reviewer-links", "/v1/reviewer-link"]) {
      expect((await json(path, { email }, session)).status).toBe(404);
    }
    // The sign-in route itself needs a token; an email gets nothing.
    expect((await json("/auth/reviewer-link", { email })).status).toBe(400);
  });

  it("lets the reviewer approve an MCP connector on the consent page, signed in by the link", async () => {
    const link = await createReviewerLink(db, email, 1);
    const { token: session } = (await (await open(link.token, ip(7))).json()) as { token: string };

    const redirectUri = "https://claude.ai/api/mcp/auth_callback";
    const registered = (await (await json("/oauth/register", { client_name: "Claude", redirect_uris: [redirectUri] })).json()) as { client_id: string };
    clientIds.push(registered.client_id);
    const verifier = randomBytes(32).toString("base64url");
    const q = new URLSearchParams({
      response_type: "code",
      client_id: registered.client_id,
      redirect_uri: redirectUri,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      state: "xyz",
    });
    const authorize = await app.request(`/oauth/authorize?${q}`);
    const consent = new URL(authorize.headers.get("location")!);
    expect(`${consent.origin}${consent.pathname}`).toBe("https://app.example/oauth/consent");
    const request = consent.searchParams.get("request")!;

    // What the consent page does with the session cookie the link set.
    const described = await json("/v1/oauth/requests/describe", { request }, session);
    expect(described.status).toBe(200);
    expect(await described.json()).toMatchObject({ client_name: "Claude", workspace: `Reviewer ${run}` });
    const decided = (await (await json("/v1/oauth/requests/decide", { request, approve: true }, session)).json()) as { redirect_to: string };
    const code = new URL(decided.redirect_to).searchParams.get("code")!;

    const tokens = await app.request("/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: registered.client_id, redirect_uri: redirectUri, code_verifier: verifier }).toString(),
    });
    expect(tokens.status).toBe(200);
    const { access_token } = (await tokens.json()) as { access_token: string };
    const me = (await (await app.request("/v1/me", { headers: { authorization: `Bearer ${access_token}` } })).json()) as { workspace: { id: string } };
    expect(me.workspace.id).toBe(workspaceId);
  });
});
