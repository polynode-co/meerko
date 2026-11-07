/**
 * Every /v1 route, once: what it takes, what it returns, and who may call it. spec.test.ts fails when a route is
 * registered on the app without an entry here, or an entry names a route that doesn't exist, so this list is the API.
 *
 * openapi.ts builds the public OpenAPI document from it (`pnpm api:spec`), and app.ts derives the routes a
 * `replies`-scoped credential may call from `scope`.
 */
import { z } from "zod";
import * as s from "./schemas.ts";

export type Method = "get" | "post" | "put" | "patch" | "delete";

export interface Operation {
  method: Method;
  /** Hono-style, relative to /v1: `/tables/:id`. */
  path: string;
  /** Stable name for SDK generators and the docs. */
  id: string;
  tag: Tag;
  summary: string;
  description?: string;
  /**
   * `any`: an API key, an OAuth app or a dashboard session. `user`: a person signed in to the dashboard (so a leaked
   * key can't mint keys or rewire where replies go). `owner`: a signed-in workspace owner. `person`: a session or an
   * OAuth app acting for someone (the hosted MCP, the CLI's browser sign-in), but not an API key, which belongs to one
   * workspace. Only `any` routes are
   * in the public document; the rest exist for the dashboard.
   */
  access: "any" | "person" | "user" | "owner";
  /** `replies`: also callable by a replies-scoped key (an agent woken by an agent hook). */
  scope?: "replies";
  query?: z.ZodObject;
  body?: z.ZodType;
  /** Defaults to 200. */
  status?: number;
  /** `null`: no body (204). */
  response: z.ZodType | null;
}

export const TAGS = {
  workspace: "Who the credential acts as, and the workspaces (brands) a person moves between",
  tables: "Tables of leads and their rows",
  leads: "Finding people and companies, and enriching rows with emails",
  mailboxes: "Mailboxes that send sequences and receive replies",
  sequences: "Multi-step email sequences",
  replies: "Replies to sequences, and the drafts answering them",
  credits: "Credits and the BYOK provider keys that bypass them",
  settings: "API keys, connected apps, agent hook, Slack and billing",
} as const;
export type Tag = keyof typeof TAGS;

const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape);
const deleted = obj({ deleted: z.boolean() });

export const V1: Operation[] = [
  // --- workspace ---
  { method: "get", path: "/me", id: "getMe", tag: "workspace", summary: "The workspace (and person, for a session) this credential acts as", access: "any", scope: "replies", response: s.Me },
  { method: "get", path: "/workspaces", id: "listWorkspaces", tag: "workspace", summary: "List your workspaces, marking the current one", description: "An API key sees only its own workspace.", access: "any", response: obj({ workspaces: z.array(s.WorkspaceListItem) }) },
  { method: "post", path: "/workspaces", id: "createWorkspace", tag: "workspace", summary: "Create a workspace for another brand", description: "It shares the plan and credits of the workspaces you already own. It doesn't switch to it.", access: "person", body: s.workspaceNameInput, status: 201, response: obj({ workspace: s.Workspace }) },
  { method: "patch", path: "/workspaces/:id", id: "renameWorkspace", tag: "workspace", summary: "Rename a workspace (owners)", access: "person", body: s.workspaceNameInput, response: obj({ workspace: s.Workspace }) },
  { method: "post", path: "/workspaces/switch", id: "switchWorkspace", tag: "workspace", summary: "Point this session or app connection at another of your workspaces", description: "Only the credential the request came in on moves; other tabs and agents stay where they are.", access: "person", body: s.switchWorkspaceInput, response: obj({ workspace: s.Workspace }) },

  // --- tables ---
  { method: "get", path: "/tables", id: "listTables", tag: "tables", summary: "List tables", access: "any", response: obj({ tables: z.array(s.Table) }) },
  { method: "post", path: "/tables", id: "createTable", tag: "tables", summary: "Create a table", access: "any", body: s.createTableInput, status: 201, response: obj({ table: s.Table }) },
  { method: "get", path: "/tables/:id", id: "getTable", tag: "tables", summary: "Get a table and its columns", access: "any", response: obj({ table: s.Table }) },
  { method: "delete", path: "/tables/:id", id: "deleteTable", tag: "tables", summary: "Delete a table, its rows and its sequences", access: "any", response: obj({ deleted: z.boolean(), rows: z.number(), sequences: z.number() }) },
  { method: "post", path: "/tables/:id/columns", id: "addColumn", tag: "tables", summary: "Add a column (with `prompt`, an AI column)", access: "any", body: s.columnInput, response: obj({ table: s.Table }) },
  { method: "get", path: "/tables/:id/columns/:column/pending", id: "getPendingCells", tag: "tables", summary: "Rows whose AI column is still empty, with the instruction for each", access: "any", query: s.queryInput, response: s.PendingCells },
  { method: "get", path: "/tables/:id/rows", id: "queryRows", tag: "tables", summary: "Query rows", access: "any", query: s.queryInput, response: obj({ rows: z.array(s.Row) }) },
  { method: "post", path: "/tables/:id/rows", id: "insertRows", tag: "tables", summary: "Insert rows; unknown keys become new columns", access: "any", body: s.insertRowsInput, status: 201, response: obj({ inserted: z.number(), addedColumns: z.array(s.Column) }) },
  { method: "patch", path: "/tables/:id/rows", id: "updateRows", tag: "tables", summary: "Update row data", access: "any", body: s.updateRowsInput, response: obj({ updated: z.number(), addedColumns: z.array(s.Column) }) },
  { method: "post", path: "/tables/:id/rows/delete", id: "deleteRows", tag: "tables", summary: "Delete rows", description: "POST rather than DELETE with a body, which some HTTP clients drop.", access: "any", body: s.deleteRowsInput, response: obj({ deleted: z.number() }) },
  { method: "post", path: "/tables/:id/rows/stage", id: "moveStage", tag: "tables", summary: "Move rows to a pipeline stage", access: "any", body: s.moveStageInput, response: obj({ moved: z.number() }) },
  { method: "get", path: "/pipeline", id: "getPipeline", tag: "tables", summary: "Rows per pipeline stage, for one table or all", access: "any", query: s.pipelineQuery, response: s.Pipeline },

  // --- leads ---
  { method: "post", path: "/search/people/count", id: "countPeople", tag: "leads", summary: "Count people matching a search (free)", access: "any", body: s.countInput, response: obj({ total: z.number() }) },
  { method: "post", path: "/search/people", id: "searchPeople", tag: "leads", summary: "Find people and add them to a table (spends credits)", access: "any", body: s.searchInput, status: 201, response: s.SearchResult },
  { method: "post", path: "/search/companies/count", id: "countCompanies", tag: "leads", summary: "Count companies matching a search (free)", access: "any", body: s.countInput, response: obj({ total: z.number() }) },
  { method: "post", path: "/websites/read", id: "readWebsite", tag: "leads", summary: "Read a website's text, to work out who it sells to (free)", description: "Meerko fetches the home page and returns its text; your agent decides the ideal customer from it. Public sites only.", access: "any", body: s.websiteInput, response: s.Website },
  { method: "post", path: "/search/companies", id: "searchCompanies", tag: "leads", summary: "Find companies and add them to a table (spends credits)", access: "any", body: s.searchInput, status: 201, response: s.SearchResult },
  { method: "post", path: "/tables/:id/enrich", id: "enrichRows", tag: "leads", summary: "Find and verify emails, or find phone numbers, for rows (spends credits)", access: "any", body: s.enrichInput, response: s.EnrichResult },

  // --- mailboxes ---
  { method: "get", path: "/mailboxes", id: "listMailboxes", tag: "mailboxes", summary: "List mailboxes", access: "any", response: obj({ mailboxes: z.array(s.Mailbox) }) },
  { method: "get", path: "/mailboxes/connect", id: "mailboxConnectOptions", tag: "mailboxes", summary: "How this server connects mailboxes, and where a person enters a password", access: "any", response: obj({ oauth: z.boolean(), outlook: z.boolean(), url: z.string().nullable() }) },
  { method: "post", path: "/mailboxes/gmail/app-password", id: "connectGmailAppPassword", tag: "mailboxes", summary: "Connect Gmail with an app password", access: "any", body: s.gmailAppPasswordInput, status: 201, response: obj({ mailbox: s.Mailbox }) },
  { method: "post", path: "/mailboxes/imap", id: "connectImapMailbox", tag: "mailboxes", summary: "Connect any IMAP/SMTP mailbox", access: "any", body: s.imapMailboxInput, status: 201, response: obj({ mailbox: s.Mailbox }) },
  { method: "post", path: "/mailboxes/gmail/connect", id: "connectGmail", tag: "mailboxes", summary: "Start connecting Gmail through Google's consent screen (when the server enables it)", access: "any", body: s.oauthConnectInput, response: s.Url },
  { method: "post", path: "/mailboxes/outlook/connect", id: "connectOutlook", tag: "mailboxes", summary: "Start connecting Outlook / Microsoft 365", access: "any", body: s.oauthConnectInput, response: s.Url },
  { method: "get", path: "/mailboxes/health", id: "mailboxHealth", tag: "mailboxes", summary: "SPF, DKIM and DMARC for each sending domain", access: "any", response: obj({ domains: z.array(s.DomainHealth) }) },
  { method: "patch", path: "/mailboxes/:id", id: "updateMailbox", tag: "mailboxes", summary: "Change a mailbox's daily limit, name or ramp-up", access: "any", body: s.updateMailboxInput, response: obj({ mailbox: s.Mailbox }) },
  { method: "delete", path: "/mailboxes/:id", id: "deleteMailbox", tag: "mailboxes", summary: "Disconnect a mailbox", access: "any", response: deleted },
  { method: "post", path: "/mailboxes/:id/test", id: "sendTestEmail", tag: "mailboxes", summary: "Send a test email from a mailbox", access: "any", body: s.testEmailInput, response: obj({ sent: z.boolean(), messageId: z.string().nullable() }) },

  // --- sequences ---
  { method: "get", path: "/sequences", id: "listSequences", tag: "sequences", summary: "List sequences", access: "any", response: obj({ sequences: z.array(s.SequenceSummary) }) },
  { method: "post", path: "/sequences", id: "createSequence", tag: "sequences", summary: "Create a sequence (as a draft)", access: "any", body: s.createSequenceInput, status: 201, response: obj({ sequence: s.Sequence }) },
  { method: "get", path: "/sequences/:id", id: "getSequence", tag: "sequences", summary: "Get a sequence and its steps", access: "any", response: obj({ sequence: s.Sequence }) },
  { method: "patch", path: "/sequences/:id", id: "updateSequence", tag: "sequences", summary: "Change a sequence's steps, mailboxes or sending window", access: "any", body: s.updateSequenceInput, response: obj({ sequence: s.Sequence }) },
  { method: "get", path: "/sequences/:id/preview", id: "previewSequence", tag: "sequences", summary: "Render each step for one row, with any missing variables", access: "any", query: s.previewQuery, response: s.SequencePreview },
  { method: "post", path: "/sequences/:id/enroll", id: "enrollRows", tag: "sequences", summary: "Enroll rows, by id or filter", access: "any", body: s.enrollInput, response: s.EnrollResult },
  { method: "post", path: "/sequences/:id/start", id: "startSequence", tag: "sequences", summary: "Start sending", access: "any", response: obj({ sequence: s.Sequence }) },
  { method: "post", path: "/sequences/:id/pause", id: "pauseSequence", tag: "sequences", summary: "Pause sending", access: "any", response: obj({ sequence: s.Sequence }) },
  { method: "get", path: "/sequences/:id/pool", id: "sequencePool", tag: "sequences", summary: "The sequence's mailboxes and today's sending", access: "any", response: s.SequencePool },
  { method: "get", path: "/sequences/:id/stats", id: "sequenceStats", tag: "sequences", summary: "Sent, replied and per-step numbers", access: "any", response: s.SequenceStats },
  { method: "get", path: "/sequences/:id/recipients", id: "sequenceRecipients", tag: "sequences", summary: "Everyone enrolled and where they are", access: "any", response: obj({ recipients: z.array(s.Recipient) }) },

  // --- replies ---
  { method: "get", path: "/replies", id: "listReplies", tag: "replies", summary: "List replies, with their threads", access: "any", scope: "replies", query: s.listRepliesQuery, response: obj({ replies: z.array(s.Reply) }) },
  { method: "post", path: "/replies/:id/classify", id: "classifyReply", tag: "replies", summary: "Set a reply's intent", access: "any", scope: "replies", body: s.classifyInput, response: obj({ reply: obj({ id: z.string(), intent: z.string(), handledAt: z.string().nullable() }) }) },
  { method: "post", path: "/replies/:id/draft", id: "draftReply", tag: "replies", summary: "Save a draft answer for a person to approve", access: "any", scope: "replies", body: s.draftInput, status: 201, response: obj({ draft: obj({ id: z.string(), body: z.string() }) }) },
  { method: "get", path: "/drafts", id: "listDrafts", tag: "replies", summary: "List drafts", access: "any", scope: "replies", query: s.listDraftsQuery, response: obj({ drafts: z.array(s.Draft) }) },
  { method: "post", path: "/drafts/:id/approve", id: "approveDraft", tag: "replies", summary: "Send a draft", access: "any", body: s.approveDraftInput, response: obj({ sent: z.boolean(), to: z.string(), subject: z.string() }) },
  { method: "post", path: "/drafts/:id/discard", id: "discardDraft", tag: "replies", summary: "Discard a draft", access: "any", response: obj({ discarded: z.boolean() }) },

  // --- credits ---
  { method: "get", path: "/credits", id: "getCredits", tag: "credits", summary: "Credit balance, and where a person tops up", access: "any", response: s.Credits },
  { method: "get", path: "/provider-keys", id: "listProviderKeys", tag: "credits", summary: "Your own provider keys (last 4 only)", access: "any", response: obj({ keys: z.array(s.ProviderKey) }) },
  { method: "put", path: "/provider-keys/:provider", id: "setProviderKey", tag: "credits", summary: "Store your own Icypeas, Firecrawl or Generect key; lookups through it spend no credits", access: "any", body: s.providerKeyInput, response: obj({ provider: z.string(), last4: z.string() }) },
  { method: "delete", path: "/provider-keys/:provider", id: "deleteProviderKey", tag: "credits", summary: "Remove a provider key", access: "any", response: deleted },

  // --- settings (mostly the dashboard's) ---
  { method: "get", path: "/api-keys", id: "listApiKeys", tag: "settings", summary: "List API keys", access: "any", response: obj({ api_keys: z.array(s.ApiKey) }) },
  { method: "post", path: "/api-keys", id: "createApiKey", tag: "settings", summary: "Create an API key", access: "user", body: s.createApiKeyInput, status: 201, response: obj({ id: z.string(), name: z.string(), scope: z.string(), key: z.string() }) },
  { method: "delete", path: "/api-keys/:id", id: "revokeApiKey", tag: "settings", summary: "Revoke an API key", access: "user", response: null },
  { method: "get", path: "/connected-apps", id: "listConnectedApps", tag: "settings", summary: "List OAuth apps connected to the workspace", access: "any", response: obj({ apps: z.array(s.ConnectedApp) }) },
  { method: "delete", path: "/connected-apps/:id", id: "revokeConnectedApp", tag: "settings", summary: "Disconnect an OAuth app", access: "user", response: null },
  { method: "post", path: "/oauth/requests/describe", id: "describeOAuthRequest", tag: "settings", summary: "Describe an app's pending connection request (consent page)", access: "user", body: s.oauthRequestInput, response: obj({ client_name: z.string(), redirect_to: z.string(), workspace: z.string() }) },
  { method: "post", path: "/oauth/requests/decide", id: "decideOAuthRequest", tag: "settings", summary: "Approve or decline an app's connection request (consent page)", access: "user", body: s.oauthDecideInput, response: obj({ redirect_to: z.string() }) },
  { method: "get", path: "/agent-hook", id: "getAgentHook", tag: "settings", summary: "Where Meerko rings your agent when replies arrive", access: "any", response: obj({ hook: s.AgentHook.nullable() }) },
  { method: "put", path: "/agent-hook", id: "setAgentHook", tag: "settings", summary: "Set the agent hook", access: "user", body: s.agentHookInput, response: obj({ hook: s.AgentHook, secret: z.string().optional() }) },
  { method: "delete", path: "/agent-hook", id: "deleteAgentHook", tag: "settings", summary: "Remove the agent hook", access: "user", response: null },
  { method: "post", path: "/agent-hook/enable", id: "enableAgentHook", tag: "settings", summary: "Re-enable an agent hook switched off after failures", access: "user", response: obj({ hook: s.AgentHook }) },
  { method: "post", path: "/agent-hook/test", id: "testAgentHook", tag: "settings", summary: "Ring the agent hook once", access: "user", response: obj({ ok: z.boolean(), status: z.number().nullable(), error: z.string().nullable() }) },
  { method: "get", path: "/slack", id: "getSlack", tag: "settings", summary: "Where replies and drafts are posted in Slack", access: "any", response: obj({ connection: s.SlackConnection.nullable(), app_available: z.boolean() }) },
  { method: "get", path: "/slack/install", id: "slackInstallUrl", tag: "settings", summary: "Install the Meerko Slack app", access: "user", response: s.Url },
  { method: "put", path: "/slack/webhook", id: "setSlackWebhook", tag: "settings", summary: "Post to Slack through an incoming webhook", access: "user", body: s.slackWebhookInput, response: obj({ connection: s.SlackConnection }) },
  { method: "post", path: "/slack/test", id: "testSlack", tag: "settings", summary: "Post a test message to Slack", access: "user", response: obj({ ok: z.boolean(), error: z.string().nullable() }) },
  { method: "delete", path: "/slack", id: "deleteSlack", tag: "settings", summary: "Disconnect Slack", access: "user", response: null },
  { method: "get", path: "/billing", id: "getBilling", tag: "settings", summary: "Plan, subscription and balance (Meerko Cloud)", access: "any", response: s.Billing },
  { method: "post", path: "/billing/checkout", id: "startCheckout", tag: "settings", summary: "Start a Stripe checkout for Pro or a credit pack", access: "owner", body: s.checkoutInput, response: s.Url },
  { method: "post", path: "/billing/portal", id: "openBillingPortal", tag: "settings", summary: "Open the Stripe billing portal", access: "owner", response: s.Url },
];

/** `/tables/:id` → a regex for `/v1/tables/<anything but a slash>`. */
export const pathPattern = (path: string) => new RegExp(`^/v1${path.replace(/:[^/]+/g, "[^/]+")}$`);

/** What a `replies`-scoped credential may call: read replies and save drafts (see app.ts). */
export const REPLIES_SCOPE_ROUTES: [method: string, path: RegExp][] = V1.filter((op) => op.scope === "replies").map((op) => [
  op.method.toUpperCase(),
  pathPattern(op.path),
]);
