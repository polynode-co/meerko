// How the docs reference groups the MCP tools. Its own module, free of "@/" imports, so `pnpm docs:reference --check`
// (part of `pnpm typecheck`) can check it against the MCP server: a tool missing here fails typecheck, not the prd build.

/** How the reference groups the MCP tools. Every tool must be in exactly one group. */
export const toolGroups: { id: string; label: string; page: string; tools: string[] }[] = [
  { id: "workspaces", label: "Workspaces", page: "workspaces", tools: ["whoami", "list_workspaces", "switch_workspace", "create_workspace", "rename_workspace"] },
  { id: "tables", label: "Tables", page: "tables", tools: ["list_tables", "create_table", "add_column", "get_pending_cells", "update_rows", "import_rows", "query_rows", "delete_rows", "delete_table"] },
  { id: "leads", label: "Leads", page: "finding-leads", tools: ["read_website", "get_icp", "set_icp", "review_icp_fit", "find_people", "find_companies", "enrich_rows"] },
  { id: "mailboxes", label: "Mailboxes", page: "mailboxes", tools: ["connect_gmail", "list_mailboxes", "update_mailbox", "send_test_email", "check_domains"] },
  {
    id: "sequences",
    label: "Sequences",
    page: "sequences",
    tools: ["create_sequence", "update_sequence", "preview_sequence", "enroll_rows", "start_sequence", "pause_sequence", "get_sending_mode", "list_pending_emails", "approve_emails", "list_sequences", "sequence_stats"],
  },
  { id: "replies", label: "Replies & drafts", page: "replies", tools: ["list_replies", "classify_reply", "draft_reply", "list_drafts", "approve_draft", "discard_draft"] },
  { id: "pipeline-tools", label: "Pipeline", page: "pipeline", tools: ["pipeline", "move_stage"] },
  { id: "crm", label: "CRM", page: "crm", tools: ["sync_crm"] },
  { id: "autopilot", label: "Autopilot", page: "wake-your-agent", tools: ["manage_routine", "start_routine_run"] },
  { id: "credits", label: "Credits", page: "credits", tools: ["get_credits"] },
];
