import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, tableRows, workspaces, type Db } from "@meerko/db";
import { GMAIL_SCOPES, GoogleOAuth } from "../mail/gmail.ts";
import { SecretBox } from "../provider-keys.ts";
import { createSequence, enrollRows, previewSequence, sequenceStats, setSequenceStatus, SequenceError } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { createUnsubscribeToken, readUnsubscribeToken, runSendTick, unsubscribe } from "./sender.ts";

const MON_1030_MADRID = new Date("2026-10-05T08:30:00Z");
const SAT_NOON_MADRID = new Date("2026-10-10T10:00:00Z");
const minutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const days = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 60 * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("sequence sender (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));

  /** Fake Google: OAuth refresh plus Gmail send, recording each raw message. */
  let sent: { raw: string; threadId?: string }[];
  let revoked: boolean;
  const fetch = (async (url: string, init: RequestInit) => {
    if (url.includes("oauth2.googleapis.com")) {
      if (revoked) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ access_token: "a", scope: GMAIL_SCOPES.join(" "), expires_in: 3600 });
    }
    const body = JSON.parse(String(init.body));
    sent.push({ raw: Buffer.from(body.raw, "base64url").toString(), threadId: body.threadId });
    return Response.json({ id: `g${sent.length}`, threadId: body.threadId ?? `thread-${sent.length}` });
  }) as typeof globalThis.fetch;
  const oauth = new GoogleOAuth({ clientId: "c", clientSecret: "s", redirectUri: "http://x/cb", fetch });
  const tick = (now: Date) => runSendTick(db, { box, oauth, publicUrl: "https://app.meerko.ai", fetch, now: () => now, random: () => 0 });

  let ws: string;
  let mailboxId: string;
  let seqId: string;

  beforeEach(async () => {
    sent = [];
    revoked = false;
    ws = (await db.insert(workspaces).values({ name: "sender-test" }).returning())[0]!.id;
    const [mb] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws, provider: "gmail", email: "iker@meerko.ai", displayName: "Iker", encryptedRefreshToken: box.encrypt("rt"), dailyLimit: 3 })
      .returning();
    mailboxId = mb!.id;
    const table = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, table.id, [
      { first_name: "Pia", company: "Slalom", email: "pia@slalom.example", email_verification: "ultra_sure" },
      { first_name: "Paula", company: "Webon", email: "PAULA@webon.example" },
      { first_name: "", company: "NoName", email: "x@noname.com" },
      { first_name: "Bad", company: "Bounce", email: "bad@bounce.com", email_verification: "undeliverable" },
      { first_name: "Nomail", company: "Nomail" },
    ]);
    seqId = (
      await createSequence(db, ws, {
        tableId: table.id,
        mailboxId,
        name: "Agencies",
        steps: [
          { subject: "Quick question, {{first_name}}", body: "Hi {{first_name}}, how does {{company}} handle social?" },
          { body: "Following up, {{first_name}}.", delayDays: 3 },
        ],
      })
    ).id;
  });

  // The sender works across all workspaces, so each test must leave nothing due behind.
  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "sender-test"));
  });

  it("enrolls only rows that are safe to email", async () => {
    const res = await enrollRows(db, ws, seqId, { now: MON_1030_MADRID });
    expect(res).toEqual({ enrolled: 2, skipped: { no_email: 1, undeliverable: 1, suppressed: 0, missing_vars: 1, already_enrolled: 0 } });
    expect((await enrollRows(db, ws, seqId, { now: MON_1030_MADRID })).skipped.already_enrolled).toBe(2);

    const preview = await previewSequence(db, ws, seqId);
    expect(preview.steps.map((s) => s.subject)).toEqual(["Quick question, Pia", "Re: Quick question, Pia"]);
    expect(preview.missingVars).toEqual([]);
  });

  it("sends nothing until started, then one email per mailbox per tick, spaced out", async () => {
    await enrollRows(db, ws, seqId, { now: MON_1030_MADRID });
    expect((await tick(MON_1030_MADRID)).sent).toBe(0);

    await setSequenceStatus(db, ws, seqId, "active");
    expect((await tick(MON_1030_MADRID)).sent).toBe(1);
    expect((await tick(minutes(MON_1030_MADRID, 1))).skippedMailboxes).toEqual([{ mailboxId, reason: "spacing" }]);
    expect((await tick(minutes(MON_1030_MADRID, 5))).sent).toBe(1);

    const first = sent[0]!.raw;
    expect(first).toContain("To: pia@slalom.example");
    expect(first).toContain("Subject: Quick question, Pia");
    expect(first).toMatch(/List-Unsubscribe: <https:\/\/app\.meerko\.ai\/u\/[\w-]+>/);
    expect(first).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(sent[1]!.raw).toContain("To: paula@webon.example");
  });

  it("threads the follow-up as a reply after its delay, then completes", async () => {
    await enrollRows(db, ws, seqId, { filter: { first_name: "Pia" }, now: MON_1030_MADRID });
    await setSequenceStatus(db, ws, seqId, "active");
    await tick(MON_1030_MADRID);
    expect((await tick(days(MON_1030_MADRID, 2))).sent).toBe(0); // not due yet

    expect((await tick(days(MON_1030_MADRID, 3))).sent).toBe(1); // Thursday 10:30
    const firstId = sent[0]!.raw.match(/Message-ID: (<[^>]+>)/)![1];
    expect(sent[1]!.threadId).toBe("thread-1");
    expect(sent[1]!.raw).toContain("Subject: Re: Quick question, Pia");
    expect(sent[1]!.raw).toContain(`In-Reply-To: ${firstId}`);

    expect(await sequenceStats(db, ws, seqId)).toMatchObject({ enrolled: 1, emailsSent: 2, states: { completed: 1 } });
    const [pia] = await db.select().from(tableRows).where(eq(tableRows.id, (await db.select().from(enrollments).where(eq(enrollments.sequenceId, seqId)))[0]!.rowId));
    expect(pia!.stage).toBe("contacted");
  });

  it("waits for the send window and respects the daily limit", async () => {
    await enrollRows(db, ws, seqId, { now: MON_1030_MADRID });
    await setSequenceStatus(db, ws, seqId, "active");
    expect(await tick(SAT_NOON_MADRID)).toMatchObject({ sent: 0, deferred: 2 });
    // Both move to Monday 09:00-09:30 Madrid, each at its own random time.
    for (const en of await db.select().from(enrollments).where(eq(enrollments.sequenceId, seqId))) {
      const t = en.nextSendAt!.getTime();
      expect(t).toBeGreaterThanOrEqual(Date.parse("2026-10-12T07:00:00Z"));
      expect(t).toBeLessThan(Date.parse("2026-10-12T07:30:00Z"));
    }

    await db.update(mailboxes).set({ dailyLimit: 1 }).where(eq(mailboxes.id, mailboxId));
    await db.insert(messages).values({ workspaceId: ws, mailboxId, direction: "out", fromEmail: "iker@meerko.ai", toEmail: "z@z.com", body: "", sentAt: minutes(MON_1030_MADRID, -60) });
    await db.update(enrollments).set({ nextSendAt: MON_1030_MADRID }).where(eq(enrollments.sequenceId, seqId));
    expect((await tick(MON_1030_MADRID)).skippedMailboxes).toEqual([{ mailboxId, reason: "daily_limit" }]);
  });

  it("stops on unsubscribe and pauses the mailbox when Google revokes access", async () => {
    await enrollRows(db, ws, seqId, { now: MON_1030_MADRID });
    await setSequenceStatus(db, ws, seqId, "active");

    const token = createUnsubscribeToken(box, ws, "pia@slalom.example");
    expect(readUnsubscribeToken(box, token)).toEqual({ workspaceId: ws, email: "pia@slalom.example" });
    expect(readUnsubscribeToken(box, token.slice(0, -3) + "abc")).toBeNull();
    await unsubscribe(db, ws, "Pia@slalom.example");

    revoked = true;
    expect((await tick(MON_1030_MADRID)).skippedMailboxes).toEqual([{ mailboxId, reason: "error" }]);
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId));
    expect(mb!.status).toBe("error");
    await expect(setSequenceStatus(db, ws, seqId, "active")).rejects.toBeInstanceOf(SequenceError);

    // Paula is still due and goes out once access is restored; Pia never does.
    revoked = false;
    await db.update(mailboxes).set({ status: "active", lastError: null }).where(eq(mailboxes.id, mailboxId));
    expect((await tick(MON_1030_MADRID)).sent).toBe(1);
    expect(sent.map((s) => s.raw.match(/To: (.+)/)![1])).toEqual(["paula@webon.example"]);
    expect((await sequenceStats(db, ws, seqId)).states).toMatchObject({ unsubscribed: 1 });
  });
});
