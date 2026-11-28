import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { instrument } from "@posthog/mcp";
import { PostHog } from "posthog-node";
import type { MeerkoClient } from "@meerko/sdk";
import { MCP_ANALYTICS_OPTIONS } from "@meerko/mcp/analytics";
import { LEGACY_TOOLS } from "@meerko/mcp/legacy";
import { createServer, DRAFTER_PROMPTS, DRAFTER_TOOLS } from "@meerko/mcp/server";
import { describe, expect, it } from "vitest";

// #81 merged the 52 tools into 26. Every description loads into every agent session, so the set stays small; and
// every name that went is still served, unlisted, by the tool that does its job now (packages/mcp/src/legacy.ts).
// Each case below is an old call and the SDK call the old tool made: the merged tool has to make the same one.

type Call = [method: string, ...args: unknown[]];

/** A MeerkoClient that records every call and answers each with an empty object. */
function recorder() {
  const calls: Call[] = [];
  const fake = new Proxy({}, { get: (_, method: string) => async (...args: unknown[]) => (calls.push([method, ...args]), {}) }) as MeerkoClient;
  return { calls, fake };
}

async function connect(opts: { only?: { tools: string[]; prompts: string[] }; analytics?: boolean } = {}) {
  const { calls, fake } = recorder();
  const server = createServer(() => fake, opts.only ? { only: opts.only } : {});
  if (opts.analytics) instrument(server, new PostHog("phc_test", { disabled: true }), { ...MCP_ANALYTICS_OPTIONS, logger: () => {} });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    calls.length = 0;
    const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
    return { res, calls: [...calls] };
  };
  return { client, call };
}

/** The tools the server listed before #81. */
const BEFORE_81 = [
  "whoami", "list_workspaces", "switch_workspace", "create_workspace", "rename_workspace",
  "list_tables", "create_table", "rename_table", "delete_table", "add_column", "get_pending_cells", "update_rows", "import_rows", "query_rows", "get_lead", "delete_rows",
  "find_people", "find_companies", "get_icp", "set_icp", "review_icp_fit", "read_website", "enrich_rows", "get_credits",
  "connect_gmail", "list_mailboxes", "update_mailbox", "check_domains", "send_test_email",
  "create_sequence", "update_sequence", "preview_sequence", "enroll_rows", "start_sequence", "pause_sequence", "delete_sequence", "list_sequences", "sequence_stats", "get_sending_mode", "list_pending_emails", "approve_emails",
  "list_replies", "classify_reply", "draft_reply", "list_drafts", "approve_draft", "discard_draft",
  "pipeline", "move_stage", "sync_crm", "manage_routine", "start_routine_run",
];

const query = { currentJobTitle: { include: ["CTO"] } };
const step = { subject: "Hi", body: "Hello {{first_name}}" };

const CASES: Record<string, [args: Record<string, unknown>, expected: Call]> = {
  whoami: [{}, ["me"]],
  list_workspaces: [{}, ["listWorkspaces"]],
  get_credits: [{}, ["getCredits"]],
  get_sending_mode: [{}, ["getSendingMode"]],
  get_icp: [{}, ["getIcp"]],
  switch_workspace: [{ workspace_id: "w1" }, ["switchWorkspace", "w1"]],
  create_workspace: [{ name: "Brand" }, ["createWorkspace", "Brand"]],
  rename_workspace: [{ workspace_id: "w1", name: "Brand" }, ["renameWorkspace", "w1", "Brand"]],
  create_table: [{ name: "T", columns: [{ name: "x" }] }, ["createTable", { name: "T", columns: [{ name: "x" }] }]],
  rename_table: [{ table_id: "t1", name: "T" }, ["renameTable", "t1", "T"]],
  add_column: [{ table_id: "t1", name: "fit", prompt: "Score {{company}}" }, ["addColumn", "t1", { name: "fit", prompt: "Score {{company}}" }]],
  pipeline: [{ table_id: "t1" }, ["pipeline", "t1"]],
  get_lead: [{ table_id: "t1", row_id: "r1" }, ["getLead", "t1", "r1"]],
  get_pending_cells: [{ table_id: "t1", column: "fit", limit: 10 }, ["getPendingCells", "t1", "fit", { limit: 10 }]],
  move_stage: [{ table_id: "t1", row_ids: ["r1"], stage: "won" }, ["moveStage", "t1", ["r1"], "won"]],
  review_icp_fit: [{ table_id: "t1", rows: [{ row_id: "r1", adjust: 5, note: "fits" }] }, ["reviewIcpFit", "t1", [{ row_id: "r1", adjust: 5, note: "fits" }]]],
  delete_table: [{ table_id: "t1" }, ["deleteTable", "t1"]],
  delete_rows: [{ table_id: "t1", row_ids: ["r1"] }, ["deleteRows", "t1", ["r1"]]],
  delete_sequence: [{ sequence_id: "s1" }, ["deleteSequence", "s1"]],
  discard_draft: [{ draft_id: "d1" }, ["discardDraft", "d1"]],
  find_people: [{ query, limit: 5, table_name: "CTOs" }, ["searchLeads", "people", { query, limit: 5, tableName: "CTOs" }]],
  find_companies: [{ query, count_only: true }, ["checkLeads", "companies", query]],
  connect_gmail: [{ provider: "other" }, ["mailboxConnectOptions"]],
  update_mailbox: [{ mailbox_id: "m1", daily_limit: 20, resume: true }, ["updateMailbox", "m1", { dailyLimit: 20, resume: true }]],
  check_domains: [{}, ["mailboxHealth"]],
  create_sequence: [
    { table_id: "t1", name: "Q4", mailbox_ids: ["m1"], steps: [step], timezone: "Europe/Madrid" },
    ["createSequence", { table_id: "t1", name: "Q4", mailbox_ids: ["m1"], steps: [step], timezone: "Europe/Madrid" }],
  ],
  update_sequence: [{ sequence_id: "s1", name: "Q5", window_end_hour: 18 }, ["updateSequence", "s1", { name: "Q5", window_end_hour: 18 }]],
  pause_sequence: [{ sequence_id: "s1" }, ["pauseSequence", "s1"]],
  sequence_stats: [{ sequence_id: "s1" }, ["sequenceStats", "s1"]],
  preview_sequence: [{ sequence_id: "s1", row_id: "r1" }, ["previewSequence", "s1", "r1"]],
  list_pending_emails: [{ sequence_id: "s1", limit: 5 }, ["listPendingEmails", { sequenceId: "s1", limit: 5 }]],
  list_drafts: [{}, ["listDrafts"]],
  approve_draft: [{ draft_id: "d1", body: "Thursday works" }, ["approveDraft", "d1", "Thursday works"]],
};

describe("the MCP tool set (#81)", async () => {
  const { client, call } = await connect();
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);

  it("stays at about 25 tools", () => {
    expect(tools.length).toBeLessThanOrEqual(26);
  });

  it("has a case here for every retired name, and none of them is listed", () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(LEGACY_TOOLS).sort());
    expect(names.filter((n) => n in LEGACY_TOOLS)).toEqual([]);
  });

  it("still answers every one of the 52 names, listed or not", () => {
    expect(BEFORE_81).toHaveLength(52);
    expect(BEFORE_81.filter((n) => !names.includes(n) && !(n in LEGACY_TOOLS))).toEqual([]);
  });

  it("maps every retired name onto a tool the server lists", () => {
    for (const [old, translate] of Object.entries(LEGACY_TOOLS)) expect(names, old).toContain(translate({}).name);
  });

  for (const [old, [args, expected]] of Object.entries(CASES)) {
    it(`serves ${old} with the call it made`, async () => {
      const { res, calls } = await call(old, args);
      expect(res.isError, `${old}: ${res.content[0]?.text}`).toBeFalsy();
      expect(calls).toContainEqual(expected);
    });
  }

  it("still refuses a name that never existed", async () => {
    const { res } = await call("no_such_tool");
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/not found/);
  });

  it("serves retired names with PostHog MCP analytics on, as the hosted /mcp runs", async () => {
    const instrumented = await connect({ analytics: true });
    const { res, calls } = await instrumented.call("get_lead", { table_id: "t1", row_id: "r1" });
    expect(res.isError).toBeFalsy();
    expect(calls).toContainEqual(["getLead", "t1", "r1"]);
  });

  it("serves list_drafts on the drafter endpoint, and nothing outside its tools", async () => {
    const drafter = await connect({ only: { tools: DRAFTER_TOOLS, prompts: DRAFTER_PROMPTS } });
    expect((await drafter.call("list_drafts")).calls).toEqual([["listDrafts"]]);
    const refused = await drafter.call("delete_rows", { table_id: "t1", row_ids: ["r1"] });
    expect(refused.res.isError).toBe(true);
    expect(refused.calls).toEqual([]);
  });
});
