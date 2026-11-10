import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, memberships, messages, users, workspaces, type Db } from "@meerko/db";
import { digestUnsubscribeToken, getDigest, runDigestTick, setDigest, unsubscribeDigest } from "./digest.ts";
import type { SystemMail } from "./mail/system-mail.ts";
import { SecretBox } from "./provider-keys.ts";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("daily digest (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const run = randomBytes(4).toString("hex");
  let ws: string;
  let owner: { id: string; email: string };
  let member: { id: string; email: string };
  let sent: SystemMail[];
  const mailer = { send: async (m: SystemMail) => void sent.push(m) };
  // The tick reads every workspace in the database, so look only at this test's people.
  const mine = () => sent.filter((m) => m.to === owner.email || m.to === member.email);
  const at = (iso: string) => () => new Date(iso);
  const tick = (now: string) => runDigestTick(db, { mailer, box, appUrl: "https://app.example", publicUrl: "https://api.example", now: at(now) });

  const person = async (role: "owner" | "member") => {
    const [u] = await db.insert(users).values({ email: `${role}-${randomBytes(4).toString("hex")}@acme.example` }).returning();
    await db.insert(memberships).values({ userId: u!.id, workspaceId: ws, role, createdAt: new Date("2026-11-01T00:00:00Z") });
    return { id: u!.id, email: u!.email };
  };
  const reply = (from: string, sentAt: string, extra: Partial<typeof messages.$inferInsert> = {}) =>
    db.insert(messages).values({ workspaceId: ws, direction: "in", fromEmail: from, toEmail: "me@acme.example", subject: "Re: hi", body: "Sounds good", sentAt: new Date(sentAt), ...extra });

  beforeEach(async () => {
    sent = [];
    ws = (await db.insert(workspaces).values({ name: `digest-${run}` }).returning())[0]!.id;
    owner = await person("owner");
    member = await person("member");
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, `digest-${run}`));
  });

  it("emails the owner once a morning, counting only people's replies nobody has handled", async () => {
    await reply("ana@lead.example", "2026-11-09T15:00:00Z", { intent: "interested" });
    await reply("bo@lead.example", "2026-11-09T16:00:00Z");
    await reply("ooo@lead.example", "2026-11-09T16:00:00Z", { intent: "out_of_office" });
    await reply("done@lead.example", "2026-11-09T16:00:00Z", { handledAt: new Date("2026-11-09T17:00:00Z") });

    await tick("2026-11-10T06:30:00Z"); // before the digest hour
    expect(mine()).toHaveLength(0);

    await tick("2026-11-10T07:05:00Z");
    expect(mine()).toHaveLength(1);
    const mail = mine()[0]!;
    expect(mail.to).toBe(owner.email);
    expect(mail.subject).toBe("2 replies waiting in Meerko");
    expect(mail.text).toContain("ana@lead.example: Re: hi (interested)");
    expect(mail.text).not.toContain("ooo@lead.example");
    expect(mail.text).toContain("https://app.example/app/inbox");
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    // Not again the same day, even with a new reply.
    await reply("cy@lead.example", "2026-11-10T09:00:00Z");
    await tick("2026-11-10T12:00:00Z");
    expect(mine()).toHaveLength(1);

    // The next morning it counts what's new since the last email, and still lists what's waiting.
    await tick("2026-11-11T07:00:00Z");
    expect(mine()).toHaveLength(2);
    expect(mine()[1]!.subject).toBe("3 replies waiting in Meerko");
    expect(mine()[1]!.text).toContain("1 of them new since the last email");
  });

  it("sends nothing when nothing new came in, and nothing to someone who turned it off", async () => {
    await reply("ana@lead.example", "2026-10-20T15:00:00Z"); // before the owner joined
    await tick("2026-11-10T07:00:00Z");
    expect(mine()).toHaveLength(0);

    await setDigest(db, owner.id, ws, false);
    await reply("bo@lead.example", "2026-11-09T16:00:00Z");
    await tick("2026-11-10T08:00:00Z");
    expect(mine()).toHaveLength(0);
    expect(await getDigest(db, owner.id, ws)).toMatchObject({ eligible: true, enabled: false });
    expect(await getDigest(db, member.id, ws)).toMatchObject({ eligible: false, enabled: false });
  });

  it("unsubscribes from a signed link only", async () => {
    const token = digestUnsubscribeToken(box, owner.id, ws);
    expect(await unsubscribeDigest(db, box, `${owner.id}.${ws}.forged`)).toBe(false);
    expect(await unsubscribeDigest(db, new SecretBox(randomBytes(32).toString("base64")), token)).toBe(false);
    expect((await getDigest(db, owner.id, ws))!.enabled).toBe(true);
    expect(await unsubscribeDigest(db, box, token)).toBe(true);
    expect((await getDigest(db, owner.id, ws))!.enabled).toBe(false);
  });

  it("records nothing when the mail server refuses, so the next pass tries again", async () => {
    await reply("ana@lead.example", "2026-11-09T15:00:00Z");
    const failing = { send: async () => Promise.reject(new Error("421 try later")) };
    const res = await runDigestTick(db, { mailer: failing, box, publicUrl: "https://api.example", now: at("2026-11-10T07:00:00Z") });
    expect(res.failed).toBeGreaterThan(0);
    expect((await getDigest(db, owner.id, ws))!.last_sent_at).toBeNull();
    await tick("2026-11-10T07:01:00Z");
    expect(mine()).toHaveLength(1);
  });
});
