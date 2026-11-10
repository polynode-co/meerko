import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, dataTables, enrollments, eq, mailboxes, messages, suppressions, tableRows, workspaces, type Db } from "@meerko/db";
import { GMAIL_SCOPES, GoogleOAuth, type GmailMessage } from "../mail/gmail.ts";
import { SecretBox } from "../provider-keys.ts";
import { runSendTick } from "../sending/sender.ts";
import { createSequence, enrollRows, sequenceStats, setSequenceStatus } from "../sequences.ts";
import { createTable, insertRows } from "../tables.ts";
import { approveDraft, discardDraft, draftReply, listDrafts } from "./drafts.ts";
import { classifyReply, listReplies, ReplyError, runReplyTick } from "./replies.ts";
import { unsubscribe } from "../sending/sender.ts";

const MON_1030 = new Date("2026-10-05T08:30:00Z");
const later = (m: number) => new Date(MON_1030.getTime() + m * 60_000);

describe.skipIf(!process.env.DATABASE_URL)("reply detection (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));

  /** A fake Gmail account: sending creates threads; `deliver` drops mail into the inbox. */
  let inbox: GmailMessage[];
  let fullFetches: string[];
  let queries: string[];
  let threadOf: Record<string, string>;
  let sends: { raw: string; threadId?: string }[];
  const deliver = (m: { from: string; thread: string; subject?: string; text: string; headers?: Record<string, string> }) => {
    const headers = { From: m.from, Subject: m.subject ?? "Re: Quick question, Pia", ...m.headers };
    inbox.push({
      id: `in-${inbox.length + 1}`,
      threadId: m.thread,
      internalDate: String(later(30).getTime()),
      payload: {
        mimeType: "text/plain",
        headers: Object.entries({ "Message-ID": `<reply-${inbox.length + 1}@slalom.example>`, ...headers }).map(([name, value]) => ({ name, value })),
        body: { data: Buffer.from(m.text).toString("base64url") },
      },
    });
  };
  const fetch = (async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2.googleapis.com")) return Response.json({ access_token: "a", scope: GMAIL_SCOPES.join(" "), expires_in: 3600 });
    const u = new URL(url);
    if (u.pathname.endsWith("/messages/send")) {
      const payload = JSON.parse(String(init!.body));
      const raw = Buffer.from(payload.raw, "base64url").toString();
      sends.push({ raw, threadId: payload.threadId });
      const to = raw.match(/^To: (.+)$/m)![1]!.trim();
      threadOf[to] ??= `thread-${to}`;
      return Response.json({ id: `out-${sends.length}`, threadId: threadOf[to] });
    }
    if (u.pathname.endsWith("/messages")) {
      queries.push(u.searchParams.get("q")!);
      return Response.json({ messages: inbox.map((m) => ({ id: m.id, threadId: m.threadId })) });
    }
    const id = u.pathname.split("/").pop()!;
    if (u.searchParams.get("format") === "full") fullFetches.push(id);
    return Response.json(inbox.find((m) => m.id === id));
  }) as typeof globalThis.fetch;
  const oauth = new GoogleOAuth({ clientId: "c", clientSecret: "s", redirectUri: "http://x/cb", fetch });
  const scan = (now = later(31)) => runReplyTick(db, { box, oauth, fetch, now: () => now });

  let ws: string;
  let seqId: string;
  let otherSeqId: string;

  beforeEach(async () => {
    inbox = [];
    fullFetches = [];
    queries = [];
    threadOf = {};
    sends = [];
    ws = (await db.insert(workspaces).values({ name: "replies-test", approveSequenceEmails: false }).returning())[0]!.id;
    const [mb] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws, provider: "gmail", email: "iker@meerko.ai", encryptedRefreshToken: box.encrypt("rt") })
      .returning();
    const table = await createTable(db, ws, { name: "leads" });
    await insertRows(db, ws, table.id, [
      { first_name: "Pia", email: "pia@slalom.example" },
      { first_name: "Paula", email: "paula@webon.example" },
      { first_name: "Orion", email: "orion@estudio404.example" },
      { first_name: "Fran", email: "fran@reply-example.com" },
    ]);
    const steps = [{ subject: "Quick question, {{first_name}}", body: "Hi {{first_name}}" }, { body: "Bump", delayDays: 3 }];
    seqId = (await createSequence(db, ws, { tableId: table.id, mailboxIds: [mb!.id], name: "Agencies", steps })).id;
    // A second, not-yet-started sequence that also includes Pia.
    otherSeqId = (await createSequence(db, ws, { tableId: table.id, mailboxIds: [mb!.id], name: "Later", steps })).id;
    await enrollRows(db, ws, otherSeqId, { filter: { first_name: "Pia" }, now: MON_1030 });
    await setSequenceStatus(db, ws, otherSeqId, "active");
    await db.update(enrollments).set({ nextSendAt: later(60 * 24 * 7) }).where(eq(enrollments.sequenceId, otherSeqId));

    await enrollRows(db, ws, seqId, { now: MON_1030 });
    await setSequenceStatus(db, ws, seqId, "active");
    for (let i = 0; i < 4; i++) await runSendTick(db, { box, oauth, fetch, publicUrl: "https://m.ai", now: () => later(i * 8), random: () => 0 });
  });

  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  const stateOf = async (email: string, sequenceId = seqId) =>
    (await db.select().from(enrollments).where(eq(enrollments.sequenceId, sequenceId))).find((e) => e.email === email)?.state;

  it("stops every sequence to a person who replies, and stores only the new text", async () => {
    deliver({ from: "Pia Moll <pia@slalom.example>", thread: threadOf["pia@slalom.example"]!, text: "Yes, let's talk Tuesday.\n\nOn Mon, Iker <iker@meerko.ai> wrote:\n> Hi Pia" });
    expect(await scan()).toMatchObject({ replies: 1, bounces: 0 });
    expect(await stateOf("pia@slalom.example")).toBe("replied");
    expect(await stateOf("pia@slalom.example", otherSeqId)).toBe("replied");
    expect(await stateOf("paula@webon.example")).toBe("active");

    // Scanning again doesn't duplicate anything. The query looks back an hour before the last check,
    // but never before the first email this mailbox sent for a sequence.
    expect(await scan(later(40))).toMatchObject({ scanned: 0, replies: 0 });
    expect(queries[1]).toBe(`after:${Math.floor(MON_1030.getTime() / 1000)} -from:me`);
    await scan(later(24 * 60));
    await scan(later(24 * 60 + 2));
    expect(queries[3]).toBe(`after:${Math.floor((later(24 * 60).getTime() - 60 * 60_000) / 1000)} -from:me`);

    const [reply] = await listReplies(db, ws);
    expect(reply).toMatchObject({ from: "pia@slalom.example", body: "Yes, let's talk Tuesday.", sequenceName: "Agencies", intent: null });
    expect(reply!.row).toMatchObject({ first_name: "Pia" });
    const rows = await db.select({ data: tableRows.data, stage: tableRows.stage }).from(tableRows).innerJoin(dataTables, eq(tableRows.tableId, dataTables.id)).where(eq(dataTables.workspaceId, ws));
    const stages = Object.fromEntries(rows.map((r) => [r.data.email, r.stage]));
    expect(stages["pia@slalom.example"]).toBe("replied");
    expect(stages["paula@webon.example"]).toBe("contacted");
    expect(reply!.thread.map((t) => t.direction)).toEqual(["out", "in"]);

    await classifyReply(db, ws, reply!.id, "interested");
    expect(await listReplies(db, ws)).toEqual([]);
    expect((await listReplies(db, ws, { intent: "interested" })).length).toBe(1);
    expect((await sequenceStats(db, ws, seqId)).states).toMatchObject({ replied: 1 });
  });

  it("handles bounces, unsubscribe requests and out-of-office replies by rule", async () => {
    deliver({ from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>", subject: "Delivery Status Notification (Failure)", thread: threadOf["paula@webon.example"]!, text: "Address not found" });
    deliver({ from: "orion@estudio404.example", thread: threadOf["orion@estudio404.example"]!, text: "Por favor, darme de baja." });
    deliver({ from: "pia@slalom.example", thread: threadOf["pia@slalom.example"]!, subject: "Respuesta automática: Re: Quick question, Pia", text: "Estoy de vacaciones hasta el lunes.", headers: { "Auto-Submitted": "auto-replied" } });

    expect(await scan()).toMatchObject({ replies: 0, bounces: 1, unsubscribes: 1, outOfOffice: 1 });
    expect(await stateOf("paula@webon.example")).toBe("bounced");
    expect(await stateOf("orion@estudio404.example")).toBe("unsubscribed");
    expect(await stateOf("pia@slalom.example")).toBe("active"); // out of office doesn't stop the sequence
    const suppressed = await db.select().from(suppressions).where(eq(suppressions.workspaceId, ws));
    expect(suppressed.map((s) => [s.email, s.reason]).sort()).toEqual([
      ["orion@estudio404.example", "unsubscribed"],
      ["paula@webon.example", "bounced"],
    ]);
    // Automatic messages don't clutter the agent's inbox.
    expect(await listReplies(db, ws)).toEqual([]);
    expect((await listReplies(db, ws, { includeAutomatic: true, unclassified: false })).length).toBe(3);
  });

  it("matches fresh emails from enrolled people, and never stores unrelated mail", async () => {
    deliver({ from: "fran@reply-example.com", thread: "brand-new-thread", subject: "Your email", text: "Saw your note, call me." });
    deliver({ from: "newsletter@somewhere.com", thread: "unrelated", subject: "Weekly digest", text: "Lots of news" });

    expect(await scan()).toMatchObject({ scanned: 2, replies: 1 });
    expect(await stateOf("fran@reply-example.com")).toBe("replied");
    expect(fullFetches).toEqual(["in-1"]); // the newsletter was only checked by its From header
    const stored = await db.select().from(messages).where(eq(messages.workspaceId, ws));
    expect(stored.some((m) => m.fromEmail === "newsletter@somewhere.com")).toBe(false);
  });

  it("sends an approved draft as a threaded reply, once, and refuses suppressed addresses", async () => {
    deliver({ from: "Pia Moll <pia@slalom.example>", thread: threadOf["pia@slalom.example"]!, text: "Interesting, what does it cost?" });
    deliver({ from: "orion@estudio404.example", thread: threadOf["orion@estudio404.example"]!, text: "Tell me more" });
    await scan();
    const replies = await listReplies(db, ws);
    const pia = replies.find((r) => r.from === "pia@slalom.example")!;
    const orion = replies.find((r) => r.from === "orion@estudio404.example")!;

    await draftReply(db, ws, pia.id, "First try");
    const draft = await draftReply(db, ws, pia.id, "Hi Pia, it's $5 per account. Tuesday at 10?\n\nIker");
    const pending = await listDrafts(db, ws);
    expect(pending).toHaveLength(1); // the second draft replaced the first
    expect(pending[0]).toMatchObject({ to: "pia@slalom.example", replyBody: "Interesting, what does it cost?" });
    expect(pending[0]!.thread.map((t) => t.direction)).toEqual(["out", "in"]);

    const before = sends.length;
    const { emailsSent } = await sequenceStats(db, ws, seqId);
    const res = await approveDraft(db, ws, draft.id, { box, oauth, fetch }, "Hi Pia, it's $5 per account. Wednesday at 10?\n\nIker");
    expect(res).toMatchObject({ sent: true, to: "pia@slalom.example", subject: "Re: Quick question, Pia" });
    const sent = sends.at(-1)!;
    expect(sends.length).toBe(before + 1);
    expect(sent.threadId).toBe(threadOf["pia@slalom.example"]);
    expect(sent.raw).toContain("In-Reply-To: <reply-1@slalom.example>");
    expect(sent.raw).toMatch(/References: <[^>]+> <reply-1@slalom\.agency>/);
    expect(Buffer.from(sent.raw.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""), "base64").toString()).toContain("Wednesday");

    // Approving twice doesn't send twice; the reply is handled.
    await expect(approveDraft(db, ws, draft.id, { box, oauth, fetch })).rejects.toBeInstanceOf(ReplyError);
    expect(sends.length).toBe(before + 1);
    expect(await listDrafts(db, ws)).toEqual([]);
    expect((await listDrafts(db, ws, "sent"))[0]!.body).toContain("Wednesday");

    // A follow-up to the same reply (written in the inbox) is a new draft, sent in the same thread.
    const followUp = await draftReply(db, ws, pia.id, "Following up: does Wednesday work?");
    await approveDraft(db, ws, followUp.id, { box, oauth, fetch });
    expect(sends.length).toBe(before + 2);
    expect(sends.at(-1)!.threadId).toBe(threadOf["pia@slalom.example"]);
    // Replies aren't sequence emails, so they don't count as sent by the sequence.
    expect((await sequenceStats(db, ws, seqId)).emailsSent).toBe(emailsSent);

    // Someone who unsubscribed after replying can't be emailed, and discarding works.
    const orionDraft = await draftReply(db, ws, orion.id, "Sure!");
    await unsubscribe(db, ws, "orion@estudio404.example");
    await expect(approveDraft(db, ws, orionDraft.id, { box, oauth, fetch })).rejects.toThrow(/do-not-email/);
    await discardDraft(db, ws, orionDraft.id);
    expect(await listDrafts(db, ws)).toEqual([]);
  });
});
