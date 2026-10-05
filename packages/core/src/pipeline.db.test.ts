import { afterAll, describe, expect, it } from "vitest";
import { createDb, eq, workspaces, type Db } from "@meerko/db";
import { advanceStage, moveStage, pipelineSummary } from "./pipeline.ts";
import { createTable, insertRows, queryRows } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("pipeline (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "pipeline-test"));
  });

  it("only moves forward automatically, moves anywhere by hand, and counts per stage", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "pipeline-test" }).returning();
    const t = await createTable(db, ws!.id, { name: "leads" });
    await insertRows(db, ws!.id, t.id, [{ n: "a" }, { n: "b" }, { n: "c" }]);
    const [a, b, c] = await queryRows(db, ws!.id, t.id);
    expect(a!.stage).toBe("new");

    await advanceStage(db, [a!.id, b!.id, c!.id], "contacted");
    await moveStage(db, ws!.id, t.id, [b!.id], "won");
    await moveStage(db, ws!.id, t.id, [c!.id], "lost");
    // A late reply moves "contacted" forward but never drags won or lost back.
    await advanceStage(db, [a!.id, b!.id, c!.id], "replied");

    const byName = Object.fromEntries((await queryRows(db, ws!.id, t.id)).map((r) => [r.data.n, r.stage]));
    expect(byName).toEqual({ a: "replied", b: "won", c: "lost" });
    expect((await queryRows(db, ws!.id, t.id, { stage: "won" })).map((r) => r.data.n)).toEqual(["b"]);

    const summary = await pipelineSummary(db, ws!.id, t.id);
    expect(summary).toEqual({ tableId: t.id, total: 3, stages: { new: 0, contacted: 0, replied: 1, meeting: 0, won: 1, lost: 1 } });
    expect((await pipelineSummary(db, ws!.id)).total).toBe(3);

    // Rows from another table are never touched.
    const other = await createTable(db, ws!.id, { name: "other" });
    expect(await moveStage(db, ws!.id, other.id, [a!.id], "lost")).toEqual({ moved: 0 });
  });
});
