import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "../provider-keys.ts";
import { runReplyTick } from "../replies/replies.ts";
import { runSendTick } from "../sending/sender.ts";
import { createSequence, enrollRows, setSequenceStatus } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { fakeGmail } from "./fake-gmail-imap.ts";
import type { ImapConnectors, ImapSession } from "./imap-common.ts";

// Months after the other db tests' dates, so the reply scan here never watches their mailboxes.
const MON_1030 = new Date("2027-06-07T08:30:00Z");
const later = (m: number) => new Date(MON_1030.getTime() + m * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("app-password mailboxes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;
  let mailboxId: string;

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: "app-password-test", approveSequenceEmails: false }).returning())[0]!.id;
    const [mb] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws, provider: "gmail_imap", email: "iker@meerko.ai", login: "iker@polynode.co", encryptedPassword: box.encrypt("abcdabcdabcdabcd") })
      .returning();
    mailboxId = mb!.id;
    const table = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, table.id, [{ first_name: "Pia", email: "pia@slalom.example" }]);
    const steps = [{ subject: "Quick question, {{first_name}}", body: "Hi {{first_name}}" }, { body: "Bump", delayDays: 3 }];
    const seq = await createSequence(db, ws, { tableId: table.id, mailboxIds: [mailboxId], name: "Agencies", steps });
    await enrollRows(db, ws, seq.id, { now: MON_1030 });
    await setSequenceStatus(db, ws, seq.id, "active");
  });

  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  it("sends over SMTP as the login account, fills in the thread later, and stops the sequence on a reply", async () => {
    const g = fakeGmail();
    // Gmail hasn't indexed the sent copy yet when the sender looks for it.
    g.state.indexing = false;
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 1 });
    expect(g.outbox[0]!.envelope).toEqual({ from: "iker@meerko.ai", to: ["pia@slalom.example"] });
    expect(g.auths.every((a) => a === "iker@polynode.co")).toBe(true);

    const [out] = await db.select().from(messages).where(eq(messages.mailboxId, mailboxId));
    expect(out).toMatchObject({ direction: "out", gmailId: null, gmailThreadId: null });
    const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mailboxId));
    expect(en!.gmailThreadId).toBeNull();

    // Pia answers in the thread.
    g.state.indexing = true;
    const sentCopy = g.all[0]!;
    g.store(
      `From: Pia <pia@slalom.example>\r\nSubject: Re: Quick question, Pia\r\nMessage-ID: <r1@slalom.example>\r\nIn-Reply-To: ${out!.rfcMessageId}\r\n\r\nYes, Tuesday works.\r\n\r\nOn Mon, Iker wrote:\r\n> Hi Pia`,
      sentCopy.threadId,
    );

    expect(await runReplyTick(db, { box, imap: g.connectors, now: () => later(31) })).toMatchObject({ replies: 1 });
    const threadHex = BigInt(sentCopy.threadId).toString(16);
    const [filled] = await db.select().from(messages).where(eq(messages.id, out!.id));
    expect(filled).toMatchObject({ gmailId: BigInt(sentCopy.emailId).toString(16), gmailThreadId: threadHex });
    const [after] = await db.select().from(enrollments).where(eq(enrollments.id, en!.id));
    expect(after).toMatchObject({ state: "replied", gmailThreadId: threadHex });
    const reply = (await db.select().from(messages).where(eq(messages.mailboxId, mailboxId))).find((m) => m.direction === "in");
    expect(reply).toMatchObject({ fromEmail: "pia@slalom.example", body: "Yes, Tuesday works.", gmailThreadId: threadHex });
  });

  it("stops looking for a sent copy that never turns up, and still records the lead's reply by its sender", async () => {
    const g = fakeGmail();
    // Gmail never finds the sent copy by its Message-ID.
    g.state.indexing = false;
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 1 });
    const lookups = () => g.searches.filter((q) => (q as { gmraw?: string }).gmraw?.startsWith("rfc822msgid:")).length;
    const atSend = lookups();

    // A tick a minute for the first hour, then one every half hour for a day.
    const ticks = [...Array.from({ length: 60 }, (_, i) => i + 1), ...Array.from({ length: 47 }, (_, i) => 90 + i * 30)];
    for (const m of ticks) {
      const scan = await runReplyTick(db, { box, imap: g.connectors, now: () => later(m) });
      expect(scan.timedOutMailboxes).toBeUndefined();
      expect(scan.slowest).toMatchObject({ stage: "done" });
    }
    // Looked for after 1, 2, 4 … 512 minutes, then never again.
    expect(lookups() - atSend).toBe(10);
    const [out] = await db.select().from(messages).where(eq(messages.mailboxId, mailboxId));
    expect(out).toMatchObject({ gmailThreadId: null, threadLookups: 10 });

    // Pia answers; the enrollment has no thread id, so her address is what matches it.
    g.store("From: Pia <pia@slalom.example>\r\nSubject: Re: Quick question, Pia\r\nMessage-ID: <r2@slalom.example>\r\n\r\nYes, Tuesday works.");
    expect(await runReplyTick(db, { box, imap: g.connectors, now: () => later(24 * 60 + 30) })).toMatchObject({ replies: 1 });
    expect(lookups() - atSend).toBe(10);
    const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mailboxId));
    expect(en!.state).toBe("replied");
  });

  it("looks for a few missing sent copies per tick, however many there are", async () => {
    const g = fakeGmail();
    g.state.indexing = false;
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 1 });
    const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mailboxId));
    await db.insert(messages).values(
      Array.from({ length: 20 }, (_, i) => ({
        workspaceId: ws,
        mailboxId,
        enrollmentId: en!.id,
        direction: "out" as const,
        rfcMessageId: `<lost-${i}@meerko.ai>`,
        fromEmail: "iker@meerko.ai",
        toEmail: "pia@slalom.example",
        body: "Hi",
        sentAt: MON_1030,
      })),
    );
    g.searches.length = 0;
    const scan = await runReplyTick(db, { box, imap: g.connectors, now: () => later(31) });
    expect(scan.slowest).toMatchObject({ stage: "done" });
    expect(g.searches.filter((q) => (q as { gmraw?: string }).gmraw?.startsWith("rfc822msgid:"))).toHaveLength(5);
  });

  it("marks the mailbox for reconnecting when Gmail rejects the app password, and leaves the lead due", async () => {
    const g = fakeGmail({ authFails: true });
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 0 });
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId));
    expect(mb).toMatchObject({ status: "error", lastError: expect.stringContaining("app password") });
    const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mailboxId));
    expect(en!.state).toBe("active");
  });

  it("leaves sending and the reply scan for the next tick once the tick's budget is spent", async () => {
    const g = fakeGmail();
    const spent = await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0, stop: () => true });
    expect(spent.sent).toBe(0);
    expect(spent.unreachedMailboxes).toBeGreaterThanOrEqual(1);
    expect(g.outbox).toHaveLength(0);
    const scan = await runReplyTick(db, { box, imap: g.connectors, now: () => later(31), stop: () => true });
    expect(scan.scanned).toBe(0);
    expect(scan.unscannedMailboxes).toBeGreaterThanOrEqual(1);
    // The next tick, with time left, does both.
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0, stop: () => false })).toMatchObject({ sent: 1 });
    expect((await runReplyTick(db, { box, imap: g.connectors, now: () => later(31), stop: () => false })).unscannedMailboxes).toBeUndefined();
  });

  it("drops a mailbox whose server stops answering, scans the others, and retries it on the next tick", async () => {
    const g = fakeGmail();
    // While `hang` is on, the second mailbox's IMAP server stops answering: its commands, and a sign-out, wait until
    // the connection is dropped.
    let hang = false;
    const dropped: string[] = [];
    const connectors: ImapConnectors = {
      ...g.connectors,
      imap: (auth, server) => {
        const session = g.connectors.imap(auth, server);
        if (auth.user !== "olga@polynode.co") return session;
        const waiting: (() => void)[] = [];
        const stuck =
          <A extends unknown[], T>(fn: (...args: A) => Promise<T>) =>
          (...args: A) =>
            hang ? new Promise<T>((_, reject) => waiting.push(() => reject(new Error("Connection closed")))) : fn(...args);
        return {
          ...session,
          noop: stuck(session.noop),
          search: stuck(session.search),
          logout: stuck(session.logout),
          close: () => {
            dropped.push(auth.user);
            for (const fail of waiting.splice(0)) fail();
          },
        } as ImapSession;
      },
    };
    const [other] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws, provider: "gmail_imap", email: "olga@meerko.ai", login: "olga@polynode.co", encryptedPassword: box.encrypt("abcdabcdabcdabcd") })
      .returning();
    const table = await createTable(db, ws, { name: "more leads" });
    await insertRows(db, ws, table.id, [{ first_name: "Noa", email: "noa@webon.example" }]);
    const seq = await createSequence(db, ws, { tableId: table.id, mailboxIds: [other!.id], name: "More", steps: [{ subject: "Hi {{first_name}}", body: "Hi" }] });
    await enrollRows(db, ws, seq.id, { now: MON_1030 });
    await setSequenceStatus(db, ws, seq.id, "active");
    expect(await runSendTick(db, { box, imap: connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 2 });

    // Pia answers the first mailbox's email.
    const [out] = await db.select().from(messages).where(eq(messages.mailboxId, mailboxId));
    const sentCopy = g.all.find((m) => m.messageId === out!.rfcMessageId)!;
    g.store(
      `From: Pia <pia@slalom.example>\r\nSubject: Re: Quick question, Pia\r\nMessage-ID: <r2@slalom.example>\r\nIn-Reply-To: ${out!.rfcMessageId}\r\n\r\nSure.`,
      sentCopy.threadId,
    );

    hang = true;
    const began = Date.now();
    const scan = await runReplyTick(db, { box, imap: connectors, now: () => later(31), mailboxTimeoutMs: 200 });
    expect(Date.now() - began).toBeLessThan(5_000);
    expect(scan).toMatchObject({ replies: 1, timedOutMailboxes: [other!.id], slowest: { mailboxId: other!.id } });
    expect(scan.slowest!.ms).toBeGreaterThanOrEqual(200);
    expect(dropped).toEqual(["olga@polynode.co"]);
    const checked = async (id: string) => (await db.select().from(mailboxes).where(eq(mailboxes.id, id)))[0]!;
    expect(await checked(other!.id)).toMatchObject({ status: "active", lastError: null, repliesCheckedAt: null });
    expect((await checked(mailboxId)).repliesCheckedAt).toEqual(later(31));

    // The server answers again: the next tick scans the mailbox.
    hang = false;
    const next = await runReplyTick(db, { box, imap: connectors, now: () => later(32) });
    expect(next.timedOutMailboxes).toBeUndefined();
    expect((await checked(other!.id)).repliesCheckedAt).toEqual(later(32));
  });

  it("finds a lead writing in a new thread among lots of unrelated mail, without fetching each one's headers on every tick", async () => {
    const g = fakeGmail();
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 1 });
    g.fetchOnes.length = 0;
    for (let i = 0; i < 300; i++) g.store(`From: News ${i} <news${i}@lists.example>\r\nSubject: Issue ${i}\r\nMessage-ID: <n${i}@lists.example>\r\n\r\nNews`);
    // Pia writes in fresh, not in the thread of the email she got.
    g.store("From: Pia <Pia@slalom.example>\r\nSubject: Another thing\r\nMessage-ID: <fresh@slalom.example>\r\n\r\nCan we talk on Friday?");

    const first = await runReplyTick(db, { box, imap: g.connectors, now: () => later(31) });
    expect(first).toMatchObject({ scanned: 301, replies: 1 });
    expect(first.slowest).toMatchObject({ mailboxId, stage: "done", listed: 301, fresh: 301, senderLookups: 0, recorded: 1 });
    // Only Pia's email was fetched on its own, in full; the senders came with the listing.
    expect(g.fetchOnes).toEqual(["source"]);
    const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mailboxId));
    expect(en!.state).toBe("replied");

    // The next tick lists the same unrelated mail again, still without a fetch per message.
    const second = await runReplyTick(db, { box, imap: g.connectors, now: () => later(32) });
    expect(second).toMatchObject({ replies: 0, slowest: { listed: 301, fresh: 300, senderLookups: 0, recorded: 0 } });
    expect(g.fetchOnes).toEqual(["source"]);
    const stored = await db.select().from(messages).where(eq(messages.mailboxId, mailboxId));
    expect(stored.filter((m) => m.direction === "in").map((m) => m.fromEmail)).toEqual(["pia@slalom.example"]);
  });

  it("stores exactly one credential per mailbox", async () => {
    await expect(db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail_imap", email: "none@meerko.ai" })).rejects.toThrow();
    await expect(
      db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail", email: "both@meerko.ai", encryptedRefreshToken: "a", encryptedPassword: "b" }),
    ).rejects.toThrow();
  });
});
