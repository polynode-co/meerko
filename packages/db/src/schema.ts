import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type ColumnType = "text" | "number" | "email" | "url" | "boolean" | "json";

export interface ColumnDef {
  key: string;
  name: string;
  type: ColumnType;
}

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const apiKeys = pgTable("api_keys", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Only the SHA-256 hash is stored; the raw key is shown once at creation.
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const dataTables = pgTable("data_tables", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  columns: jsonb("columns").$type<ColumnDef[]>().notNull().default(sql`'[]'::jsonb`),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: createdAt(),
});

export const tableRows = pgTable(
  "table_rows",
  {
    id: id(),
    tableId: uuid("table_id").notNull().references(() => dataTables.id, { onDelete: "cascade" }),
    // Monotonic insertion order, so rows keep their CSV order and pagination is stable.
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("table_rows_table_id_seq_idx").on(t.tableId, t.seq),
    // Powers `data @> {...}` containment filters.
    index("table_rows_data_gin_idx").using("gin", t.data),
  ],
);
