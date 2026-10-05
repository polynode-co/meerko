import { afterAll, describe, expect, it } from "vitest";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { addColumn, createTable, getPendingCells, getTable, insertRows, queryRows, updateRows } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("AI columns (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "ai-column-test"));
  });

  it("serves pending cells with rendered instructions until the agent fills them", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "ai-column-test" }).returning();
    const t = await createTable(db, ws!.id, { name: "leads" });
    await insertRows(db, ws!.id, t.id, [{ company: "Slalom" }, { company: "Tandem" }, { company: "Done", icp_fit: "5" }]);
    await addColumn(db, ws!.id, t.id, { name: "ICP fit", type: "text", prompt: "Score {{company}} 1-5" });

    const pending = await getPendingCells(db, ws!.id, t.id, "ICP fit");
    expect(pending).toMatchObject({ column: "icp_fit", remaining: 2 });
    expect(pending.rows.map((r) => r.instruction)).toEqual(["Score Slalom 1-5", "Score Tandem 1-5"]);

    const res = await updateRows(db, ws!.id, t.id, [
      { id: pending.rows[0]!.id, data: { icp_fit: "4", "Fit Reason": "pure social agency" } },
      { id: "00000000-0000-0000-0000-000000000000", data: { icp_fit: "1" } },
    ]);
    expect(res.updated).toBe(1);
    expect(res.addedColumns.map((c) => c.key)).toEqual(["fit_reason"]);
    expect((await getPendingCells(db, ws!.id, t.id, "icp_fit")).remaining).toBe(1);

    // A new prompt replaces the instruction without touching the column's data.
    await addColumn(db, ws!.id, t.id, { name: "ICP fit", type: "text", prompt: "Rate {{company}}" });
    expect((await getTable(db, ws!.id, t.id)).columns.find((c) => c.key === "icp_fit")?.prompt).toBe("Rate {{company}}");
    const rows = await queryRows(db, ws!.id, t.id);
    expect(rows[0]!.data).toMatchObject({ company: "Slalom", icp_fit: 4, fit_reason: "pure social agency" });
  });

  it("refuses columns without a prompt", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "ai-column-test" }).returning();
    const t = await createTable(db, ws!.id, { name: "leads", columns: [{ name: "notes", type: "text" }] });
    await expect(getPendingCells(db, ws!.id, t.id, "notes")).rejects.toThrow(/no prompt/);
  });
});
