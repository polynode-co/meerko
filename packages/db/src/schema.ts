import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type ColumnType = "text" | "number" | "email" | "url" | "boolean" | "json";

export interface ColumnDef {
  key: string;
  name: string;
  type: ColumnType;
  /**
   * Instruction for an AI column, with optional `{{column_key}}` variables. Meerko never runs it:
   * the user's own agent fetches pending cells, writes the answers and saves them back.
   */
  prompt?: string;
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

/** Append-only. A workspace's balance is the sum of `delta`; grants are positive, charges negative. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    refId: uuid("ref_id"),
    createdAt: createdAt(),
  },
  (t) => [index("credit_ledger_workspace_id_idx").on(t.workspaceId)],
);

/** One row per provider call during enrichment, kept for auditing and margin tracking. */
export const enrichmentRuns = pgTable(
  "enrichment_runs",
  {
    id: id(),
    rowId: uuid("row_id").notNull().references(() => tableRows.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    provider: text("provider"),
    outcome: text("outcome").notNull(),
    result: jsonb("result"),
    providerCost: numeric("provider_cost", { mode: "number" }).notNull().default(0),
    costCredits: integer("cost_credits").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("enrichment_runs_row_id_idx").on(t.rowId)],
);
