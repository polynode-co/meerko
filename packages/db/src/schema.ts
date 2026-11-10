import { sql } from "drizzle-orm";
import { type AnyPgColumn, bigint, boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export type ColumnType = "text" | "number" | "email" | "url" | "boolean" | "json";

/** Where a lead stands. Sending and reply detection move rows forward automatically; the rest is manual. */
export const STAGES = ["new", "contacted", "replied", "meeting", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

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

/** `pro` comes from a Stripe subscription (or is set by hand to comp a workspace). Self-hosted installs ignore it. */
export const PLANS = ["free", "pro"] as const;
export type Plan = (typeof PLANS)[number];

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  /**
   * Billing is per person, not per brand: a workspace someone creates after their first points at that first one, and
   * plan, Stripe customer, credits and plan limits are all read from it (`billingWorkspaceOf` in core). Null on the
   * workspace that pays, which is never itself a pointer, so the chain is one step.
   */
  billingWorkspaceId: uuid("billing_workspace_id").references((): AnyPgColumn => workspaces.id, { onDelete: "restrict" }),
  plan: text("plan").$type<Plan>().notNull().default("free"),
  // Billing on Meerko Cloud, mirrored from Stripe by its webhooks.
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  /** Who this brand sells to (core/icp.ts): written by the person's agent, used to score every lead. */
  icp: jsonb("icp").$type<object>(),
  createdAt: createdAt(),
});

export const API_KEY_SCOPES = ["full", "replies"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const apiKeys = pgTable("api_keys", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Only the SHA-256 hash is stored; the raw key is shown once at creation.
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  /** `full`, or `replies`: read replies and write drafts only, for an agent Meerko wakes up (see agent_hooks). */
  scope: text("scope").$type<ApiKeyScope>().notNull().default("full"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** People who sign in to the dashboard. Workspaces predate users: the CLI and agents still use API keys. */
export const users = pgTable("users", {
  id: id(),
  // Google's stable account id; the email can change. Null for people who only sign in with an email link.
  googleSub: text("google_sub").unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: createdAt(),
});

export const ROLES = ["owner", "member"] as const;
export type Role = (typeof ROLES)[number];

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    /** The daily email of replies waiting (core/digest.ts). Owners get it unless they unsubscribe. */
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    /** When the last digest went out, so it goes at most once a day and counts only replies since. */
    digestSentAt: timestamp("digest_sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] }), index("memberships_workspace_idx").on(t.workspaceId)],
);

/** Dashboard sessions. Like API keys, only the hash of the token is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // The workspace this session acts on.
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One-time codes from the API's OAuth callback; the web app exchanges one for a session. */
export const authCodes = pgTable("auth_codes", {
  codeHash: text("code_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Sign-in links sent by email (MEERKO_SMTP_URL). Stored hashed, used once, short-lived. `source` is where the
 * visit came from (the web app's lib/attribution.ts), for the sign_up event.
 */
export const emailSignIns = pgTable("email_sign_ins", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  source: jsonb("source").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

/** Emails allowed into a workspace; claimed on that address's first Google sign-in. */
export const invitations = pgTable(
  "invitations",
  {
    email: text("email").notNull(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.email, t.workspaceId] })],
);

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
    stage: text("stage").$type<Stage>().notNull().default("new"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }),
    // The agent's judgement on top of the rules-based ICP score: -30 to 30, and why (core/icp.ts).
    icpAdjust: integer("icp_adjust"),
    icpNote: text("icp_note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("table_rows_table_id_seq_idx").on(t.tableId, t.seq),
    index("table_rows_table_id_stage_idx").on(t.tableId, t.stage),
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
    /** The Stripe object a grant came from (`stripe:cs_…`, `stripe:in_…`); unique, so a redelivered webhook grants once. */
    externalRef: text("external_ref").unique(),
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

/**
 * Connected sending mailboxes: `gmail` through the Gmail API (OAuth refresh token), `gmail_imap` through
 * Gmail's IMAP and SMTP with an app password, `imap` through any provider's IMAP and SMTP with a password,
 * `outlook` through Microsoft Graph (OAuth refresh token).
 * The credential is encrypted with MEERKO_ENCRYPTION_KEY.
 */
export const mailboxes = pgTable(
  "mailboxes",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text("provider").$type<MailboxProvider>().notNull(),
    email: text("email").notNull(),
    /** The Google account to sign in as when `email` is an alias of it (gmail_imap). Null means `email`. */
    login: text("login"),
    displayName: text("display_name"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    encryptedPassword: text("encrypted_password"),
    /** The IMAP and SMTP servers of an `imap` mailbox (Gmail's are fixed). */
    servers: jsonb("servers").$type<MailboxServers>(),
    dailyLimit: integer("daily_limit").notNull().default(50),
    /**
     * Set while a new mailbox ramps up: its daily limit grows from a few emails to daily_limit over
     * the ramp, so a fresh inbox doesn't start at full volume. Null means no ramp (full limit).
     */
    rampStartedAt: timestamp("ramp_started_at", { withTimezone: true }),
    status: text("status").$type<"active" | "error">().notNull().default("active"),
    lastError: text("last_error"),
    /** Inbox is scanned for replies from this time onward (with some overlap). */
    repliesCheckedAt: timestamp("replies_checked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("mailboxes_workspace_email_idx").on(t.workspaceId, t.email),
    check("mailboxes_one_credential", sql`(${t.encryptedRefreshToken} is null) <> (${t.encryptedPassword} is null)`),
    check("mailboxes_imap_servers", sql`${t.provider} <> 'imap' or ${t.servers} is not null`),
  ],
);

export type MailboxProvider = "gmail" | "gmail_imap" | "imap" | "outlook";
/** Where an `imap` mailbox connects (TLS: IMAP 993, SMTP 465 or 587). */
export type MailboxServers = { imap: { host: string; port: number }; smtp: { host: string; port: number } };
export type SequenceStatus = "draft" | "active" | "paused";
export type MailboxAssignment = "capacity" | "even";
export type EnrollmentState = "active" | "completed" | "replied" | "unsubscribed" | "bounced" | "stopped" | "failed";

export const sequences = pgTable("sequences", {
  id: id(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  tableId: uuid("table_id").notNull().references(() => dataTables.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** How new leads are spread over the mailbox pool: most free capacity first, or the same number each. */
  assignment: text("assignment").$type<MailboxAssignment>().notNull().default("capacity"),
  status: text("status").$type<SequenceStatus>().notNull().default("draft"),
  /** Sends happen on weekdays between these local hours, in this IANA timezone. */
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  windowStartHour: integer("window_start_hour").notNull().default(9),
  windowEndHour: integer("window_end_hour").notNull().default(17),
  createdAt: createdAt(),
});

/** The mailboxes a sequence sends from (rotation). Each lead is assigned one of them when enrolled. */
export const sequenceMailboxes = pgTable(
  "sequence_mailboxes",
  {
    sequenceId: uuid("sequence_id").notNull().references(() => sequences.id, { onDelete: "cascade" }),
    // Deleting a mailbox takes it out of pools (deleteMailbox refuses when it's a sequence's only one).
    mailboxId: uuid("mailbox_id").notNull().references(() => mailboxes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.sequenceId, t.mailboxId] }), index("sequence_mailboxes_mailbox_idx").on(t.mailboxId)],
);

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
    /** The mailbox this lead's emails come from; every step stays on it so the thread holds together. */
    mailboxId: uuid("mailbox_id").references(() => mailboxes.id, { onDelete: "set null" }),
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
    /**
     * For inbound messages. Rules set bounce / out_of_office / unsubscribe; the user's agent sets
     * interested / not_interested / not_now / question / referral / other.
     */
    intent: text("intent"),
    /** When the user (or their agent) dealt with an inbound reply. */
    handledAt: timestamp("handled_at", { withTimezone: true }),
    /** When the workspace's agent hook was told about this reply, so it is announced once. */
    agentNotifiedAt: timestamp("agent_notified_at", { withTimezone: true }),
    /** When the reply was posted to the workspace's Slack channel, so it is posted once. */
    slackNotifiedAt: timestamp("slack_notified_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_mailbox_sent_idx").on(t.mailboxId, t.sentAt),
    index("messages_thread_idx").on(t.gmailThreadId),
    // Each Gmail message is stored once, however many times the inbox is scanned.
    uniqueIndex("messages_mailbox_gmail_id_idx").on(t.mailboxId, t.gmailId),
    // Replies still waiting for the user's agent (see agent_hooks).
    index("messages_agent_pending_idx")
      .on(t.workspaceId)
      .where(sql`${t.direction} = 'in' and ${t.intent} is null and ${t.agentNotifiedAt} is null`),
  ],
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

export const AGENT_HOOK_KINDS = ["claude_routine", "webhook"] as const;
export type AgentHookKind = (typeof AGENT_HOOK_KINDS)[number];

/**
 * Where Meerko rings the user's own agent when new replies arrive: a Claude Code routine's fire URL or any
 * webhook. Meerko makes the call; the agent does the thinking. The secret is the routine's bearer token or the
 * webhook's signing secret, encrypted with MEERKO_ENCRYPTION_KEY.
 */
export const agentHooks = pgTable("agent_hooks", {
  id: id(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").$type<AgentHookKind>().notNull(),
  url: text("url").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  secretLast4: text("secret_last4").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  lastStatus: integer("last_status"),
  lastError: text("last_error"),
  /** The first failure since the last success; the hook turns itself off after a day of them. */
  failingSince: timestamp("failing_since", { withTimezone: true }),
  createdAt: createdAt(),
});

export const SLACK_CONNECTION_KINDS = ["app", "webhook"] as const;
export type SlackConnectionKind = (typeof SLACK_CONNECTION_KINDS)[number];

/**
 * Where a workspace's replies and drafts are posted in Slack: the Meerko Slack app (a bot token, with Approve and
 * Discard buttons) or a pasted incoming webhook (posts only). One per workspace.
 */
export const slackConnections = pgTable(
  "slack_connections",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SlackConnectionKind>().notNull(),
    /** The bot token (app) or the webhook URL (webhook), encrypted: both let anyone post to the channel. */
    encryptedSecret: text("encrypted_secret").notNull(),
    teamId: text("team_id"),
    teamName: text("team_name"),
    channelId: text("channel_id"),
    channelName: text("channel_name"),
    enabled: boolean("enabled").notNull().default(true),
    lastPostedAt: timestamp("last_posted_at", { withTimezone: true }),
    lastError: text("last_error"),
    failingSince: timestamp("failing_since", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("slack_connections_team_idx").on(t.teamId)],
);

/** An answer the user's agent drafted for an inbound reply. Sent only when a human approves it. */
export const replyDrafts = pgTable(
  "reply_drafts",
  {
    id: id(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    replyId: uuid("reply_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: text("status").$type<"pending" | "sent" | "discarded">().notNull().default("pending"),
    sentMessageId: uuid("sent_message_id").references(() => messages.id, { onDelete: "set null" }),
    /** The Slack message that shows this draft (channel + ts), so approving from anywhere can update it. */
    slackChannel: text("slack_channel"),
    slackTs: text("slack_ts"),
    slackNotifiedAt: timestamp("slack_notified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // At most one pending draft per reply; drafting again replaces it.
  (t) => [uniqueIndex("reply_drafts_pending_idx").on(t.replyId).where(sql`${t.status} = 'pending'`)],
);

// --- OAuth for remote MCP clients (Claude Code, Cursor, Codex) and the CLI ---
// Meerko is the authorization server: clients register themselves (RFC 7591), the user approves them on
// the dashboard's consent page, and they get short-lived access tokens plus a rotating refresh token.

/** A registered app. Public clients only (PKCE, no secret), as the MCP authorization spec expects. */
export const oauthClients = pgTable("oauth_clients", {
  id: id(),
  name: text("name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: createdAt(),
});

/** One-time authorization codes, exchanged at the token endpoint with the PKCE verifier. */
export const oauthCodes = pgTable("oauth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: uuid("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** An app's access to a workspace (shown under Settings → Connected apps). Tokens are stored hashed. */
export const oauthGrants = pgTable(
  "oauth_grants",
  {
    id: id(),
    clientId: uuid("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    accessHash: text("access_hash").notNull().unique(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshHash: text("refresh_hash").notNull().unique(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("oauth_grants_workspace_idx").on(t.workspaceId)],
);
