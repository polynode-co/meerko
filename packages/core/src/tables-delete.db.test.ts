import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, sequences, suppressions, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "./provider-keys.ts";
import { createSequence, enrollRows, setSequenceStatus } from "./sequences.ts";
import { createTable, deleteRows, deleteTable, insertRows, NotFoundError, queryRows, TableInUseError } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("deleting leads and tables (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "delete-test"));
  });

  it("deletes leads and stops their sequences, but keeps sent mail and do-not-email entries", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "delete-test" }).returning();
    const [mb] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws!.id, provider: "gmail_imap", email: "ana@acme.eu", encryptedPassword: box.encrypt("x") })
      .returning();
    const t = await createTable(db, ws!.id, { name: "leads" });
    await insertRows(db, ws!.id, t.id, [
      { first_name: "Pia", email: "pia@slalom.example" },
      { first_name: "Bo", email: "bo@x.com" },
    ]);
    const seq = await createSequence(db, ws!.id, { tableId: t.id, mailboxIds: [mb!.id], name: "S", steps: [{ subject: "Hi", body: "Hi" }] });
    await enrollRows(db, ws!.id, seq.id);
    await setSequenceStatus(db, ws!.id, seq.id, "active");
    const [pia] = (await queryRows(db, ws!.id, t.id)).filter((r) => r.data.first_name === "Pia");
    const [en] = await db.select().from(enrollments).where(eq(enrollments.rowId, pia!.id));
    await db.insert(messages).values({ workspaceId: ws!.id, mailboxId: mb!.id, enrollmentId: en!.id, direction: "out", fromEmail: "ana@acme.eu", toEmail: "pia@slalom.example", body: "Hi" });
    await db.insert(suppressions).values({ workspaceId: ws!.id, email: "pia@slalom.example", reason: "unsubscribed" });

    expect(await deleteRows(db, ws!.id, t.id, [pia!.id])).toEqual({ deleted: 1 });
    expect((await queryRows(db, ws!.id, t.id)).map((r) => r.data.first_name)).toEqual(["Bo"]);
    expect(await db.select().from(enrollments).where(eq(enrollments.id, en!.id))).toHaveLength(0);
    const [sent] = await db.select().from(messages).where(eq(messages.toEmail, "pia@slalom.example"));
    expect(sent).toMatchObject({ enrollmentId: null, body: "Hi" });
    expect(await db.select().from(suppressions).where(eq(suppressions.workspaceId, ws!.id))).toHaveLength(1);

    // Rows of another table, or another workspace's table, are never touched.
    const other = await createTable(db, ws!.id, { name: "other" });
    const [bo] = await queryRows(db, ws!.id, t.id);
    expect(await deleteRows(db, ws!.id, other.id, [bo!.id])).toEqual({ deleted: 0 });
    const [stranger] = await db.insert(workspaces).values({ name: "delete-test" }).returning();
    await expect(deleteRows(db, stranger!.id, t.id, [bo!.id])).rejects.toThrow(NotFoundError);
    await expect(deleteTable(db, stranger!.id, t.id)).rejects.toThrow(NotFoundError);

    // A table can't be deleted while a sequence is sending to it; once paused, it goes with its sequences.
    await expect(deleteTable(db, ws!.id, t.id)).rejects.toThrow(TableInUseError);
    await setSequenceStatus(db, ws!.id, seq.id, "paused");
    expect(await deleteTable(db, ws!.id, t.id)).toEqual({ deleted: true, rows: 1, sequences: 1 });
    expect(await db.select().from(sequences).where(eq(sequences.id, seq.id))).toHaveLength(0);
    expect(await db.select().from(messages).where(eq(messages.toEmail, "pia@slalom.example"))).toHaveLength(1);
  });
});
