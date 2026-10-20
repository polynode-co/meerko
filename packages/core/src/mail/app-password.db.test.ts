import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "../provider-keys.ts";
import { runReplyTick } from "../replies/replies.ts";
import { runSendTick } from "../sending/sender.ts";
import { createSequence, enrollRows, setSequenceStatus } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { fakeGmail } from "./fake-gmail-imap.ts";

// Months after the other db tests' dates, so the reply scan here never watches their mailboxes.
const MON_1030 = new Date("2027-06-07T08:30:00Z");
const later = (m: number) => new Date(MON_1030.getTime() + m * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("app-password mailboxes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;
  let mailboxId: string;

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: "app-password-test" }).returning())[0]!.id;
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

  it("marks the mailbox for reconnecting when Gmail rejects the app password, and leaves the lead due", async () => {
    const g = fakeGmail({ authFails: true });
    expect(await runSendTick(db, { box, imap: g.connectors, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 0 });
    const [mb] = await db.select().from(mailboxes).where(eq(mailboxes.id, mailboxId));
    expect(mb).toMatchObject({ status: "error", lastError: expect.stringContaining("app password") });
    const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mailboxId));
    expect(en!.state).toBe("active");
  });

  it("stores exactly one credential per mailbox", async () => {
    await expect(db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail_imap", email: "none@meerko.ai" })).rejects.toThrow();
    await expect(
      db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail", email: "both@meerko.ai", encryptedRefreshToken: "a", encryptedPassword: "b" }),
    ).rejects.toThrow();
  });
});
