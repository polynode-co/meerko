import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * A title and the behaviour hints for every Meerko tool, as the Claude Connectors Directory and the ChatGPT app
 * directory require (claude.com/docs/connectors/building/submission, developers.openai.com/apps-sdk/app-submission-guidelines).
 *
 * - readOnlyHint: true only if the tool changes nothing. Searches that save rows, or spend credits, are writes.
 * - destructiveHint: true for deletes, overwrites of the user's content (a setting or a score the tool replaces
 *   counts, even when the user can set it again, and so does a record the tool overwrites in a service the user
 *   connected, like a CRM contact), and sends that can't be taken back.
 * - openWorldHint: true when the tool reaches outside the user's Meerko account: the lead database, the public
 *   DNS, real people's inboxes, or a CRM, webhook or AI routine the user connected.
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
  // Workspace
  get_workspace: read("Show the workspace and its settings"),
  manage_workspace: write("Switch, create or rename a workspace"),

  // Tables and rows
  list_tables: read("List lead tables and the pipeline"),
  manage_table: destructive("Create or rename a table, or add a column"), // adding a column again replaces an AI column's instruction
  query_rows: read("Query rows"),
  import_rows: write("Import rows"),
  update_rows: destructive("Update rows, stages and ICP fit"), // overwrites cell values and a row's earlier ICP adjustment
  delete_data: destructive("Delete a table, rows, a sequence or a draft"),

  // Finding leads: the lead database is outside the account, and results cost credits
  find_leads: write("Find people or companies", true),
  set_icp: destructive("Set the ideal customer profile"), // replaces the whole profile and rescores every lead
  read_website: read("Read a website", true), // fetches any public site
  enrich_rows: destructive("Find and verify emails", true), // overwrite replaces earlier results; credits spent don't come back

  // Mailboxes
  list_mailboxes: read("List mailboxes and check domains", true), // check_domains does public DNS lookups
  manage_mailbox: write("Connect or update a mailbox"),
  send_test_email: destructive("Send a test email", true), // a real email, can't be unsent

  // Sequences
  list_sequences: read("List, preview and measure sequences"),
  manage_sequence: destructive("Create, edit or pause a sequence"), // update overwrites the steps' text
  enroll_rows: destructive("Enroll rows in a sequence", true), // in a sequence that's already running, the leads get emailed
  start_sequence: destructive("Start sending a sequence", true), // real emails to real people
  approve_emails: destructive("Approve emails and reply drafts to send", true), // real emails to real people

  // Replies
  list_replies: read("List replies and drafts"),
  classify_reply: write("Classify a reply"),
  draft_reply: destructive("Draft (or send) a reply", true), // sent at once in a workspace that sends reply drafts automatically

  // CRM
  sync_crm: destructive("Push leads to the CRM", true), // creates contacts in HubSpot or Attio and overwrites the fields of the ones it matches

  // Autopilot
  manage_routine: destructive("Manage Autopilot routines", true), // delete; run_now calls the user's Claude routine or webhook
  start_routine_run: write("Start an Autopilot run"),
};
