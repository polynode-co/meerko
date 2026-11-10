import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, mailboxes, workspaces, type Db } from "@meerko/db";
import { getBalance } from "./credits.ts";
import { fakeGmail } from "./mail/fake-gmail-imap.ts";
import { SecretBox } from "./provider-keys.ts";
import { approveDraft, listDrafts } from "./replies/drafts.ts";
import { listReplies } from "./replies/replies.ts";
import { REVIEWER_CREDITS, ReviewerSeedError, seedReviewerWorkspace } from "./reviewer-seed.ts";
import { listSequenceRecipients, sequenceStats, listSequences } from "./sequences.ts";
import { listTables, queryRows } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("reviewer seed (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  let ws: string;

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: "reviewer-seed-test" }).returning())[0]!.id;
  });
  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  it("needs a mailbox first", async () => {
    await expect(seedReviewerWorkspace(db, ws)).rejects.toThrow(ReviewerSeedError);
  });

  it("seeds leads, a paused sequence, replies with drafts and credits, once", async () => {
    await db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail_imap", email: "review@meerko.ai", encryptedPassword: box.encrypt("abcdabcdabcdabcd") });
    const r = await seedReviewerWorkspace(db, ws);

    const [table] = await listTables(db, ws);
    const rows = await queryRows(db, ws, table!.id);
    expect(rows).toHaveLength(8);
    expect(rows.every((row) => /^review\+\w+@meerko\.ai$/.test(String(row.data.email)))).toBe(true);

    const [seq] = await listSequences(db, ws);
    expect(seq).toMatchObject({ id: r.sequenceId, status: "paused" });
    expect(await listSequenceRecipients(db, ws, r.sequenceId)).toHaveLength(6);
    expect(await sequenceStats(db, ws, r.sequenceId)).toMatchObject({ enrolled: 6, remaining: 3, emailsSent: 6, states: { replied: 3, active: 3 } });

    const replies = await listReplies(db, ws, { unclassified: false });
    expect(replies).toHaveLength(3);
    expect(replies.every((x) => x.thread.length === 2)).toBe(true);
    expect(await listReplies(db, ws)).toHaveLength(1);
    expect(await listDrafts(db, ws)).toHaveLength(2);

    expect(await getBalance(db, ws)).toBe(REVIEWER_CREDITS);
    expect((await db.select().from(workspaces).where(eq(workspaces.id, ws)))[0]!.plan).toBe("pro");

    await expect(seedReviewerWorkspace(db, ws)).rejects.toThrow(/already seeded/);

    // Approving a draft sends from the mailbox, back to its own plus-address.
    const g = fakeGmail();
    const [draft] = await listDrafts(db, ws);
    const sent = await approveDraft(db, ws, draft!.id, { box, imap: g.connectors });
    expect(sent.to).toMatch(/^review\+\w+@meerko\.ai$/);
    expect(g.outbox[0]!.envelope.to).toEqual([sent.to]);
  });
});
