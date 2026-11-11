/**
 * The /v1 contract. The routes in app.ts validate with the request schemas below, and spec.ts publishes the same
 * objects as OpenAPI, so what the docs say a route accepts is what it accepts.
 *
 * The response schemas describe what the routes return. They mirror the types in @meerko/sdk, which every surface
 * (web, CLI, MCP) reads responses through.
 */
import { z } from "zod";
import { AGENT_INTENTS, BYOK_PROVIDERS, MAX_CREDIT_PACKS } from "@meerko/core";
import { API_KEY_SCOPES, CRM_PROVIDERS, ROUTINE_RUN_OUTCOMES, ROUTINE_STATUSES, ROUTINE_TRIGGERS, ROUTINE_WHENS, STAGES } from "@meerko/db";

// --- Requests ---

const jsonObject = z.record(z.string(), z.unknown());

export const columnType = z.enum(["text", "number", "email", "url", "boolean", "json"]);
export const columnInput = z.object({
  name: z.string().min(1),
  type: columnType.default("text"),
  prompt: z.string().min(1).optional().describe("Makes it an AI column: an instruction filled in for each row by your agent"),
});
export const updateRowsInput = z.object({
  updates: z.array(z.object({ id: z.string(), data: jsonObject })).max(1000),
});
export const createTableInput = z.object({ name: z.string().min(1), columns: z.array(columnInput).optional() });
export const insertRowsInput = z.object({ rows: z.array(jsonObject).max(10_000) });
export const deleteRowsInput = z.object({ row_ids: z.array(z.string()).min(1).max(1000) });
export const moveStageInput = z.object({ row_ids: z.array(z.string()).min(1).max(1000), stage: z.enum(STAGES) });
export const queryInput = z.object({
  filter: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return undefined;
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      } catch {}
      ctx.addIssue({ code: "custom", message: "filter must be a JSON object, e.g. {\"country\":\"Spain\"}" });
      return z.NEVER;
    })
    .describe('A JSON object matched against row data, e.g. {"country":"Spain"}'),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  stage: z.enum(STAGES).optional(),
});
// Filters are passed through to Icypeas, which validates field names and shapes itself.
const leadQuery = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .refine((q) => Object.keys(q).length > 0, { message: "query needs at least one filter" })
  .describe('Icypeas filters, e.g. {"currentJobTitle":{"include":["CTO"]},"currentCompany.headcount":{">=":20}}');
export const searchInput = z.object({
  query: leadQuery,
  // Hard cap per call to bound credit spend until the credit ledger lands.
  limit: z.number().int().min(1).max(1000).default(25),
  table_id: z.string().optional().describe("Add the leads to this table"),
  table_name: z.string().min(1).optional().describe("Or create a table with this name"),
});
export const countInput = z.object({ query: leadQuery });
export const websiteInput = z.object({ url: z.string().min(1).max(500).describe("The website, e.g. acme.com") });
const stepInput = z.object({
  subject: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(20_000),
  delay_days: z.number().int().min(0).max(60).optional(),
});
const sequenceFields = {
  name: z.string().min(1).max(200),
  // The mailbox pool. `mailbox_id` (one mailbox) is still accepted from older clients.
  mailbox_ids: z.array(z.string()).min(1).max(50).optional().describe("The mailbox pool: each lead gets one and keeps it for every step"),
  mailbox_id: z.string().optional().describe("Deprecated: use mailbox_ids"),
  assignment: z.enum(["capacity", "even"]).optional().describe("How new leads are spread over the pool. Default \"capacity\""),
  steps: z
    .array(stepInput)
    .min(1)
    .max(10)
    .describe("1–10 emails: { subject?, body, delay_days? }. The first needs a subject; follow-ups reply in the same thread. {{var}} fills in row data, and rows missing a used variable are skipped at enrollment"),
  timezone: z.string().optional(),
  window_start_hour: z.number().int().min(0).max(23).optional(),
  window_end_hour: z.number().int().min(1).max(24).optional(),
};
export const createSequenceInput = z
  .object({ table_id: z.string(), ...sequenceFields })
  .refine((i) => i.mailbox_ids?.length || i.mailbox_id, { message: "mailbox_ids is required" });
export const updateSequenceInput = z.object(sequenceFields).partial();
export const toSequenceInput = (i: z.infer<typeof updateSequenceInput>) => ({
  name: i.name,
  mailboxIds: i.mailbox_ids ?? (i.mailbox_id ? [i.mailbox_id] : undefined),
  assignment: i.assignment,
  steps: i.steps?.map((s) => ({ subject: s.subject, body: s.body, delayDays: s.delay_days })),
  timezone: i.timezone,
  windowStartHour: i.window_start_hour,
  windowEndHour: i.window_end_hour,
});
export const previewQuery = z.object({ row_id: z.string().optional() });
export const enrollInput = z.object({
  row_ids: z.array(z.string()).max(5000).optional(),
  filter: jsonObject.optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});
export const enrichInput = z.object({
  fields: z
    .array(z.enum(["email", "email_verification", "phone"]))
    .min(1)
    .default(["email", "email_verification"])
    .describe("phone is opt-in (80 credits per number found, Pro on Meerko Cloud); the default finds and verifies emails"),
  filter: jsonObject.optional(),
  row_ids: z.array(z.string()).max(1000).optional().describe("Only these rows"),
  min_icp_score: z.number().int().min(0).max(100).optional().describe("Only rows whose ICP fit is at least this (0-100); needs an ICP"),
  // Rows are enriched synchronously, one at a time (~3s each), so keep calls small.
  limit: z.number().int().min(1).max(50).default(25),
  overwrite: z.boolean().default(false),
});
export const workspaceNameInput = z.object({ name: z.string().trim().min(1).max(80).describe("What the workspace (a brand) is called") });
export const switchWorkspaceInput = z.object({ workspace_id: z.string().describe("One of the ids from GET /workspaces") });
export const oauthRequestInput = z.object({ request: z.string().min(1) });
export const oauthDecideInput = oauthRequestInput.extend({ approve: z.boolean() });
export const createApiKeyInput = z.object({ name: z.string().trim().min(1).max(100), scope: z.enum(API_KEY_SCOPES).default("full") });
export const digestInput = z.object({ enabled: z.boolean() });
export const SIGNUP_ROLES = ["founder", "gtm", "agency", "other"] as const;
export const COMPANY_SIZES = ["1", "2-10", "11-50", "51-200", "201+"] as const;
export const SIGNUP_AGENTS = ["claude", "chatgpt", "claude_code", "codex", "cursor", "other", "none"] as const;
export const profileInput = z.object({
  role: z.enum(SIGNUP_ROLES).optional(),
  company_size: z.enum(COMPANY_SIZES).optional(),
  agent: z.enum(SIGNUP_AGENTS).optional(),
});

const cadence = z
  .object({
    days: z.array(z.number().int().min(1).max(7)).min(1).describe("ISO weekdays: 1 = Monday … 7 = Sunday"),
    time: z.string().describe("HH:MM, 24-hour, in `timezone`"),
    timezone: z.string().describe("IANA zone, e.g. Europe/Madrid"),
  })
  .describe("When a scheduled routine is due");
export const createRoutineInput = z.object({
  name: z.string().trim().min(1).max(80),
  brief: z.string().trim().min(1).max(4000).describe("What the AI does on each run, in plain words"),
  when: z.enum(ROUTINE_WHENS).describe("`replies`: when new replies wait (one per workspace). `schedule`: on `cadence`"),
  cadence: cadence.optional().describe("Required for `schedule`"),
});
export const updateRoutineInput = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  brief: z.string().trim().min(1).max(4000).optional(),
  when: z.enum(ROUTINE_WHENS).optional(),
  cadence: cadence.optional(),
  status: z.enum(ROUTINE_STATUSES).optional().describe("`paused` stops it; `active` resumes it from now"),
});
export const routineTriggerInput = z.object({
  kind: z.enum(ROUTINE_TRIGGERS).describe("`own_scheduler`: your AI's scheduled task starts it. `claude_routine`, `webhook`: Meerko does"),
  url: z.string().trim().max(2000).optional().describe("The Claude routine's API trigger URL, or your webhook's URL"),
  token: z.string().trim().max(2000).optional().describe("The Claude routine's API trigger token. Leave out to keep the saved one for the same URL"),
});
export const slackWebhookInput = z.object({ url: z.string().trim().min(1).max(2000) });
export const checkoutInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pro"), interval: z.enum(["month", "year"]).default("month").describe("year: $490 a year, with the founding offer applied while places are left") }),
  z.object({ kind: z.literal("credits"), packs: z.number().int().min(1).max(MAX_CREDIT_PACKS).default(1) }),
]);
export const gmailAppPasswordInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(100).describe("A Google app password, entered by a person: agents must never handle it"),
  login: z.string().email().optional().nullable(),
  display_name: z.string().max(100).optional().nullable(),
});
export const imapMailboxInput = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  login: z.string().min(1).max(200).optional().nullable(),
  display_name: z.string().max(100).optional().nullable(),
  imap_host: z.string().min(1).max(253),
  imap_port: z.number().int().default(993),
  smtp_host: z.string().min(1).max(253),
  smtp_port: z.number().int().default(465),
});
export const oauthConnectInput = z.object({ login_hint: z.string().email().optional(), return_to: z.string().url().optional() });
export const updateMailboxInput = z.object({
  daily_limit: z.number().int().min(1).max(500).optional(),
  display_name: z.string().max(100).nullable().optional(),
  ramp: z.boolean().optional(),
  resume: z.literal(true).optional().describe("Lift a hold Meerko put on the mailbox (heldAt) after too many bounces or spam rejections"),
});
export const testEmailInput = z.object({ to: z.string().email() });
export const listRepliesQuery = z.object({
  sequence_id: z.string().optional(),
  intent: z.string().optional(),
  unclassified: z.enum(["true", "false"]).optional(),
  include_automatic: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const classifyInput = z.object({ intent: z.enum(AGENT_INTENTS), handled: z.boolean().optional() });
const approvalMode = z.enum(["approve", "auto"]);
export const sendingModeInput = z
  .object({
    sequence_emails: approvalMode.optional().describe("approve: a person approves each sequence email before it goes. auto: Meerko sends them on schedule"),
    reply_drafts: approvalMode.optional().describe("approve: drafts wait for a person. auto: a draft is sent as soon as it's saved"),
  })
  .refine((v) => v.sequence_emails || v.reply_drafts, { message: "Set sequence_emails, reply_drafts or both" });
export const SendingMode = z.object({ sequence_emails: approvalMode, reply_drafts: approvalMode });
export const pendingEmailsQuery = z.object({
  sequence_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export const approveEmailsInput = z
  .object({
    enrollment_ids: z.array(z.string()).max(1000).optional().describe("Approve these leads' next email"),
    sequence_id: z.string().optional().describe("Approve the next email of every lead waiting in this sequence"),
  })
  .refine((v) => v.enrollment_ids?.length || v.sequence_id, { message: "Pass enrollment_ids or sequence_id" });
export const PendingEmail = z.object({
  enrollment_id: z.string(),
  sequence_id: z.string(),
  sequence_name: z.string(),
  to: z.string(),
  step: z.number(),
  subject: z.string(),
  body: z.string(),
  send_at: z.string().nullable(),
});

export const draftInput = z.object({ body: z.string().min(1).max(20_000) });
export const listDraftsQuery = z.object({ status: z.enum(["pending", "sent", "discarded"]).optional() });
export const approveDraftInput = z.object({ body: z.string().min(1).max(20_000).optional().describe("Send this instead of the saved draft") });
export const pipelineQuery = z.object({ table_id: z.string().optional() });
export const byokProvider = z.enum(BYOK_PROVIDERS);
export const providerKeyInput = z.object({ key: z.string().min(8) });
export const crmConnectInput = z.object({
  provider: z.enum(CRM_PROVIDERS),
  token: z.string().trim().min(8).max(500).describe("A HubSpot private app token or an Attio API key, entered by a person"),
  auto_sync: z.boolean().optional().describe("Push leads automatically once Meerko has contacted them. Defaults to true"),
});
export const crmUpdateInput = z.object({ auto_sync: z.boolean() });
export const crmSyncInput = z.object({
  row_ids: z.array(z.string()).min(1).max(100).optional().describe("Only these rows (up to 100). Without it, every row not yet pushed or changed since, 100 per call"),
});

// --- Responses (mirroring @meerko/sdk) ---

const ts = z.string().describe("ISO 8601 timestamp");
const nts = ts.nullable();
const stage = z.enum(STAGES);
const counts = z.record(z.string(), z.number());

export const ApiError = z.object({ error: z.string() });

export const Column = z.object({ key: z.string(), name: z.string(), type: columnType, prompt: z.string().optional() });
export const Table = z.object({ id: z.string(), name: z.string(), columns: z.array(Column), rowCount: z.number(), createdAt: ts });
export const IcpFit = z.object({
  score: z.number().nullable().describe("0-100; null without an ICP or data to compare"),
  base: z.number().nullable().describe("The rules-only score, before the agent's adjustment"),
  checks: z.array(z.object({ criterion: z.enum(["industry", "headcount", "country", "title", "keywords", "exclude"]), matched: z.boolean(), detail: z.string() })),
  adjust: z.number().nullable(),
  note: z.string().nullable(),
  reason: z.string().nullable().describe("One line on why: the agent's note, else what matched and what didn't"),
});
export const Row = z.object({ id: z.string(), data: jsonObject, stage, stageChangedAt: nts, createdAt: ts, icp: IcpFit.describe("How well the lead fits the workspace ICP") });
export const PendingCells = z.object({
  column: z.string(),
  prompt: z.string(),
  remaining: z.number(),
  rows: z.array(z.object({ id: z.string(), instruction: z.string(), data: jsonObject })),
});
export const SearchResult = z.object({
  tableId: z.string(),
  tableName: z.string(),
  total: z.number(),
  inserted: z.number(),
  addedColumns: z.array(Column),
  creditsSpent: z.number(),
  cappedByCredits: z.boolean().optional(),
});
export const EnrichResult = z.object({
  processed: z.number(),
  found: z.object({ email: z.number(), email_verification: z.number(), phone: z.number() }),
  notFound: z.number(),
  errors: z.number(),
  firstError: z.string().optional(),
  creditsSpent: z.number(),
  remaining: z.number(),
  stoppedReason: z.literal("insufficient_credits").optional(),
  balance: z.number().optional(),
});
export const Me = z.object({
  user: z.object({ id: z.string(), email: z.string(), name: z.string().nullable(), role: z.string() }).nullable(),
  workspace: z.object({ id: z.string(), name: z.string() }),
});
export const Workspace = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["owner", "member"]).nullable().describe("Null for an API key, which belongs to the workspace rather than a person"),
});
export const WorkspaceListItem = Workspace.extend({ current: z.boolean().describe("The workspace this credential acts on now") });
export const ApiKey = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scope: z.enum(API_KEY_SCOPES),
  lastUsedAt: nts,
  createdAt: ts,
});
export const Digest = z.object({
  /** Only workspace owners get the digest. */
  eligible: z.boolean(),
  enabled: z.boolean(),
  last_sent_at: z.string().nullable(),
});

export const RoutineRun = z.object({
  id: z.string(),
  dueAt: nts.describe("The scheduled time it ran for; null for replies, Run it now and runs the AI started itself"),
  reason: z.string().describe("`schedule`, `replies`, `manual` (Run it now) or `ai`"),
  outcome: z.enum(ROUTINE_RUN_OUTCOMES),
  firedAt: nts,
  startedAt: nts.describe("When the AI checked in with start_routine_run"),
  httpStatus: z.number().nullable(),
  error: z.string().nullable(),
  replies: z.number().nullable(),
  sessionUrl: z.string().nullable(),
  createdAt: ts,
});
export const RoutineSetup = z.object({
  howItRuns: z.string(),
  prompt: z.string().optional(),
  setupPrompt: z.string().optional(),
  steps: z.array(z.object({ client: z.string(), text: z.string() })).optional(),
});
export const Routine = z.object({
  id: z.string(),
  name: z.string(),
  brief: z.string(),
  when: z.enum(ROUTINE_WHENS),
  cadence: cadence.nullable(),
  schedule: z.string().describe("In words: \"Weekdays at 09:00 (Europe/Madrid)\""),
  status: z.enum(ROUTINE_STATUSES),
  statusReason: z.string().nullable(),
  trigger: z.enum(ROUTINE_TRIGGERS),
  triggerUrl: z.string().nullable(),
  secretLast4: z.string().nullable(),
  needsSetup: z.boolean(),
  nextDueAt: nts,
  lastFiredAt: nts,
  lastError: z.string().nullable(),
  createdAt: ts,
  updatedAt: ts,
  runs: z.array(RoutineRun).describe("The latest runs, newest first"),
  setup: RoutineSetup,
});
export const RoutineStart = z.object({
  run_id: z.string(),
  routine: z.object({ id: z.string(), name: z.string(), when: z.enum(ROUTINE_WHENS), schedule: z.string() }),
  brief: z.string(),
  instructions: z.string(),
});
export const CrmConnection = z.object({
  provider: z.enum(CRM_PROVIDERS),
  last4: z.string(),
  accountName: z.string().nullable(),
  autoSync: z.boolean(),
  lastSyncedAt: nts,
  lastError: z.string().nullable(),
  createdAt: ts,
});
export const CrmSyncResult = z.object({
  provider: z.enum(CRM_PROVIDERS),
  synced: z.number().int(),
  skipped: z.number().int().describe("Rows without a usable email: CRMs match contacts by email"),
  failed: z.number().int(),
  remaining: z.number().int().describe("Rows still waiting; call again to continue"),
  errors: z.array(z.string()),
});
export const SlackConnection = z.object({
  kind: z.enum(["app", "webhook"]),
  teamName: z.string().nullable(),
  channelName: z.string().nullable(),
  enabled: z.boolean(),
  lastPostedAt: nts,
  lastError: z.string().nullable(),
  createdAt: ts,
});
const server = z.object({ host: z.string(), port: z.number() });
export const Mailbox = z.object({
  id: z.string(),
  provider: z.enum(["gmail", "gmail_imap", "imap", "outlook"]),
  email: z.string(),
  login: z.string().nullable(),
  servers: z.object({ imap: server, smtp: server }).nullable(),
  displayName: z.string().nullable(),
  dailyLimit: z.number(),
  rampStartedAt: nts,
  effectiveLimit: z.number().describe("What it may send in the next 24 hours: lower than dailyLimit while ramping"),
  rampDay: z.number().nullable(),
  status: z.enum(["active", "error"]),
  lastError: z.string().nullable(),
  heldAt: nts.describe("Set while Meerko holds the mailbox for bounces or spam rejections: it sends nothing until resumed"),
  holdReason: z.enum(["bounces", "rejections"]).nullable(),
  holdDetail: z.string().nullable().describe('What tripped the hold, e.g. "6 hard bounces in 80 emails over 7 days (7.5%)"'),
  createdAt: ts,
});
const dns = z.enum(["pass", "missing", "managed"]);
export const DomainHealth = z.object({ domain: z.string(), spf: dns, dkim: dns, dmarc: dns });
const assignment = z.enum(["capacity", "even"]);
export const Sequence = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["draft", "active", "paused"]),
  tableId: z.string(),
  mailboxIds: z.array(z.string()),
  assignment,
  timezone: z.string(),
  windowStartHour: z.number(),
  windowEndHour: z.number(),
  steps: z.array(z.object({ position: z.number(), delayDays: z.number(), subject: z.string().nullable(), body: z.string() })),
});
export const SequenceSummary = Sequence.omit({ steps: true, timezone: true, windowStartHour: true, windowEndHour: true }).extend({ enrolled: z.number() });
export const SequencePreview = z.object({
  rowId: z.string(),
  to: z.string().nullable(),
  missingVars: z.array(z.string()),
  steps: z.array(z.object({ position: z.number(), delayDays: z.number(), subject: z.string(), body: z.string() })),
});
export const EnrollResult = z.object({ enrolled: z.number(), skipped: counts, byMailbox: counts });
export const SequencePool = z.object({
  assignment,
  sentToday: z.number(),
  capacityToday: z.number(),
  mailboxes: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string().nullable(),
      status: z.enum(["active", "error"]),
      held: z.boolean().describe("Paused by Meerko for bounces or spam rejections; resume it from the mailbox"),
      dailyLimit: z.number(),
      effectiveLimit: z.number(),
      rampDay: z.number().nullable(),
      sentToday: z.number(),
      leads: z.number(),
    }),
  ),
});
export const SequenceStats = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  enrolled: z.number(),
  remaining: z.number(),
  emailsSent: z.number(),
  states: counts,
  replyRate: z.number(),
  steps: z.array(z.object({ position: z.number(), sent: z.number(), repliedAfter: z.number() })),
});
export const Recipient = z.object({
  enrollmentId: z.string(),
  rowId: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  company: z.string().nullable(),
  mailboxEmail: z.string().nullable(),
  state: z.enum(["active", "completed", "replied", "unsubscribed", "bounced", "stopped", "failed"]),
  stepsSent: z.number(),
  nextSendAt: nts,
  lastError: z.string().nullable(),
  lastSentAt: nts,
});
const ThreadMessage = z.object({
  id: z.string(),
  direction: z.enum(["in", "out"]),
  step: z.number().nullable(),
  subject: z.string().nullable(),
  body: z.string(),
  sentAt: ts,
});
export const Reply = z.object({
  id: z.string(),
  from: z.string(),
  subject: z.string().nullable(),
  body: z.string(),
  intent: z.string().nullable(),
  receivedAt: ts,
  handledAt: nts,
  sequenceId: z.string().nullable(),
  sequenceName: z.string().nullable(),
  row: jsonObject.nullable(),
  thread: z.array(ThreadMessage),
});
export const Draft = z.object({
  id: z.string(),
  body: z.string(),
  status: z.enum(["pending", "sent", "discarded"]),
  updatedAt: ts,
  replyId: z.string(),
  to: z.string(),
  replySubject: z.string().nullable(),
  replyBody: z.string(),
  intent: z.string().nullable(),
  row: jsonObject.nullable(),
  thread: z.array(ThreadMessage),
});
export const ConnectedApp = z.object({ id: z.string(), name: z.string(), userEmail: z.string(), createdAt: ts, lastUsedAt: nts });
export const Billing = z.union([
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    plan: z.enum(["free", "pro"]),
    status: z.string().nullable(),
    current_period_end: nts,
    cancel_at_period_end: z.boolean(),
    has_customer: z.boolean(),
    balance: z.number(),
    pro_monthly_credits: z.number(),
    credit_pack: z.number(),
    interval: z.enum(["month", "year"]).nullable().describe("How the current Pro subscription is billed"),
    prices: z.object({ month: z.number(), year: z.number().nullable().describe("Null when annual Pro isn't sold here") }).describe("Pro in US dollars"),
    founding_offer: z
      .object({ percent_off: z.number(), left: z.number(), until: ts })
      .nullable()
      .describe("Off the first year of annual Pro, applied at checkout. `until` is this workspace's deadline: 30 days from when it was first shown the offer, at most Dec 31 2026. Null when sold out, past the deadline, on Pro, or not offered"),
  }),
]);
export const Credits = z.object({
  enabled: z.boolean(),
  balance: z.number().nullable(),
  plan: z.enum(["free", "pro"]).optional(),
  buy_url: z.string().optional().describe("Where a person tops up"),
});
export const Pipeline = z.object({ tableId: z.string().nullable(), stages: z.record(stage, z.number()), total: z.number() });
export const ProviderKey = z.object({ provider: z.string(), last4: z.string(), createdAt: ts });
export const Url = z.object({ url: z.string() });

export const Website = z.object({
  url: z.string().describe("The page read, after redirects"),
  title: z.string().nullable(),
  description: z.string().nullable(),
  headings: z.array(z.string()),
  text: z.string().describe("Visible text, capped at 6,000 characters"),
  truncated: z.boolean(),
});

const icpList = z.array(z.string().trim().min(1).max(120)).max(50);
export const icpInput = z.object({
  summary: z.string().trim().max(500).optional().describe("One line: who you sell to, e.g. 'Owner-run consumer brands that sell on Instagram'"),
  industries: icpList.optional().describe("LinkedIn industry names, e.g. 'Software Development'"),
  countries: z.array(z.string().trim().regex(/^[A-Za-z]{2}$/)).max(50).optional().describe("Alpha-2 country codes, e.g. ES, US"),
  headcount: z.object({ min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() }).optional().describe("Company size range"),
  titles: icpList.optional().describe("Buyer job titles, in every language you sell in"),
  keywords: icpList.optional().describe("Words a good fit's description or title mentions"),
  exclude: icpList.optional().describe("Words that rule a lead out, e.g. 'agency', 'Intern'"),
});
export const Icp = icpInput;

export const icpReviewInput = z.object({
  rows: z
    .array(z.object({ row_id: z.string(), adjust: z.number().int().min(-30).max(30).nullable().describe("Move the score by up to ±30; null clears it"), note: z.string().max(300).optional().describe("Why, in one line") }))
    .min(1)
    .max(200),
});
