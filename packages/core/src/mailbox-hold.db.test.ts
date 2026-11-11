import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, mailboxes, mailboxRejections, memberships, messages, users, workspaces, type Db } from "@meerko/db";
import type { SystemMail } from "./mail/system-mail.ts";
import { isPolicyRejection, MAILBOX_HOLD, recordRejection, resumeMailbox, runMailboxHoldTick } from "./sending/mailbox-hold.ts";
import { assignMailboxes } from "./sequences.ts";
import { digestMail } from "./digest.ts";

describe("isPolicyRejection", () => {
  it("knows a spam or blocklist refusal from a bad address", () => {
    expect(isPolicyRejection("550 5.7.1 Message rejected as spam")).toBe(true);
    expect(isPolicyRejection("554 5.7.350 Remote server returned message detected as spam")).toBe(true);
    expect(isPolicyRejection("554 Service unavailable; Client host blocked using zen.spamhaus.org")).toBe(true);
    expect(isPolicyRejection("550 5.1.1 The email account that you tried to reach does not exist")).toBe(false);
    expect(isPolicyRejection("421 4.7.0 Try again later")).toBe(false);
  });
});

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("mailbox auto-hold (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const ownerEmail = `owner-${run}@acme.example`;
  let ws: string;
  let userId: string;
  let sent: SystemMail[];
  const created: string[] = [];
  const mailer = { send: async (m: SystemMail) => void sent.push(m) };
  const mine = () => sent.filter((m) => m.to === ownerEmail);
  const now = new Date("2026-11-11T12:00:00Z");
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  const tick = (at = now) => runMailboxHoldTick(db, { mailer, appUrl: "https://app.example", now: () => at });

  const mailbox = async (name: string) =>
    (await db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail_imap", email: `${name}-${run}@acme.example`, encryptedPassword: "x" }).returning())[0]!.id;
  const sends = (mailboxId: string, n: number, at = ago(48)) =>
    db.insert(messages).values(Array.from({ length: n }, (_, i) => ({ workspaceId: ws, mailboxId, direction: "out" as const, fromEmail: "me@acme.example", toEmail: `p${i}@x.example`, body: "hi", sentAt: at })));
  const bounces = (mailboxId: string, n: number, at = ago(24)) =>
    db.insert(messages).values(Array.from({ length: n }, () => ({ workspaceId: ws, mailboxId, direction: "in" as const, intent: "bounce", fromEmail: "mailer-daemon@x.example", toEmail: "me@acme.example", body: "undeliverable", sentAt: at })));
  const get = async (id: string) => (await db.select().from(mailboxes).where(eq(mailboxes.id, id)))[0]!;

  beforeEach(async () => {
    sent = [];
    ws = (await db.insert(workspaces).values({ name: `hold-${run}` }).returning())[0]!.id;
    created.push(ws);
    userId ??= (await db.insert(users).values({ email: ownerEmail }).returning())[0]!.id;
    await db.insert(memberships).values({ userId, workspaceId: ws, role: "owner" });
  });
  afterAll(async () => {
    for (const id of created) await db.delete(workspaces).where(eq(workspaces.id, id));
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("holds a mailbox at 5 hard bounces and 5% of its sends in 7 days, and tells the owner once", async () => {
    const bad = await mailbox("bad");
    const fine = await mailbox("fine");
    await sends(bad, 80);
    await sends(fine, 80);
    await bounces(bad, 4);
    await bounces(fine, 1);
    await tick();
    expect((await get(bad)).heldAt).toBeNull();

    await bounces(bad, 2);
    await tick();
    const held = await get(bad);
    expect(held.heldAt?.toISOString()).toBe(now.toISOString());
    expect(held.holdReason).toBe("bounces");
    expect(held.holdDetail).toBe("6 hard bounces in 80 emails over 7 days (7.5%)");
    expect((await get(fine)).heldAt).toBeNull();
    expect(mine()).toHaveLength(1);
    expect(mine()[0]!.subject).toContain("bad-");
    expect(mine()[0]!.text).toContain("https://app.example/app/settings");

    await tick(new Date(now.getTime() + 60_000));
    expect(mine()).toHaveLength(1);
  });

  it("doesn't hold a busy mailbox whose bounces stay under 5%", async () => {
    const busy = await mailbox("busy");
    await sends(busy, 200);
    await bounces(busy, 5);
    await tick();
    expect((await get(busy)).heldAt).toBeNull();
  });

  it("ignores bounces older than 7 days", async () => {
    const old = await mailbox("old");
    await sends(old, 20, ago(24 * 10));
    await bounces(old, 6, ago(24 * 8));
    await tick();
    expect((await get(old)).heldAt).toBeNull();
  });

  it(`holds after ${MAILBOX_HOLD.rejections} spam or blocklist rejections in 24 hours`, async () => {
    const rejected = await mailbox("rejected");
    await recordRejection(db, rejected, "550 5.7.1 rejected as spam", ago(30));
    await recordRejection(db, rejected, "550 5.7.1 rejected as spam", ago(2));
    await recordRejection(db, rejected, "550 5.7.1 rejected as spam", ago(1));
    await tick();
    expect((await get(rejected)).heldAt).toBeNull();
    await recordRejection(db, rejected, "554 5.7.1 blocked", ago(0.5));
    await tick();
    const held = await get(rejected);
    expect(held.holdReason).toBe("rejections");
    expect(held.holdDetail).toBe("3 emails refused as spam or for a blocklist in the last 24 hours");
  });

  it("stays held until a person resumes it, then counts only what comes after", async () => {
    const bad = await mailbox("resume");
    await sends(bad, 40);
    await bounces(bad, 5);
    await tick();
    expect((await get(bad)).heldAt).not.toBeNull();

    await tick(new Date(now.getTime() + 3 * 24 * 3_600_000));
    expect((await get(bad)).heldAt).not.toBeNull();

    await resumeMailbox(db, ws, bad, now);
    await tick(new Date(now.getTime() + 60_000));
    const resumed = await get(bad);
    expect(resumed.heldAt).toBeNull();
    expect(resumed.holdCountsFrom?.toISOString()).toBe(now.toISOString());
  });

  it("keeps new leads off a held mailbox while the rest of the pool sends", async () => {
    const held = await mailbox("pool-held");
    const ok = await mailbox("pool-ok");
    await db.update(mailboxes).set({ heldAt: now, holdReason: "bounces", holdDetail: "x" }).where(eq(mailboxes.id, held));
    const picks = await assignMailboxes(db, { id: crypto.randomUUID(), assignment: "even", mailboxIds: [held, ok] }, 4, now);
    expect(new Set(picks)).toEqual(new Set([ok]));
    await expect(assignMailboxes(db, { id: crypto.randomUUID(), assignment: "even", mailboxIds: [held] }, 1, now)).rejects.toThrow(/resume one/);
  });

  it("deletes a mailbox's rejections with it", async () => {
    const gone = await mailbox("gone");
    await recordRejection(db, gone, "550 5.7.1 spam", now);
    await db.delete(mailboxes).where(eq(mailboxes.id, gone));
    expect(await db.select().from(mailboxRejections).where(eq(mailboxRejections.mailboxId, gone))).toHaveLength(0);
  });
});

describe("digest", () => {
  it("lists paused mailboxes", () => {
    const mail = digestMail({
      to: "o@acme.example",
      workspaceName: "Acme",
      waiting: 1,
      newCount: 1,
      replies: [{ from: "pat@x.example", subject: "Re: hi", intent: null, sentAt: new Date() }],
      held: [{ email: "sales@acme.example", detail: "6 hard bounces in 80 emails over 7 days (7.5%)" }],
      unsubscribeUrl: "https://api.example/u",
    });
    expect(mail.text).toContain("sales@acme.example is paused: 6 hard bounces in 80 emails over 7 days (7.5%)");
    expect(mail.html).toContain("sales@acme.example is paused");
  });
});
