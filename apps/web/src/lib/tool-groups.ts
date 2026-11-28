// How the docs reference groups the MCP tools. Its own module, free of "@/" imports, so `pnpm docs:reference --check`
// (part of `pnpm typecheck`) can check it against the MCP server: a tool missing here fails typecheck, not the prd build.

/** How the reference groups the MCP tools. Every tool must be in exactly one group. */
export const toolGroups: { id: string; label: string; page: string; tools: string[] }[] = [
  { id: "workspaces", label: "Workspace", page: "workspaces", tools: ["get_workspace", "manage_workspace"] },
  { id: "tables", label: "Tables", page: "tables", tools: ["list_tables", "manage_table", "query_rows", "import_rows", "update_rows", "delete_data"] },
  { id: "leads", label: "Leads", page: "finding-leads", tools: ["read_website", "set_icp", "find_leads", "enrich_rows"] },
  { id: "mailboxes", label: "Mailboxes", page: "mailboxes", tools: ["list_mailboxes", "manage_mailbox", "send_test_email"] },
  { id: "sequences", label: "Sequences", page: "sequences", tools: ["list_sequences", "manage_sequence", "enroll_rows", "start_sequence", "approve_emails"] },
  { id: "replies", label: "Replies & drafts", page: "replies", tools: ["list_replies", "classify_reply", "draft_reply"] },
  { id: "crm", label: "CRM", page: "crm", tools: ["sync_crm"] },
  { id: "autopilot", label: "Autopilot", page: "wake-your-agent", tools: ["manage_routine", "start_routine_run"] },
];
