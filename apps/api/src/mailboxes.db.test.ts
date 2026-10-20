import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiKey, GoogleOAuth, SecretBox, type ImapConnectors } from "@meerko/core";
import { createDb, eq, mailboxes, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("connecting mailboxes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const run = randomBytes(4).toString("hex");
  let ws: string;
  let key: string;

  // Gmail, faked: the one good app password signs in; anything else gets SMTP's 535.
  const GOOD = "abcdefghijklmnop";
  const logins: string[] = [];
  const imap: ImapConnectors = {
    sleep: async () => {},
    smtp: (auth) => ({
      verify: async () => {
        logins.push(auth.user);
        if (auth.pass !== GOOD) throw Object.assign(new Error("535 5.7.8 Username and Password not accepted"), { code: "EAUTH", responseCode: 535 });
        return true;
      },
      sendMail: async () => ({}),
      close: () => {},
    }),
    imap: () =>
      ({
        capabilities: new Map([["X-GM-EXT-1", true]]),
        on: () => {},
        connect: async () => {},
        logout: async () => {},
        list: async () => [{ path: "[Gmail]/All Mail", specialUse: "\\All" }],
        mailboxOpen: async () => ({}),
      }) as unknown as ReturnType<ImapConnectors["imap"]>,
  };
  const oauth = new GoogleOAuth({ clientId: "c", clientSecret: "s", redirectUri: "https://api.example/oauth/google/callback" });
  const app = createApp(db, { secretBox: box, imap, googleOAuth: oauth, appUrl: "https://app.example" });

  beforeAll(async () => {
    ws = (await db.insert(workspaces).values({ name: `mailboxes-${run}` }).returning())[0]!.id;
    key = (await createApiKey(db, ws, "full")).key;
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const v1 = (path: string, init: RequestInit = {}, a = app) =>
    a.request(`/v1${path}`, { ...init, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });
  const connect = (body: object, a = app) => v1("/mailboxes/gmail/app-password", { method: "POST", body: JSON.stringify(body) }, a);

  it("offers app passwords, and Google's consent page only when it's turned on", async () => {
    expect(await (await v1("/mailboxes/connect")).json()).toEqual({ oauth: false, url: "https://app.example/app/settings?connect=gmail" });
    const res = await v1("/mailboxes/gmail/connect", { method: "POST", body: "{}" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/app password/);

    const withOAuth = createApp(db, { secretBox: box, googleOAuth: oauth, gmailOAuthConnect: true });
    expect(await (await v1("/mailboxes/connect", {}, withOAuth)).json()).toEqual({ oauth: true, url: null });
    expect((await (await v1("/mailboxes/gmail/connect", { method: "POST", body: "{}" }, withOAuth)).json()).url).toMatch(/^https:\/\/accounts\.google\.com/);
  });

  it("checks the app password with Gmail, then stores it encrypted, signing in as the alias's account", async () => {
    const res = await connect({ email: "Iker@Meerko.ai", login: "iker@polynode.co", password: "abcd efgh ijkl mnop", display_name: "Iker" });
    expect(res.status).toBe(201);
    const { mailbox } = await res.json();
    expect(mailbox).toMatchObject({ provider: "gmail_imap", email: "iker@meerko.ai", login: "iker@polynode.co", displayName: "Iker", status: "active" });
    expect(logins.at(-1)).toBe("iker@polynode.co");

    const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailbox.id));
    expect(row!.encryptedPassword).not.toContain(GOOD);
    expect(box.decrypt(row!.encryptedPassword!)).toBe(GOOD);
    expect(row!.encryptedRefreshToken).toBeNull();
  });

  it("explains a refused password, and refuses an account password before asking Gmail", async () => {
    const before = logins.length;
    const plain = await connect({ email: "pia@meerko.ai", password: "my-Google-password1" });
    expect(plain.status).toBe(400);
    expect((await plain.json()).error).toMatch(/16 letters/);
    expect(logins.length).toBe(before);

    const wrong = await connect({ email: "pia@meerko.ai", password: "zzzzzzzzzzzzzzzz" });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error).toMatch(/didn't accept that app password for pia@meerko\.ai.*alias/);
    expect(await db.select().from(mailboxes).where(eq(mailboxes.email, "pia@meerko.ai"))).toHaveLength(0);
  });

  it("reconnects a Gmail API mailbox in place with an app password", async () => {
    const [old] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws, provider: "gmail", email: "ana@meerko.ai", encryptedRefreshToken: box.encrypt("rt"), status: "error", lastError: "revoked" })
      .returning();
    const { mailbox } = await (await connect({ email: "ana@meerko.ai", password: GOOD })).json();
    expect(mailbox).toMatchObject({ id: old!.id, provider: "gmail_imap", status: "active", lastError: null, login: null });
    const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, old!.id));
    expect(row!.encryptedRefreshToken).toBeNull();
  });

  it("limits attempts per workspace", async () => {
    const limited = createApp(db, { secretBox: box, imap });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await connect({ email: "x@meerko.ai", password: "zzzzzzzzzzzzzzzz" }, limited)).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
