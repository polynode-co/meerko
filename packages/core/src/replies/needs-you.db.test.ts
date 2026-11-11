import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, messages, workspaces, type Db } from "@meerko/db";
import { discardDraft, draftReply } from "./drafts.ts";
import { classifyReply, listReplies } from "./replies.ts";

describe.skipIf(!process.env.DATABASE_URL)("Needs you (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  let ws: string;
  const reply = async (from: string) =>
    (await db.insert(messages).values({ workspaceId: ws, direction: "in", fromEmail: from, toEmail: "me@meerko.test", subject: "Re: hi", body: "Tell me more" }).returning())[0]!.id;
  const needs = async () => (await listReplies(db, ws, { needsYou: true })).map((r) => r.from).sort();

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: "needs-you-test" }).returning())[0]!.id;
  });
  afterEach(async () => {
    await db.delete(workspaces).where(eq(workspaces.id, ws));
  });

  it("keeps a labelled reply while its draft waits, and lets it go once handled or discarded", async () => {
    const fresh = await reply("fresh@a.example");
    const drafted = await reply("drafted@a.example");
    const labelled = await reply("labelled@a.example");
    await classifyReply(db, ws, drafted, "question");
    const draft = await draftReply(db, ws, drafted, "Happy to.");
    await classifyReply(db, ws, labelled, "not_interested");

    expect(await needs()).toEqual(["drafted@a.example", "fresh@a.example"]);
    // The default (what the agent reads) still lists only unclassified replies.
    expect((await listReplies(db, ws)).map((r) => r.id)).toEqual([fresh]);

    await discardDraft(db, ws, draft.id);
    expect(await needs()).toEqual(["fresh@a.example"]);

    await draftReply(db, ws, drafted, "Again.");
    await classifyReply(db, ws, drafted, "question", true);
    expect(await needs()).toEqual(["fresh@a.example"]);
    void labelled;
  });
});
