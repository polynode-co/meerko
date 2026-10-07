import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, workspaces, type Db } from "@meerko/db";
import { GMAIL_SCOPES, GoogleOAuth } from "../mail/gmail.ts";
import { deleteMailbox, MailboxInUseError } from "../mailboxes.ts";
import { SecretBox } from "../provider-keys.ts";
import { createSequence, enrollRows, sequencePool, setSequenceStatus, SequenceError, updateSequence } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { runSendTick } from "./sender.ts";

const MON_1030_MADRID = new Date("2026-10-05T08:30:00Z");
const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const days = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 60 * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("mailbox rotation (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));

  /** Fake Gmail: records which mailbox (by refresh token) sent each message. */
  let sent: { from: string; threadId?: string }[];
  const fetch = (async (url: string, init: RequestInit) => {
    if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "a", scope: GMAIL_SCOPES.join(" "), expires_in: 3600 });
    const body = JSON.parse(String(init.body));
    const raw = Buffer.from(body.raw, "base64url").toString();
    sent.push({ from: /^From: .*<(.+)>/m.exec(raw)?.[1] ?? /^From: (.+)$/m.exec(raw)![1]!, threadId: body.threadId });
    return Response.json({ id: `g${sent.length}`, threadId: body.threadId ?? `thread-${sent.length}` });
  }) as typeof globalThis.fetch;
  const oauth = new GoogleOAuth({ clientId: "c", clientSecret: "s", redirectUri: "http://x/cb", fetch });
  const tick = (now: Date) => runSendTick(db, { box, oauth, publicUrl: "https://m.ai", fetch, now: () => now, random: () => 0 });

  let ws: string;
  let tableId: string;
  const mb: Record<string, string> = {};
  const steps = [{ subject: "Hi {{first_name}}", body: "Hello {{first_name}}" }, { body: "Bump", delayDays: 3 }];

  beforeEach(async () => {
    sent = [];
    ws = (await db.insert(workspaces).values({ name: "rotation-test" }).returning())[0]!.id;
    const add = async (email: string, extra: Partial<typeof mailboxes.$inferInsert> = {}) =>
      (await db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail", email, encryptedRefreshToken: box.encrypt(email), dailyLimit: 50, ...extra }).returning())[0]!.id;
    mb.ana = await add("ana@tryacme.com");
    mb.marc = await add("marc@tryacme.com");
    // Day 1 of its ramp: 10 a day instead of 50.
    mb.newbie = await add("newbie@getacme.io", { rampStartedAt: MON_1030_MADRID });
    mb.broken = await add("hello@acme-mail.com", { status: "error" });
    const table = await createTable(db, ws, { name: "leads" });
    tableId = table.id;
    await insertRows(db, ws, tableId, Array.from({ length: 22 }, (_, i) => ({ first_name: `Lead${i}`, email: `lead${i}@example.com` })));
  });

  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const pool = () => [mb.ana!, mb.marc!, mb.newbie!, mb.broken!];

  it("spreads new leads by free capacity, skipping mailboxes that can't send", async () => {
    const seq = await createSequence(db, ws, { tableId, mailboxIds: pool(), name: "Q4", steps });
    const res = await enrollRows(db, ws, seq.id, { now: MON_1030_MADRID });
    expect(res.enrolled).toBe(22);
    // 50 : 50 : 10 capacity, nothing on the broken mailbox.
    expect(res.byMailbox).toEqual({ [mb.ana!]: 10, [mb.marc!]: 10, [mb.newbie!]: 2 });

    const p = await sequencePool(db, ws, seq.id, MON_1030_MADRID);
    expect(p.capacityToday).toBe(110);
    expect(p.mailboxes.find((m) => m.id === mb.newbie)).toMatchObject({ effectiveLimit: 10, rampDay: 1, leads: 2 });
  });

  it("splits evenly when asked to", async () => {
    const seq = await createSequence(db, ws, { tableId, mailboxIds: pool(), name: "Q4", steps, assignment: "even" });
    const res = await enrollRows(db, ws, seq.id, { limit: 9, now: MON_1030_MADRID });
    expect(Object.values(res.byMailbox).sort()).toEqual([3, 3, 3]);
  });

  it("sends from every mailbox in the pool, and keeps each lead's follow-up on its mailbox", async () => {
    const seq = await createSequence(db, ws, { tableId, mailboxIds: [mb.ana!, mb.marc!], name: "Q4", steps });
    await enrollRows(db, ws, seq.id, { limit: 2, now: MON_1030_MADRID });
    await setSequenceStatus(db, ws, seq.id, "active");

    // One tick: one email from each mailbox.
    expect((await tick(MON_1030_MADRID)).sent).toBe(2);
    expect(sent.map((s) => s.from).sort()).toEqual(["ana@tryacme.com", "marc@tryacme.com"]);

    // Follow-ups, three days later: same mailbox, same thread.
    expect((await tick(days(MON_1030_MADRID, 3))).sent).toBe(2);
    const ens = await db.select().from(enrollments).where(eq(enrollments.sequenceId, seq.id));
    for (const en of ens) {
      const out = await db.select({ mailboxId: messages.mailboxId }).from(messages).where(eq(messages.enrollmentId, en.id));
      expect(out.map((o) => o.mailboxId)).toEqual([en.mailboxId, en.mailboxId]);
    }
  });

  it("holds a ramping mailbox to its lower limit", async () => {
    const seq = await createSequence(db, ws, { tableId, mailboxIds: [mb.newbie!], name: "Q4", steps });
    await enrollRows(db, ws, seq.id, { now: MON_1030_MADRID });
    await setSequenceStatus(db, ws, seq.id, "active");
    let total = 0;
    for (let i = 0; i < 15; i++) total += (await tick(minutes(MON_1030_MADRID, i * 8))).sent;
    expect(total).toBe(10);
    expect((await tick(minutes(MON_1030_MADRID, 130))).skippedMailboxes).toEqual([{ mailboxId: mb.newbie, reason: "daily_limit" }]);
  });

  it("moves unsent leads off a mailbox that leaves the pool, and stops ones mid-thread", async () => {
    const seq = await createSequence(db, ws, { tableId, mailboxIds: [mb.ana!, mb.marc!], name: "Q4", steps, assignment: "even" });
    await enrollRows(db, ws, seq.id, { limit: 4, now: MON_1030_MADRID });
    await setSequenceStatus(db, ws, seq.id, "active");
    await tick(MON_1030_MADRID); // one lead on each mailbox gets its first email

    await updateSequence(db, ws, seq.id, { mailboxIds: [mb.ana!] });
    const ens = await db.select().from(enrollments).where(eq(enrollments.sequenceId, seq.id));
    const fromMarc = sent.find((s) => s.from === "marc@tryacme.com")!;
    expect(fromMarc).toBeTruthy();
    expect(ens.filter((e) => e.state === "active").every((e) => e.mailboxId === mb.ana)).toBe(true);
    expect(ens.filter((e) => e.state === "stopped")).toHaveLength(1);
  });

  it("won't start without a working mailbox, or delete a sequence's only mailbox", async () => {
    const seq = await createSequence(db, ws, { tableId, mailboxIds: [mb.broken!], name: "Q4", steps });
    await expect(setSequenceStatus(db, ws, seq.id, "active")).rejects.toThrow(SequenceError);
    await expect(deleteMailbox(db, ws, mb.broken!)).rejects.toThrow(MailboxInUseError);

    // In a bigger pool it can go: the pool just shrinks.
    await updateSequence(db, ws, seq.id, { mailboxIds: [mb.broken!, mb.ana!] });
    expect(await deleteMailbox(db, ws, mb.broken!)).toBe(true);
    expect((await sequencePool(db, ws, seq.id)).mailboxes.map((m) => m.id)).toEqual([mb.ana]);
  });
});
