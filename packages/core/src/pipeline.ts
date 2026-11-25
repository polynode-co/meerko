import { and, dataTables, enrollments, eq, messages, sql, STAGES, tableRows, type Db, type SQL, type Stage } from "@meerko/db";
import { getTable } from "./tables.ts";

type Writer = Pick<Db, "update">;

/**
 * Moves rows forward to `stage` only if they're at an earlier stage, so automatic events never undo
 * progress (a late reply doesn't drag a "won" lead back to "replied"). Lost leads are left alone.
 */
export async function advanceStage(db: Writer, rowIds: string[], stage: "contacted" | "replied") {
  if (rowIds.length === 0) return;
  const earlier = STAGES.slice(0, STAGES.indexOf(stage));
  await db
    .update(tableRows)
    .set({ stage, stageChangedAt: sql`now()` })
    .where(and(sql`${tableRows.id} in ${rowIds}`, sql`${tableRows.stage} in ${earlier}`));
}

/** Sets any stage by hand (meeting, won, lost, or a correction). Only rows in this table are touched. */
export async function moveStage(db: Db, workspaceId: string, tableId: string, rowIds: string[], stage: Stage) {
  await getTable(db, workspaceId, tableId);
  if (rowIds.length === 0) return { moved: 0 };
  const res = await db
    .update(tableRows)
    .set({ stage, stageChangedAt: sql`now()` })
    .where(and(eq(tableRows.tableId, tableId), sql`${tableRows.id} in ${rowIds}`))
    .returning({ id: tableRows.id });
  return { moved: res.length };
}

/** Lead counts per stage, for one table or across the workspace. */
export async function pipelineSummary(db: Db, workspaceId: string, tableId?: string) {
  if (tableId) await getTable(db, workspaceId, tableId);
  const conds: SQL[] = [eq(dataTables.workspaceId, workspaceId)];
  if (tableId) conds.push(eq(tableRows.tableId, tableId));
  const rows = await db
    .select({ stage: tableRows.stage, n: sql<number>`count(*)::int` })
    .from(tableRows)
    .innerJoin(dataTables, eq(tableRows.tableId, dataTables.id))
    .where(and(...conds))
    .groupBy(tableRows.stage);
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const r of rows) counts[r.stage] = r.n;
  return { tableId: tableId ?? null, stages: counts, total: rows.reduce((n, r) => n + r.n, 0), replied: await repliedCount(db, workspaceId, tableId) };
}

/**
 * People who replied: each address that sent a human reply (not an auto-reply, bounce or unsubscribe), counted once.
 * Unlike the replied stage it keeps counting a lead moved on to meeting, won or lost, and a reply whose sequence was
 * deleted. For one table, only replies still tied to its leads count.
 */
async function repliedCount(db: Db, workspaceId: string, tableId?: string) {
  const conds: SQL[] = [
    eq(messages.workspaceId, workspaceId),
    eq(messages.direction, "in"),
    sql`coalesce(${messages.intent}, '') not in ('bounce', 'out_of_office', 'unsubscribe')`,
  ];
  if (tableId) {
    conds.push(
      sql`exists (select 1 from ${enrollments} join ${tableRows} on ${tableRows.id} = ${enrollments.rowId} where ${enrollments.id} = ${messages.enrollmentId} and ${tableRows.tableId} = ${tableId})`,
    );
  }
  const [r] = await db
    .select({ n: sql<number>`count(distinct lower(${messages.fromEmail}))::int` })
    .from(messages)
    .where(and(...conds));
  return r?.n ?? 0;
}
