import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

/** A workspace's own provider API keys (BYOK), encrypted with MEERKO_ENCRYPTION_KEY. Calls using them cost no credits. */
export const providerKeys = pgTable(
  "provider_keys",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    last4: text("last4").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("provider_keys_workspace_provider_idx").on(t.workspaceId, t.provider)],
);

/** Connected sending mailboxes. The OAuth refresh token is encrypted with MEERKO_ENCRYPTION_KEY. */
export const mailboxes = pgTable(
  "mailboxes",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"gmail">().notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    dailyLimit: integer("daily_limit").notNull().default(50),
    status: text("status").$type<"active" | "error">().notNull().default("active"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("mailboxes_workspace_email_idx").on(t.workspaceId, t.email)],
);

export type SequenceStatus = "draft" | "active" | "paused";
export type EnrollmentState = "active" | "completed" | "replied" | "unsubscribed" | "bounced" | "stopped" | "failed";

export const sequences = pgTable("sequences", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  tableId: uuid("table_id").notNull().references(() => dataTables.id, { onDelete: "cascade" }),
  mailboxId: uuid("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  status: text("status").$type<SequenceStatus>().notNull().default("draft"),
  /** Sends happen on weekdays between these local hours, in this IANA timezone. */
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  windowStartHour: integer("window_start_hour").notNull().default(9),
  windowEndHour: integer("window_end_hour").notNull().default(17),
  createdAt: createdAt(),
});

export const sequenceSteps = pgTable(
  "sequence_steps",
  {
    id: id(),
    sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Days after the previous step (ignored for the first step, which goes out on start). */
    delayDays: integer("delay_days").notNull().default(0),
    /** Only the first step has a subject; follow-ups reply in the same thread. */
    subject: text("subject"),
    body: text("body").notNull(),
  },
  (t) => [uniqueIndex("sequence_steps_sequence_position_idx").on(t.sequenceId, t.position)],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
    rowId: uuid("row_id").notNull().references(() => tableRows.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    state: text("state").$type<EnrollmentState>().notNull().default("active"),
    /** Position of the next step to send. */
    nextStep: integer("next_step").notNull().default(0),
    nextSendAt: timestamp("next_send_at", { withTimezone: true }),
    gmailThreadId: text("gmail_thread_id"),
    /** RFC Message-IDs sent so far, for In-Reply-To/References threading. */
    messageIds: jsonb("message_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("enrollments_sequence_row_idx").on(t.sequenceId, t.rowId),
    index("enrollments_due_idx").on(t.state, t.nextSendAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "set null" }),
    direction: text("direction").$type<"out" | "in">().notNull(),
    step: integer("step"),
    gmailId: text("gmail_id"),
    gmailThreadId: text("gmail_thread_id"),
    rfcMessageId: text("rfc_message_id"),
    fromEmail: text("from_email").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_mailbox_sent_idx").on(t.mailboxId, t.sentAt), index("messages_thread_idx").on(t.gmailThreadId)],
);

/** Addresses that must never be emailed again by this workspace (unsubscribes, bounces, manual). */
export const suppressions = pgTable(
  "suppressions",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    reason: text("reason").$type<"unsubscribed" | "bounced" | "manual">().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("suppressions_workspace_email_idx").on(t.workspaceId, t.email)],
);
