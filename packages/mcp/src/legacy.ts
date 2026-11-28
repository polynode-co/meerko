/**
 * The 52 tools Meerko had until #81, merged into 26 by resource. The names that went are still served: a client with
 * a stale tool list (a ChatGPT app keeps the list it was reviewed with, a long agent session keeps the one it
 * started with) calls the old name with the old arguments, and the call is translated into the tool that does the
 * same job now. These names are never listed, so no session pays for their descriptions.
 *
 * This table is the old → new mapping: `legacy-tools.test.ts` checks that every name maps to a registered tool and
 * that the translated arguments pass its schema, so no old capability is lost.
 */
type Args = Record<string, unknown>;
export type LegacyCall = { name: string; arguments: Args };

/** The keys of `args` that are set, so a translation never sends an old call's nulls as values. */
const pick = (args: Args, ...keys: string[]) => Object.fromEntries(keys.filter((k) => args[k] !== undefined && args[k] !== null).map((k) => [k, args[k]]));
const to = (name: string, fixed: Args, ...keys: string[]) => (args: Args): LegacyCall => ({ name, arguments: { ...fixed, ...pick(args, ...keys) } });

export const LEGACY_TOOLS: Record<string, (args: Args) => LegacyCall> = {
  // Workspaces → get_workspace (reads) and manage_workspace (changes)
  whoami: to("get_workspace", {}),
  list_workspaces: to("get_workspace", {}),
  get_credits: to("get_workspace", {}),
  get_sending_mode: to("get_workspace", {}),
  get_icp: to("get_workspace", {}),
  switch_workspace: to("manage_workspace", { action: "switch" }, "workspace_id"),
  create_workspace: to("manage_workspace", { action: "create" }, "name"),
  rename_workspace: to("manage_workspace", { action: "rename" }, "workspace_id", "name"),

  // Tables → manage_table, list_tables, query_rows, update_rows
  create_table: to("manage_table", { action: "create" }, "name", "columns"),
  rename_table: to("manage_table", { action: "rename" }, "table_id", "name"),
  add_column: to("manage_table", { action: "add_column" }, "table_id", "name", "type", "prompt"),
  pipeline: to("list_tables", {}, "table_id"),
  get_lead: to("query_rows", {}, "table_id", "row_id"),
  get_pending_cells: (args) => ({ name: "query_rows", arguments: { ...pick(args, "table_id", "limit", "filter"), ...(args.column ? { pending_column: args.column } : {}) } }),
  move_stage: to("update_rows", {}, "table_id", "row_ids", "stage"),
  review_icp_fit: (args) => ({ name: "update_rows", arguments: { ...pick(args, "table_id"), ...(args.rows ? { icp_reviews: args.rows } : {}) } }),

  // Deletes → delete_data
  delete_table: to("delete_data", { kind: "table" }, "table_id"),
  delete_rows: to("delete_data", { kind: "rows" }, "table_id", "row_ids"),
  delete_sequence: to("delete_data", { kind: "sequence" }, "sequence_id"),
  discard_draft: to("delete_data", { kind: "draft" }, "draft_id"),

  // Lead search → find_leads
  find_people: to("find_leads", { type: "people" }, "query", "limit", "table_id", "table_name", "count_only"),
  find_companies: to("find_leads", { type: "companies" }, "query", "limit", "table_id", "table_name", "count_only"),

  // Mailboxes → manage_mailbox, list_mailboxes
  connect_gmail: to("manage_mailbox", { action: "connect" }, "provider", "email"),
  update_mailbox: to("manage_mailbox", { action: "update" }, "mailbox_id", "daily_limit", "display_name", "ramp", "resume"),
  check_domains: to("list_mailboxes", { check_domains: true }),

  // Sequences → manage_sequence, list_sequences
  create_sequence: to("manage_sequence", { action: "create" }, "table_id", "name", "mailbox_ids", "assignment", "steps", "timezone", "window_start_hour", "window_end_hour"),
  update_sequence: to("manage_sequence", { action: "update" }, "sequence_id", "name", "mailbox_ids", "assignment", "steps", "timezone", "window_start_hour", "window_end_hour"),
  pause_sequence: to("manage_sequence", { action: "pause" }, "sequence_id"),
  sequence_stats: to("list_sequences", { view: "stats" }, "sequence_id"),
  preview_sequence: to("list_sequences", { view: "preview" }, "sequence_id", "row_id"),
  list_pending_emails: to("list_sequences", { view: "pending" }, "sequence_id", "limit"),

  // Replies → list_replies, approve_emails
  list_drafts: to("list_replies", { view: "drafts" }),
  approve_draft: to("approve_emails", {}, "draft_id", "body"),
};

/** The call a retired tool name stands for now, or null for a name that never existed. */
export function translateLegacyCall(name: string, args: unknown): LegacyCall | null {
  const translate = LEGACY_TOOLS[name];
  return translate ? translate(args && typeof args === "object" && !Array.isArray(args) ? (args as Args) : {}) : null;
}
