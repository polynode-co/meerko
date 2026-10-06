import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { GoogleOAuth, SecretBox } from "@meerko/core";
import { createDb, eq, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("dashboard sign-in (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const email = `api-${run}@auth-test.example`;
  afterAll(async () => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    await db.delete(workspaces).where(eq(workspaces.name, "Api's workspace"));
    if (user) await db.delete(users).where(eq(users.id, user.id));
  });

  // Google, faked: any code signs in as `email`.
  const fetch = (async (url: string) => {
    if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "at", expires_in: 3600 });
    if (url.includes("userinfo")) return Response.json({ sub: `sub-${run}`, email, email_verified: true, name: "Api Test" });
    throw new Error(url);
  }) as typeof globalThis.fetch;
  const app = createApp(db, {
    secretBox: new SecretBox(randomBytes(32).toString("base64")),
    googleSignIn: new GoogleOAuth({ clientId: "c", clientSecret: "s", redirectUri: "https://api.example/auth/google/callback", fetch }),
    appUrl: "https://app.example",
    signup: "open",
  });

  /** Runs start → callback like a browser; returns the callback's redirect. */
  async function signIn(opts: { sendNonce?: boolean } = {}) {
    const start = await app.request("https://api.example/auth/google/start");
    expect(start.status).toBe(302);
    const google = new URL(start.headers.get("location")!);
    expect(google.searchParams.get("scope")).toBe("openid email profile");
    const nonce = start.headers.get("set-cookie")!.split(";")[0]!;
    const callback = await app.request(
      `https://api.example/auth/google/callback?code=c&state=${google.searchParams.get("state")}`,
      opts.sendNonce === false ? {} : { headers: { cookie: nonce } },
    );
    expect(callback.status).toBe(302);
    return new URL(callback.headers.get("location")!);
  }

  const exchange = (code: string) =>
    app.request("/auth/exchange", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  const v1 = (path: string, token: string, init: RequestInit = {}) =>
    app.request(`/v1${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } });

  it("reports whether Google sign-in is on", async () => {
    expect(await (await app.request("/auth/config")).json()).toEqual({ google: true });
    expect(await (await createApp(db).request("/auth/config")).json()).toEqual({ google: false });
  });

  it("refuses a callback from a browser that didn't start the sign-in", async () => {
    const back = await signIn({ sendNonce: false });
    expect(back.pathname).toBe("/login");
    expect(back.searchParams.get("error")).toMatch(/another browser/);
  });

  it("signs in, hands over one session, and ends it on logout", async () => {
    const back = await signIn();
    expect(`${back.origin}${back.pathname}`).toBe("https://app.example/auth/callback");
    const code = back.searchParams.get("code")!;

    const res = await exchange(code);
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect((await exchange(code)).status).toBe(400);

    const me = await (await v1("/me", token)).json();
    expect(me).toMatchObject({ user: { email, role: "owner" }, workspace: { name: "Api's workspace" } });

    // A session can mint keys; a key can be used for the API but can't mint more.
    const created = await v1("/api-keys", token, { method: "POST", body: JSON.stringify({ name: "cli" }) });
    expect(created.status).toBe(201);
    const { key } = (await created.json()) as { key: string };
    expect(await (await v1("/me", key)).json()).toMatchObject({ user: null, workspace: { name: "Api's workspace" } });
    expect((await v1("/api-keys", key, { method: "POST", body: JSON.stringify({ name: "more" }) })).status).toBe(403);
    expect((await v1("/api-keys", key)).status).toBe(200);

    await app.request("/auth/logout", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    expect((await v1("/me", token)).status).toBe(401);
  });
});
