import { and, dataTables, desc, eq, sql, tableRows, type ColumnDef, type Db } from "@meerko/db";
import { coerceRow, inferNewColumns, normalizeRow, toColumnKey } from "./columns.ts";

export class NotFoundError extends Error {}

export async function listTables(db: Db, workspaceId: string) {
  return db.select().from(dataTables).where(eq(dataTables.workspaceId, workspaceId)).orderBy(desc(dataTables.createdAt));
}

export async function getTable(db: Db, workspaceId: string, tableId: string) {
  const [table] = await db
    .select()
    .from(dataTables)
    .where(and(eq(dataTables.workspaceId, workspaceId), eq(dataTables.id, tableId)));
  if (!table) throw new NotFoundError(`Table ${tableId} not found`);
  return table;
}

export async function createTable(
  db: Db,
  workspaceId: string,
  input: { name: string; columns?: Omit<ColumnDef, "key">[] },
) {
  const columns = (input.columns ?? []).map((c) => ({ ...c, key: toColumnKey(c.name) }));
  const [table] = await db.insert(dataTables).values({ workspaceId, name: input.name, columns }).returning();
  return table!;
}

export async function addColumn(db: Db, workspaceId: string, tableId: string, column: Omit<ColumnDef, "key">) {
  const table = await getTable(db, workspaceId, tableId);
  const key = toColumnKey(column.name);
  if (table.columns.some((c) => c.key === key)) return table;
  const [updated] = await db
    .update(dataTables)
    .set({ columns: [...table.columns, { ...column, key }] })
    .where(eq(dataTables.id, tableId))
    .returning();
  return updated!;
}

/** Inserts rows, normalizing keys and auto-adding any columns the table doesn't have yet. */
export async function insertRows(db: Db, workspaceId: string, tableId: string, rawRows: Record<string, unknown>[]) {
  const table = await getTable(db, workspaceId, tableId);
  if (rawRows.length === 0) return { inserted: 0, addedColumns: [] as ColumnDef[] };
  const rows = rawRows.map(normalizeRow);
  // Keep the original header (e.g. "First Name") as the display name of auto-added columns.
  const headerNames = new Map(rawRows.flatMap((r) => Object.keys(r)).map((name) => [toColumnKey(name), name.trim()]));
  const addedColumns = inferNewColumns(table.columns, rows).map((c) => ({ ...c, name: headerNames.get(c.key) ?? c.key }));
  const columns = [...table.columns, ...addedColumns];
  const typedRows = rows.map((r) => coerceRow(r, columns));

  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 1000) {
      await tx.insert(tableRows).values(typedRows.slice(i, i + 1000).map((data) => ({ tableId, data })));
    }
    await tx
      .update(dataTables)
      .set({
        columns,
        rowCount: sql`${dataTables.rowCount} + ${rows.length}`,
      })
      .where(eq(dataTables.id, tableId));
  });
  return { inserted: rows.length, addedColumns };
}

export async function queryRows(
  db: Db,
  workspaceId: string,
  tableId: string,
  opts: { filter?: Record<string, unknown>; limit?: number; offset?: number } = {},
) {
  await getTable(db, workspaceId, tableId);
  const where = opts.filter && Object.keys(opts.filter).length > 0
    ? and(eq(tableRows.tableId, tableId), sql`${tableRows.data} @> ${JSON.stringify(opts.filter)}::jsonb`)
    : eq(tableRows.tableId, tableId);
  return db
    .select({ id: tableRows.id, data: tableRows.data, createdAt: tableRows.createdAt })
    .from(tableRows)
    .where(where)
    .orderBy(tableRows.seq)
    .limit(Math.min(opts.limit ?? 50, 1000))
    .offset(opts.offset ?? 0);
}
