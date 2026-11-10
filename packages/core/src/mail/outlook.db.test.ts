import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, workspaces, type Db } from "@meerko/db";
import { connectOutlook, createOAuthState } from "../mailboxes.ts";
import { SecretBox } from "../provider-keys.ts";
import { runReplyTick } from "../replies/replies.ts";
import { runSendTick } from "../sending/sender.ts";
import { createSequence, enrollRows, setSequenceStatus } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { fakeGraph } from "./fake-graph.ts";
import { MicrosoftOAuth } from "./outlook.ts";

// Dates in the future of the other db tests, so the reply scan here never watches their mailboxes.
const MON_1030 = new Date("2027-06-07T08:30:00Z");
const later = (m: number) => new Date(MON_1030.getTime() + m * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("Outlook mailboxes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: "outlook-test", approveSequenceEmails: false }).returning())[0]!.id;
  });
  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  it("refuses to connect a Microsoft account with no mailbox, and stores nothing", async () => {
    const g = fakeGraph({ unlicensed: true });
    const microsoft = new MicrosoftOAuth({ clientId: "c", clientSecret: "s", redirectUri: "https://api.x/oauth/microsoft/callback", fetch: g.fetch });
    await expect(connectOutlook(db, box, microsoft, createOAuthState(box, ws), "code", g.fetch)).rejects.toThrow(/no Outlook mailbox/);
    expect(await db.select().from(mailboxes).where(eq(mailboxes.workspaceId, ws))).toHaveLength(0);
  });

  for (const rewrite of [false, true]) {
    it(`connects with Microsoft, sends, keeps the newest token and stops on a reply${rewrite ? " (Exchange rewrote the Message-ID)" : ""}`, async () => {
      const g = fakeGraph({ rotate: true, rewriteMessageId: rewrite });
      const microsoft = new MicrosoftOAuth({ clientId: "c", clientSecret: "s", redirectUri: "https://api.x/oauth/microsoft/callback", fetch: g.fetch });
      const mb = await connectOutlook(db, box, microsoft, createOAuthState(box, ws), "code", g.fetch);
      expect(mb.email).toBe("ana@acme.com");
      const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, mb.id));
      expect(row).toMatchObject({ provider: "outlook", encryptedPassword: null });
      expect(box.decrypt(row!.encryptedRefreshToken!)).toBe("rt-1");

      const table = await createTable(db, ws, { name: "leads" });
      await insertRows(db, ws, table.id, [{ first_name: "Pia", email: "pia@slalom.example" }]);
      const seq = await createSequence(db, ws, { tableId: table.id, mailboxIds: [mb.id], name: "S", steps: [{ subject: "Quick question, {{first_name}}", body: "Hi" }, { body: "Bump", delayDays: 3 }] });
      await enrollRows(db, ws, seq.id, { now: MON_1030 });
      await setSequenceStatus(db, ws, seq.id, "active");

      expect(await runSendTick(db, { box, microsoft, fetch: g.fetch, publicUrl: "https://m.ai", now: () => MON_1030, random: () => 0 })).toMatchObject({ sent: 1 });
      const [out] = await db.select().from(messages).where(eq(messages.mailboxId, mb.id));
      const sentId = rewrite ? "<exch-0@outlook.com>" : out!.rfcMessageId!;
      expect(out).toMatchObject({ rfcMessageId: sentId, gmailId: sentId, gmailThreadId: sentId });
      const [en] = await db.select().from(enrollments).where(eq(enrollments.mailboxId, mb.id));
      expect(en!.messageIds).toEqual([sentId]);
      // Microsoft rotated the refresh token, and the mailbox kept the new one.
      const [after] = await db.select().from(mailboxes).where(eq(mailboxes.id, mb.id));
      expect(box.decrypt(after!.encryptedRefreshToken!)).toMatch(/^rt-new-/);

      g.deliver(`From: Pia <pia@slalom.example>\r\nSubject: Re: Quick question, Pia\r\nMessage-ID: <r1@slalom.example>\r\nIn-Reply-To: ${sentId}\r\n\r\nYes, Tuesday works.`, later(30));
      expect(await runReplyTick(db, { box, microsoft, fetch: g.fetch, now: () => later(31) })).toMatchObject({ replies: 1 });
      const [state] = await db.select().from(enrollments).where(eq(enrollments.id, en!.id));
      expect(state!.state).toBe("replied");
    });
  }
});
