// The docs registry: the sidebar, the pager, search and the sitemap all read from it.
// The MCP and CLI reference comes from the code (generated/reference.json, `pnpm docs:reference`).
import referenceJson from "@/generated/reference.json";
import { apiOperations } from "./api-reference";

export type DocsGroup = "Get started" | "Connect your agent" | "Concepts" | "Reference";

export interface DocPage {
  /** Path under /docs ("" is the hub). */
  slug: string;
  group: DocsGroup;
  /** Sidebar label. */
  title: string;
  /** One sentence for the hub, search and meta descriptions. */
  description: string;
}

export const DOCS_GROUPS: DocsGroup[] = ["Get started", "Connect your agent", "Concepts", "Reference"];

export const docPages: DocPage[] = [
  { slug: "", group: "Get started", title: "Introduction", description: "What Meerko is, and where to start." },
  { slug: "quick-start", group: "Get started", title: "Quick start", description: "Sign in to Meerko Cloud, connect your mailbox and add Meerko to your agent." },
  { slug: "self-hosting", group: "Get started", title: "Self-hosting", description: "Run the API, the worker, the web app and Postgres on your own machine or servers." },
  { slug: "claude", group: "Connect your agent", title: "Claude", description: "Add Meerko to Claude on the web, desktop or mobile as a connector, and sign in." },
  { slug: "chatgpt", group: "Connect your agent", title: "ChatGPT", description: "Add Meerko to ChatGPT as a custom MCP server and use it in any conversation." },
  { slug: "claude-code", group: "Connect your agent", title: "Claude Code", description: "Add the hosted Meerko MCP server to Claude Code with one command and sign in with your browser." },
  { slug: "codex-cursor", group: "Connect your agent", title: "Codex & Cursor", description: "Add the hosted Meerko MCP server to OpenAI Codex or Cursor and sign in." },
  { slug: "mcp-clients", group: "Connect your agent", title: "Other MCP clients", description: "Connect Gemini CLI or any MCP client that supports remote servers." },
  { slug: "tables", group: "Concepts", title: "Tables & AI columns", description: "Leads live in rows. AI columns are answered by your agent, row by row." },
  { slug: "finding-leads", group: "Concepts", title: "Finding leads", description: "Search people and companies from your agent or the dashboard, and save them straight into a table." },
  { slug: "emails", group: "Concepts", title: "Emails & verification", description: "Find work emails for your leads and verify them before you send." },
  { slug: "mailboxes", group: "Concepts", title: "Mailboxes", description: "Connect the Gmail, Outlook or IMAP inboxes Meerko sends from, and set their daily limits." },
  { slug: "sequences", group: "Concepts", title: "Sequences", description: "Multi-step emails sent from your own mailbox, in the same thread, inside a send window." },
  { slug: "replies", group: "Concepts", title: "Replies & drafts", description: "Sort replies by intent and approve the answers your agent drafts." },
  { slug: "wake-your-agent", group: "Concepts", title: "Wake your agent", description: "Have Meerko call your own agent when replies arrive, so drafts are ready when you are." },
  { slug: "slack", group: "Concepts", title: "Slack", description: "Get replies and your agent's drafts in Slack, and approve them there." },
  { slug: "pipeline", group: "Concepts", title: "Pipeline", description: "Lead stages from new to won, and which moves happen on their own." },
  { slug: "workspaces", group: "Concepts", title: "Workspaces", description: "One workspace per brand, switching between them, and the plan they share." },
  { slug: "credits", group: "Concepts", title: "Credits", description: "What costs credits on Meerko Cloud, and how to use your own provider keys." },
  { slug: "mcp-tools", group: "Reference", title: "MCP tools", description: "Every tool and command the Meerko MCP server gives your agent." },
  { slug: "cli", group: "Reference", title: "CLI", description: "Every meerko command, from your terminal or scripts." },
  { slug: "api", group: "Reference", title: "REST API", description: "Every endpoint of the Meerko HTTP API, from the OpenAPI document." },
  { slug: "api-keys", group: "Reference", title: "API keys", description: "Keys for scripts and self-hosted servers without Google sign-in." },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

export function docBySlug(slug: string) {
  const page = docPages.find((p) => p.slug === slug);
  if (!page) throw new Error(`No docs page "${slug}" in lib/docs.ts`);
  return page;
}

/** The pages before and after this one, in sidebar order. */
export function docNeighbours(slug: string) {
  const i = docPages.findIndex((p) => p.slug === slug);
  return { prev: docPages[i - 1], next: docPages[i + 1] };
}

export interface McpTool {
  name: string;
  title: string;
  description: string;
  /** The hints in packages/mcp/src/annotations.ts. Agents ask before running a destructive tool. */
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
  inputSchema: JsonSchema;
}

interface Reference {
  mcp: {
    tools: McpTool[];
    prompts: { name: string; title: string; description: string; arguments: { name: string; description?: string; required?: boolean }[] }[];
  };
  cli: {
    globalOptions: CliOption[];
    groups: Record<string, string>;
    commands: { usage: string; group: string; description: string; options: CliOption[] }[];
  };
}

interface CliOption {
  flags: string;
  description: string;
  default?: unknown;
  required: boolean;
}

const reference = referenceJson as unknown as Reference;
export const mcp = reference.mcp;
export const cli = reference.cli;

/** How the reference groups the MCP tools. Every tool must be in exactly one group. */
export const toolGroups: { id: string; label: string; page: string; tools: string[] }[] = [
  { id: "workspaces", label: "Workspaces", page: "workspaces", tools: ["whoami", "list_workspaces", "switch_workspace", "create_workspace", "rename_workspace"] },
  { id: "tables", label: "Tables", page: "tables", tools: ["list_tables", "create_table", "add_column", "get_pending_cells", "update_rows", "import_rows", "query_rows", "delete_rows", "delete_table"] },
  { id: "leads", label: "Leads", page: "finding-leads", tools: ["read_website", "find_people", "find_companies", "enrich_rows"] },
  { id: "mailboxes", label: "Mailboxes", page: "mailboxes", tools: ["connect_gmail", "list_mailboxes", "update_mailbox", "send_test_email", "check_domains"] },
  {
    id: "sequences",
    label: "Sequences",
    page: "sequences",
    tools: ["create_sequence", "update_sequence", "preview_sequence", "enroll_rows", "start_sequence", "pause_sequence", "list_sequences", "sequence_stats"],
  },
  { id: "replies", label: "Replies & drafts", page: "replies", tools: ["list_replies", "classify_reply", "draft_reply", "list_drafts", "approve_draft", "discard_draft"] },
  { id: "pipeline-tools", label: "Pipeline", page: "pipeline", tools: ["pipeline", "move_stage"] },
  { id: "credits", label: "Credits", page: "credits", tools: ["get_credits"] },
];

// Fail the build when a tool is added to the MCP server without a place in the docs.
{
  const grouped = toolGroups.flatMap((g) => g.tools);
  const missing = mcp.tools.filter((t) => !grouped.includes(t.name)).map((t) => t.name);
  const unknown = grouped.filter((n) => !mcp.tools.some((t) => t.name === n));
  if (missing.length || unknown.length) throw new Error(`lib/docs.ts toolGroups is out of sync with the MCP server: missing ${missing}, unknown ${unknown}`);
}

export function toolByName(name: string) {
  const tool = mcp.tools.find((t) => t.name === name);
  if (!tool) throw new Error(`No MCP tool "${name}"`);
  return tool;
}

/** Tools whose description tells the agent to wait for the user's explicit OK. */
/** Tools that send real email: destructive and reaching outside the account (annotations.ts). */
export const needsApproval = (tool: McpTool) => !!tool.annotations.destructiveHint && !!tool.annotations.openWorldHint;
/** Tools that delete or overwrite the user's own data. */
export const cantUndo = (tool: McpTool) => !!tool.annotations.destructiveHint && !tool.annotations.openWorldHint;

/** An entry in the docs search. */
export interface SearchEntry {
  title: string;
  href: string;
  kind: string;
  text: string;
}

/** The CLI command's anchor on /docs/cli, e.g. "meerko tables create <name>" → "tables-create". */
export const cliAnchor = (usage: string) =>
  usage
    .split(" ")
    .slice(1)
    .filter((w) => !/^[<[]/.test(w))
    .join("-");

/** Everything the docs search looks through: pages, MCP tools and commands, CLI commands. */
export function searchEntries(): SearchEntry[] {
  return [
    ...docPages.map((p) => ({ title: p.title, href: docHref(p.slug), kind: "Page", text: p.description })),
    ...mcp.tools.map((t) => ({ title: t.name, href: `/docs/mcp-tools#${t.name}`, kind: "Tool", text: t.description.split("\n")[0]! })),
    ...mcp.prompts.map((p) => ({ title: `/mcp__meerko__${p.name}`, href: "/docs/mcp-tools#commands", kind: "Command", text: p.description })),
    ...cli.commands.map((c) => ({ title: c.usage, href: `/docs/cli#${cliAnchor(c.usage)}`, kind: "CLI", text: c.description })),
    ...apiOperations.map((o) => ({ title: `${o.method} ${o.path}`, href: `/docs/api#${o.id}`, kind: "API", text: o.summary })),
  ];
}

interface JsonSchema {
  type?: string;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

export interface ToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function typeLabel(s: JsonSchema): string {
  if (s.enum) return s.enum.join(" | ");
  let t = s.type === "array" ? `${s.items?.type === "object" ? "object" : (s.items?.type ?? "any")}[]` : (s.type ?? "any");
  const lo = s.minimum ?? s.minItems;
  const hi = s.maximum ?? s.maxItems;
  if (lo !== undefined && hi !== undefined && hi < MAX_SAFE) t += ` · ${lo}–${hi}`;
  else if (lo !== undefined && lo > 0) t += ` · ≥ ${lo}`;
  return t;
}

/** A tool's parameters from its JSON Schema, plus the fields of any array-of-objects parameter (e.g. steps). */
export function toolParams(tool: McpTool): { params: ToolParam[]; nested: { of: string; params: ToolParam[] }[] } {
  const schema = tool.inputSchema;
  const toParams = (s: JsonSchema) =>
    Object.entries(s.properties ?? {}).map(([name, p]) => ({ name, type: typeLabel(p), required: !!s.required?.includes(name), description: p.description ?? "" }));
  const nested = Object.entries(schema.properties ?? {})
    .filter(([, p]) => p.type === "array" && p.items?.properties)
    .map(([of, p]) => ({ of, params: toParams(p.items!) }));
  return { params: toParams(schema), nested };
}
