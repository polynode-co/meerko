import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, sequences, workspaces, type Db } from "@meerko/db";
import { deleteMailbox, MailboxInUseError } from "./mailboxes.ts";
import { SecretBox } from "./provider-keys.ts";
import { createSequence, deleteSequence, enrollRows, SequenceError, setSequenceStatus } from "./sequences.ts";
import { createTable, insertRows, NotFoundError, queryRows } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("deleting a sequence (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "delete-seq-test"));
  });

  it("refuses while active, then deletes it and frees its mailbox; leads and sent mail stay", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "delete-seq-test" }).returning();
    const [mb] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws!.id, provider: "gmail_imap", email: "ana@acme.eu", encryptedPassword: box.encrypt("x") })
      .returning();
    const t = await createTable(db, ws!.id, { name: "leads" });
    await insertRows(db, ws!.id, t.id, [{ first_name: "Pia", email: "pia@slalom.example" }]);
    const seq = await createSequence(db, ws!.id, { tableId: t.id, mailboxIds: [mb!.id], name: "S", steps: [{ subject: "Hi", body: "Hi" }] });
    await enrollRows(db, ws!.id, seq.id);
    const [en] = await db.select().from(enrollments).where(eq(enrollments.sequenceId, seq.id));
    await db.insert(messages).values({ workspaceId: ws!.id, mailboxId: mb!.id, enrollmentId: en!.id, direction: "out", fromEmail: "ana@acme.eu", toEmail: "pia@slalom.example", body: "Hi" });
    await setSequenceStatus(db, ws!.id, seq.id, "active");

    await expect(deleteSequence(db, ws!.id, seq.id)).rejects.toThrow(SequenceError);
    const [stranger] = await db.insert(workspaces).values({ name: "delete-seq-test" }).returning();
    await expect(deleteSequence(db, stranger!.id, seq.id)).rejects.toThrow(NotFoundError);
    await expect(deleteMailbox(db, ws!.id, mb!.id)).rejects.toThrow(MailboxInUseError);

    await setSequenceStatus(db, ws!.id, seq.id, "paused");
    expect(await deleteSequence(db, ws!.id, seq.id)).toEqual({ deleted: true });
    expect(await db.select().from(sequences).where(eq(sequences.id, seq.id))).toHaveLength(0);
    expect(await db.select().from(enrollments).where(eq(enrollments.sequenceId, seq.id))).toHaveLength(0);
    expect(await queryRows(db, ws!.id, t.id)).toHaveLength(1);
    expect(await db.select().from(messages).where(eq(messages.toEmail, "pia@slalom.example"))).toHaveLength(1);
    expect(await deleteMailbox(db, ws!.id, mb!.id)).toBeTruthy();
  });
});
