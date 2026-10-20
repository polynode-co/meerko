import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, suppressions, workspaces, type Db } from "@meerko/db";
import { connectImapMailbox, MailboxConnectError } from "../mailboxes.ts";
import { SecretBox } from "../provider-keys.ts";
import { runReplyTick } from "../replies/replies.ts";
import { runSendTick } from "../sending/sender.ts";
import { createSequence, enrollRows, setSequenceStatus } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { fakeImap } from "./fake-imap.ts";

// Months after the other db tests' dates, so the reply scan here never watches their mailboxes.
const MON_1030 = new Date("2027-06-07T08:30:00Z");
const later = (m: number) => new Date(MON_1030.getTime() + m * 60_000);
const servers = { imap: { host: "imap.fastmail.com", port: 993 }, smtp: { host: "smtp.fastmail.com", port: 465 } };

describe.skipIf(!process.env.DATABASE_URL)("IMAP mailboxes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: "imap-test" }).returning())[0]!.id;
  });
  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  async function sequenceFor(mailboxId: string, people: { first_name: string; email: string }[]) {
    const table = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, table.id, people);
    const steps = [{ subject: "Quick question, {{first_name}}", body: "Hi {{first_name}}" }, { body: "Bump", delayDays: 3 }];
    const seq = await createSequence(db, ws, { tableId: table.id, mailboxIds: [mailboxId], name: "Agencies", steps });
    await enrollRows(db, ws, seq.id, { now: MON_1030 });
    await setSequenceStatus(db, ws, seq.id, "active");
  }

  it("connects after signing in to both servers, then sends and stops on replies and bounces", async () => {
    const f = fakeImap();
    const mb = await connectImapMailbox(db, box, ws, { email: "Ana@Acme.eu", password: "app-pass", servers }, { imap: f.connectors });
    expect(mb).toMatchObject({ provider: "imap", email: "ana@acme.eu", login: null, servers, status: "active" });
    const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, mb.id));
    expect(box.decrypt(row!.encryptedPassword!)).toBe("app-pass");

    await sequenceFor(mb.id, [
      { first_name: "Pia", email: "pia@slalom.example" },
      { first_name: "Bo", email: "bo@gone.example" },
    ]);
    const deps = { box, imap: f.connectors, publicUrl: "https://m.ai", random: () => 0 };
    for (let i = 0; i < 2; i++) await runSendTick(db, { ...deps, now: () => later(i * 8) });
    expect(f.outbox).toHaveLength(2);
    // The provider didn't file them, so Meerko did.
    expect(f.folders.Sent).toHaveLength(2);

    const out = await db.select().from(messages).where(eq(messages.mailboxId, mb.id));
    const toPia = out.find((m) => m.toEmail === "pia@slalom.example")!;
    const toBo = out.find((m) => m.toEmail === "bo@gone.example")!;
    expect(toPia).toMatchObject({ gmailId: toPia.rfcMessageId, gmailThreadId: toPia.rfcMessageId });

    // Pia answers from a client that only sets In-Reply-To; Bo's address bounces.
    f.deliver(`From: Pia <pia@slalom.example>\r\nSubject: Re: Quick question, Pia\r\nMessage-ID: <r1@slalom.example>\r\nIn-Reply-To: ${toPia.rfcMessageId}\r\n\r\nYes, Tuesday works.\r\n\r\nOn Mon, Ana wrote:\r\n> Hi Pia`, later(30));
    f.deliver(
      `From: MAILER-DAEMON@mx.example\r\nSubject: Undelivered Mail Returned to Sender\r\nMessage-ID: <b1@mx.example>\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="b"\r\n\r\n--b\r\nContent-Type: text/rfc822-headers\r\n\r\nMessage-ID: ${toBo.rfcMessageId}\r\n--b--`,
      later(31),
    );
    expect(await runReplyTick(db, { box, imap: f.connectors, now: () => later(40) })).toMatchObject({ replies: 1, bounces: 1 });
    const states = Object.fromEntries((await db.select().from(enrollments).where(eq(enrollments.mailboxId, mb.id))).map((e) => [e.email, e.state]));
    expect(states).toEqual({ "pia@slalom.example": "replied", "bo@gone.example": "bounced" });
    const reply = (await db.select().from(messages).where(eq(messages.mailboxId, mb.id))).find((m) => m.direction === "in" && !m.intent);
    expect(reply).toMatchObject({ fromEmail: "pia@slalom.example", body: "Yes, Tuesday works.", gmailThreadId: toPia.rfcMessageId });
    expect(await db.select().from(suppressions).where(eq(suppressions.workspaceId, ws))).toMatchObject([{ email: "bo@gone.example", reason: "bounced" }]);

    // Scanning again stores nothing twice.
    expect(await runReplyTick(db, { box, imap: f.connectors, now: () => later(41) })).toMatchObject({ replies: 0, bounces: 0 });
  });

  it("explains a refused password or a server it won't connect to, and stores nothing", async () => {
    await expect(connectImapMailbox(db, box, ws, { email: "ana@acme.eu", password: "x", servers }, { imap: fakeImap({ authFails: true }).connectors })).rejects.toThrow(
      MailboxConnectError,
    );
    await expect(
      connectImapMailbox(db, box, ws, { email: "ana@acme.eu", password: "x", servers }, { imap: fakeImap({ address: "127.0.0.1" }).connectors }),
    ).rejects.toThrow(/public internet address/);
    await expect(
      connectImapMailbox(db, box, ws, { email: "ana@acme.eu", password: "x", servers: { ...servers, smtp: { host: "smtp.fastmail.com", port: 25 } } }, { imap: fakeImap().connectors }),
    ).rejects.toThrow(/use 465 or 587/);
    expect(await db.select().from(mailboxes).where(eq(mailboxes.workspaceId, ws))).toHaveLength(0);
  });
});
