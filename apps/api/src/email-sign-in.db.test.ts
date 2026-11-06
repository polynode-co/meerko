import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inviteToWorkspace, type SystemMail } from "@meerko/core";
import { createDb, emailSignIns, eq, inArray, users, workspaces, type Db } from "@meerko/db";
import { createApp } from "./app.ts";

describe.skipIf(!process.env.DATABASE_URL)("sign-in links by email (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const addr = (who: string) => `${who}-${run}@email-link-test.example`;
  const sent: SystemMail[] = [];
  const mailer = { send: async (m: SystemMail) => void sent.push(m) };
  const open = createApp(db, { mailer, appUrl: "https://app.example", signup: "open" });
  const invite = createApp(db, { mailer, appUrl: "https://app.example", signup: "invite" });
  const emails = ["ana", "bo", "cy", "dee"].map(addr);

  afterAll(async () => {
    const rows = await db.select().from(users).where(inArray(users.email, emails));
    await db.delete(emailSignIns).where(inArray(emailSignIns.email, emails));
    await db.delete(workspaces).where(inArray(workspaces.name, ["ana-" + run + "'s workspace", "Invited " + run]));
    if (rows.length) await db.delete(users).where(inArray(users.id, rows.map((r) => r.id)));
  });

  const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const tokenFrom = (mail: SystemMail) => new URL(mail.text.match(/https:\S+/)![0]).searchParams.get("token")!;

  it("is off without a mailer", async () => {
    const app = createApp(db, { appUrl: "https://app.example" });
    expect((await (await app.request("/auth/config")).json()).email).toBe(false);
    expect((await post(app, "/auth/email/start", { email: addr("ana") })).status).toBe(404);
    expect((await (await open.request("/auth/config")).json()).email).toBe(true);
  });

  it("emails a one-time link that signs up a new person", async () => {
    const res = await post(open, "/auth/email/start", { email: ` ${addr("ana").toUpperCase()} `, source: { utm_source: "hn" } });
    expect(res.status).toBe(204);
    const mail = sent.at(-1)!;
    expect(mail.to).toBe(addr("ana"));
    expect(mail.text).toContain("https://app.example/login/email?token=ml_");

    const verified = await post(open, "/auth/email/verify", { token: tokenFrom(mail) });
    expect(verified.status).toBe(200);
    const { token } = (await verified.json()) as { token: string };
    const me = await open.request("/v1/me", { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    const [user] = await db.select().from(users).where(eq(users.email, addr("ana")));
    expect(user!.googleSub).toBeNull();

    // Used once.
    expect((await post(open, "/auth/email/verify", { token: tokenFrom(mail) })).status).toBe(400);
    expect((await post(open, "/auth/email/verify", { token: "ml_nope" })).status).toBe(400);
  });

  it("limits links per address", async () => {
    for (let i = 0; i < 3; i++) expect((await post(open, "/auth/email/start", { email: addr("bo") })).status).toBe(204);
    const limited = await post(open, "/auth/email/start", { email: addr("bo") });
    expect(limited.status).toBe(429);
  });

  it("only sends to invited addresses when signup is invite-only", async () => {
    const before = sent.length;
    const refused = await post(invite, "/auth/email/start", { email: addr("cy") });
    expect(refused.status).toBe(403);
    expect(sent.length).toBe(before);

    const [ws] = await db.insert(workspaces).values({ name: "Invited " + run }).returning();
    await inviteToWorkspace(db, ws!.id, addr("dee"));
    expect((await post(invite, "/auth/email/start", { email: addr("dee") })).status).toBe(204);
    const verified = await post(invite, "/auth/email/verify", { token: tokenFrom(sent.at(-1)!) });
    expect(verified.status).toBe(200);
  });

  it("rejects a bad address", async () => {
    expect((await post(open, "/auth/email/start", { email: "not-an-email" })).status).toBe(400);
  });
});
