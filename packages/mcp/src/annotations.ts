import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * A title and the behaviour hints for every Meerko tool, as the Claude Connectors Directory and the ChatGPT app
 * directory require (claude.com/docs/connectors/building/submission, developers.openai.com/apps-sdk/app-submission-guidelines).
 *
 * - readOnlyHint: true only if the tool changes nothing. Searches that save rows, or spend credits, are writes.
 * - destructiveHint: true for deletes, overwrites of the user's content (a setting or a score the tool replaces
 *   counts, even when the user can set it again), and sends that can't be taken back.
 * - openWorldHint: true when the tool reaches outside the user's Meerko account: the lead database, the public
 *   DNS, real people's inboxes, or a webhook or AI routine the user connected.
 *
 * A hint describes the worst a tool can do with any input, not what it does by default: OpenAI's scan compares the
 * hints with every action a tool has (#16).
 *
 * `annotations.test.ts` fails when a tool is added to server.ts without an entry here.
 */
type Entry = { title: string } & Required<Pick<ToolAnnotations, "readOnlyHint" | "destructiveHint" | "openWorldHint">>;

const read = (title: string, openWorld = false): Entry => ({ title, readOnlyHint: true, destructiveHint: false, openWorldHint: openWorld });
const write = (title: string, openWorld = false): Entry => ({ title, readOnlyHint: false, destructiveHint: false, openWorldHint: openWorld });
const destructive = (title: string, openWorld = false): Entry => ({ title, readOnlyHint: false, destructiveHint: true, openWorldHint: openWorld });

export const TOOL_ANNOTATIONS: Record<string, Entry> = {
  // Autopilot
  manage_routine: destructive("Manage Autopilot routines", true), // delete; run_now calls the user's Claude routine or webhook
  start_routine_run: write("Start an Autopilot run"),

  // Workspaces
  whoami: read("Show the current workspace"),
  list_workspaces: read("List workspaces"),
  switch_workspace: write("Switch workspace"),
  create_workspace: write("Create a workspace"),
  rename_workspace: write("Rename a workspace"),

  // Tables
  list_tables: read("List lead tables"),
  create_table: write("Create a lead table"),
  add_column: destructive("Add a column"), // adding it again replaces an AI column's instruction
  get_pending_cells: read("Get cells waiting for the agent"),
  read_website: read("Read a website", true), // fetches any public site
  get_icp: read("Get the ideal customer profile"),
  set_icp: destructive("Set the ideal customer profile"), // replaces the whole profile and rescores every lead
  review_icp_fit: destructive("Adjust ICP fit scores"), // overwrites a row's earlier adjustment and note
  update_rows: destructive("Update rows"), // overwrites cell values
  import_rows: write("Import rows"),
  query_rows: read("Query rows"),
  delete_rows: destructive("Delete rows"),
  delete_table: destructive("Delete a table"),

  // Leads and enrichment: the lead database is outside the account, and results cost credits
  find_people: write("Find people", true),
  find_companies: write("Find companies", true),
  enrich_rows: destructive("Find and verify emails", true), // overwrite replaces earlier results; credits spent don't come back
  get_credits: read("Show credit balance"),

  // Mailboxes
  connect_gmail: write("Connect a mailbox"),
  list_mailboxes: read("List mailboxes"),
  update_mailbox: write("Update mailbox settings"),
  check_domains: read("Check sending domains", true), // public DNS lookups
  send_test_email: destructive("Send a test email", true), // a real email, can't be unsent

  // Sequences
  create_sequence: write("Create a sequence"),
  update_sequence: destructive("Edit a sequence"), // overwrites the steps' text
  preview_sequence: read("Preview a sequence email"),
  enroll_rows: destructive("Enroll rows in a sequence", true), // in a sequence that's already running, the leads get emailed
  start_sequence: destructive("Start sending a sequence", true), // real emails to real people
  delete_sequence: destructive("Delete a sequence"),
  pause_sequence: write("Pause a sequence"),
  get_sending_mode: read("Get the sending mode"),
  list_pending_emails: read("List emails waiting for approval"),
  approve_emails: destructive("Approve emails to send", true), // real emails to real people
  list_sequences: read("List sequences"),
  sequence_stats: read("Show sequence stats"),

  // Replies and pipeline
  list_replies: read("List replies"),
  classify_reply: write("Classify a reply"),
  draft_reply: destructive("Draft (or send) a reply", true), // sent at once in a workspace that sends reply drafts automatically
  list_drafts: read("List reply drafts"),
  approve_draft: destructive("Approve and send a reply", true), // sends the reply
  discard_draft: destructive("Discard a reply draft"),
  pipeline: read("Show the pipeline"),
  move_stage: write("Move leads to a pipeline stage"),
  sync_crm: write("Push leads to the CRM", true), // writes contacts into HubSpot or Attio
};
