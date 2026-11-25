import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, enrollments, eq, mailboxes, messages, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "./provider-keys.ts";
import { createSequence, enrollRows } from "./sequences.ts";
import { createTable, getLead, getTable, insertRows, NotFoundError, queryRows, renameTable } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("renaming tables and opening a lead (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "lead-test"));
  });

  it("renames a table, only in its own workspace", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "lead-test" }).returning();
    const [stranger] = await db.insert(workspaces).values({ name: "lead-test" }).returning();
    const t = await createTable(db, ws!.id, { name: "Old name" });
    expect((await renameTable(db, ws!.id, t.id, "  Fintech CTOs ")).name).toBe("Fintech CTOs");
    expect((await getTable(db, ws!.id, t.id)).name).toBe("Fintech CTOs");
    await expect(renameTable(db, stranger!.id, t.id, "Mine")).rejects.toThrow(NotFoundError);
  });

  it("returns a lead with its sequences and every email to and from it, oldest first", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "lead-test" }).returning();
    const [mb] = await db
      .insert(mailboxes)
      .values({ workspaceId: ws!.id, provider: "gmail_imap", email: "ana@acme.eu", encryptedPassword: box.encrypt("x") })
      .returning();
    const t = await createTable(db, ws!.id, { name: "leads" });
    await insertRows(db, ws!.id, t.id, [
      { first_name: "Pia", email: "pia@slalom.example", description: "A long description ".repeat(20) },
      { first_name: "Bo", email: "bo@x.com" },
    ]);
    const seq = await createSequence(db, ws!.id, { tableId: t.id, mailboxIds: [mb!.id], name: "Spring", steps: [{ subject: "Hi", body: "Hi {{first_name}}" }] });
    await enrollRows(db, ws!.id, seq.id);
    const rows = await queryRows(db, ws!.id, t.id);
    const pia = rows.find((r) => r.data.first_name === "Pia")!;
    const bo = rows.find((r) => r.data.first_name === "Bo")!;
    const [en] = await db.select().from(enrollments).where(eq(enrollments.rowId, pia.id));
    await db.insert(messages).values([
      { workspaceId: ws!.id, mailboxId: mb!.id, enrollmentId: en!.id, direction: "in", fromEmail: "pia@slalom.example", toEmail: "ana@acme.eu", subject: "Re: Hi", body: "Sounds good", sentAt: new Date("2026-11-02T10:00:00Z") },
      { workspaceId: ws!.id, mailboxId: mb!.id, enrollmentId: en!.id, direction: "out", step: 0, fromEmail: "ana@acme.eu", toEmail: "pia@slalom.example", subject: "Hi", body: "Hi Pia", sentAt: new Date("2026-11-01T10:00:00Z") },
    ]);

    const lead = await getLead(db, ws!.id, t.id, pia.id);
    expect(lead.row.data.description).toBe("A long description ".repeat(20));
    expect(lead.sequences).toEqual([expect.objectContaining({ sequenceId: seq.id, sequenceName: "Spring", state: "active", stepsSent: 0, email: "pia@slalom.example" })]);
    expect(lead.emails.map((m) => [m.direction, m.body, m.sequenceName])).toEqual([
      ["out", "Hi Pia", "Spring"],
      ["in", "Sounds good", "Spring"],
    ]);

    // Another lead's emails aren't mixed in, and a row of another table isn't found through this one.
    expect((await getLead(db, ws!.id, t.id, bo.id)).emails).toEqual([]);
    const other = await createTable(db, ws!.id, { name: "other" });
    await expect(getLead(db, ws!.id, other.id, pia.id)).rejects.toThrow(NotFoundError);
  });
});
