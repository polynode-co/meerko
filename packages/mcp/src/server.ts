// The Meerko MCP server: every tool and prompt. index.ts serves it over stdio (local, with an API key); the API
// serves it at /mcp for remote clients signed in with OAuth. The docs reference
// (apps/web/src/generated/reference.json) is generated from it by scripts/docs-reference.mts.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MeerkoClient, REPLY_INTENTS, STAGES } from "@meerko/sdk";

const columnType = z.enum(["text", "number", "email", "url", "boolean", "json"]);

async function run(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn(), null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text" as const, text: (err as Error).message }] };
  }
}

const filterGuide = `Filters are objects keyed by field. Text fields take {include?: string[], exclude?: string[]}; numeric fields take range operators {">=": n, "<=": n}.
Use alpha-2 country codes for location ("ES", "US"). Expand titles across languages and acronyms (["CTO", "Chief Technology Officer", "Director de Tecnología"]).`;

const leadSearchInput = {
  limit: z.number().int().min(1).max(1000).optional().describe("Max results to fetch (default 25). Each result costs 1 credit (none with your own Icypeas key); count first."),
  table_id: z.string().optional().describe("Append results to this table"),
  table_name: z.string().optional().describe("Name for a new table, used when table_id is omitted"),
  count_only: z.boolean().optional().describe("Only return how many leads match. Free; use before a paid search."),
};

const stepSchema = z.object({
  subject: z.string().optional().describe("Only for step 1; follow-ups reply in the same thread"),
  body: z.string().describe("Plain text. Use {{column_key}} for row values, e.g. {{first_name}}. An unsubscribe line is appended automatically."),
  delay_days: z.number().int().min(0).optional().describe("Days after the previous step (default 3)"),
});

// Prompts show up as slash commands in agents (e.g. /mcp__meerko__find-leads in Claude Code). Each one is a
// short recipe over the tools; anything that emails someone waits for the user's OK.
const ask = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

/** Every Meerko tool and prompt, calling the API through `client` (resolved per call, so a missing key is a tool error, not a crash). */
export function createServer(client: () => MeerkoClient) {
  const server = new McpServer({ name: "meerko", version: "0.0.0" });

  server.registerTool(
    "list_tables",
    { description: "List all prospect tables in the Meerko workspace, with their columns and row counts.", inputSchema: {} },
    () => run(() => client().listTables()),
  );

  server.registerTool(
    "create_table",
    {
      description: "Create a new prospect table (e.g. 'Fintech CTOs Spain'). Columns are optional; they are also auto-created on import.",
      inputSchema: {
        name: z.string().describe("Table name"),
        columns: z.array(z.object({ name: z.string(), type: columnType.optional() })).optional(),
      },
    },
    (input) => run(() => client().createTable(input)),
  );

  server.registerTool(
    "add_column",
    {
      description: `Add a column to a table. Give it a \`prompt\` to make it an AI column: an instruction that you (the agent) answer per row, e.g. "Score ICP fit 1-5 for {{company}}: {{description}}" or "Write a one-line opener for {{first_name}} at {{company}}".
Meerko doesn't run the prompt itself. Fill the column with get_pending_cells + update_rows. Calling this again with a new prompt replaces the instruction.`,
      inputSchema: {
        table_id: z.string(),
        name: z.string(),
        type: columnType.optional(),
        prompt: z.string().optional().describe("Instruction for an AI column; {{column_key}} inserts that row's value"),
      },
    },
    ({ table_id, name, type, prompt }) => run(() => client().addColumn(table_id, { name, type, prompt })),
  );

  server.registerTool(
    "get_pending_cells",
    {
      description: `Fetch rows whose AI column is still empty, each with the column's instruction already filled in from that row ("instruction") plus the full row data.
Answer each instruction yourself from the row data (and research, if the instruction asks for it), then save all answers in one update_rows call. Repeat while "remaining" > 0.
Write "N/A" when a row lacks what the instruction needs, so it isn't returned again.`,
      inputSchema: {
        table_id: z.string(),
        column: z.string().describe("The AI column's name or key"),
        limit: z.number().int().min(1).max(200).optional().describe("Rows per batch (default 25)"),
        filter: z.record(z.string(), z.unknown()).optional(),
      },
    },
    ({ table_id, column, ...opts }) => run(() => client().getPendingCells(table_id, column, opts)),
  );

  server.registerTool(
    "update_rows",
    {
      description: "Write values into existing rows by row id. Each update's `data` is merged into the row; new keys become new columns. Max 1,000 rows per call.",
      inputSchema: {
        table_id: z.string(),
        updates: z.array(z.object({ id: z.string(), data: z.record(z.string(), z.unknown()) })),
      },
    },
    ({ table_id, updates }) => run(() => client().updateRows(table_id, updates)),
  );

  server.registerTool(
    "import_rows",
    {
      description:
        "Insert rows (objects of column -> value) into a table. Keys are normalized to snake_case and unknown keys become new columns. Max 10,000 rows per call.",
      inputSchema: { table_id: z.string(), rows: z.array(z.record(z.string(), z.unknown())) },
    },
    ({ table_id, rows }) => run(() => client().insertRows(table_id, rows)),
  );

  server.registerTool(
    "query_rows",
    {
      description: `Read rows from a table, each with its pipeline stage. \`filter\` is an exact-match object on column keys, e.g. {"country": "Spain"}; \`stage\` filters by stage (${STAGES.join(", ")}).`,
      inputSchema: {
        table_id: z.string(),
        filter: z.record(z.string(), z.unknown()).optional(),
        stage: z.enum(STAGES).optional(),
        limit: z.number().int().min(1).max(1000).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    ({ table_id, ...opts }) => run(() => client().queryRows(table_id, opts)),
  );

  server.registerTool(
    "find_people",
    {
      description: `Search the lead database for people and save them as rows in a table (first_name, last_name, title, company, domain, company_size, location, linkedin_url).
${filterGuide}
People fields: currentJobTitle, pastJobTitle, firstname, lastname, location, keyword, skills, languages, school, currentCompanyName, currentCompanyWebsite, currentCompanyUrn, "currentCompany.industry", "currentCompany.location", "currentCompany.keyword"; ranges: "currentCompany.headcount", "currentCompany.revenue", totalYearsOfExperience; growth: "currentCompany.headcountGrowth" {timespan: "6months"|"12months"|"24months", min, max}.`,
      inputSchema: { query: z.record(z.string(), z.record(z.string(), z.unknown())), ...leadSearchInput },
    },
    ({ query, count_only, limit, table_id, table_name }) =>
      run(() =>
        count_only
          ? client().countLeads("people", query).then((total) => ({ total }))
          : client().searchLeads("people", { query, limit, tableId: table_id, tableName: table_name }),
      ),
  );

  server.registerTool(
    "find_companies",
    {
      description: `Search the lead database for companies and save them as rows in a table (company, domain, industry, employees, location, description, linkedin_url, company_urn).
${filterGuide}
Company fields: name, industry (LinkedIn industry names, e.g. "Financial Services", "Software Development"), location, keyword, domain, type; ranges: headcount, revenue (USD); growth: headcountGrowth {timespan, min, max}.
To get decision-makers at the found companies, pass their company_urn values to find_people as currentCompanyUrn.`,
      inputSchema: { query: z.record(z.string(), z.record(z.string(), z.unknown())), ...leadSearchInput },
    },
    ({ query, count_only, limit, table_id, table_name }) =>
      run(() =>
        count_only
          ? client().countLeads("companies", query).then((total) => ({ total }))
          : client().searchLeads("companies", { query, limit, tableId: table_id, tableName: table_name }),
      ),
  );

  server.registerTool(
    "enrich_rows",
    {
      description: `Find work emails (from first_name, last_name and domain or company columns) and verify them, writing email, email_certainty and email_verification back to each row.
Only rows missing a result are processed, at most \`limit\` per call (~3s per row). Keep calling while \`remaining\` > 0.
Costs: 8 credits per email found, 1 per verification; misses are free. Emails found as ultra_sure/very_sure count as verified at no cost.
email_certainty values: ultra_sure, very_sure, probable (deliverability unconfirmed), not_found, missing_input (row lacks a name or domain).`,
      inputSchema: {
        table_id: z.string(),
        fields: z.array(z.enum(["email", "email_verification"])).optional().describe("Default: both"),
        filter: z.record(z.string(), z.unknown()).optional().describe("Only enrich rows matching this exact-match filter"),
        limit: z.number().int().min(1).max(50).optional().describe("Rows per call (default 25)"),
        overwrite: z.boolean().optional().describe("Re-run rows that already have a result"),
      },
    },
    ({ table_id, ...input }) => run(() => client().enrichRows(table_id, input)),
  );

  server.registerTool(
    "connect_gmail",
    {
      description:
        "Start connecting a Gmail/Google Workspace inbox to send from. Returns a Google consent URL: give it to the user to open and approve, then call list_mailboxes to confirm it's connected.",
      inputSchema: { email: z.string().optional().describe("Google account to pre-select") },
    },
    ({ email }) => run(() => client().connectGmail(email)),
  );

  server.registerTool(
    "list_mailboxes",
    {
      description: "List connected sending mailboxes with their daily limit, what they may send today (effectiveLimit, lower while a new mailbox ramps up; rampDay) and status. A mailbox in `error` status lost access and must be reconnected with connect_gmail.",
      inputSchema: {},
    },
    () => run(() => client().listMailboxes()),
  );

  server.registerTool(
    "update_mailbox",
    {
      description: `Set a mailbox's daily send limit, the sender name recipients see, or its ramp.
New mailboxes ramp up automatically: they start at 10 emails a day and grow to their daily limit over 21 days (list_mailboxes shows effectiveLimit and rampDay). Turn the ramp off only for an inbox that already sends regularly.`,
      inputSchema: {
        mailbox_id: z.string(),
        daily_limit: z.number().int().min(1).max(500).optional(),
        display_name: z.string().optional(),
        ramp: z.boolean().optional().describe("true restarts the 21-day ramp from today; false sends at the full daily limit now"),
      },
    },
    ({ mailbox_id, daily_limit, display_name, ramp }) =>
      run(() => client().updateMailbox(mailbox_id, { dailyLimit: daily_limit, displayName: display_name, ramp })),
  );

  server.registerTool(
    "check_domains",
    {
      description: `Check SPF, DKIM and DMARC for every domain the workspace sends from. A missing record is a common reason mail lands in spam: tell the user which record to add before starting a sequence. "managed" means consumer Gmail, where Google handles it. DKIM is checked at Google Workspace's default selector ("google").`,
      inputSchema: {},
    },
    () => run(() => client().mailboxHealth()),
  );

  server.registerTool(
    "send_test_email",
    {
      description: "Send a test email from a connected mailbox to check it works. Only send to the user's own address.",
      inputSchema: { mailbox_id: z.string(), to: z.string() },
    },
    ({ mailbox_id, to }) => run(() => client().sendTestEmail(mailbox_id, to)),
  );

  server.registerTool(
    "create_sequence",
    {
      description: `Create a DRAFT email sequence for a table, sent from a pool of one or more connected mailboxes (see list_mailboxes). Each lead is assigned one mailbox and every step comes from it, in the same thread; more mailboxes means more volume per day.
Write short, plain, personal emails: step 1 with a subject, 1-3 follow-ups that reply in the same thread. Use only {{vars}} that the table's rows actually have; rows missing a used variable are skipped at enrollment.
Then: preview_sequence to check, enroll_rows, show the user the preview and enrollment counts, and only call start_sequence after the user approves.`,
      inputSchema: {
        table_id: z.string(),
        name: z.string(),
        mailbox_ids: z.array(z.string()).min(1).max(50),
        assignment: z
          .enum(["capacity", "even"])
          .optional()
          .describe("How leads are spread over the mailboxes: capacity (default) gives more to mailboxes that can send more today; even gives each the same number"),
        steps: z.array(stepSchema).min(1).max(10),
        timezone: z.string().optional().describe("IANA timezone of the recipients, e.g. Europe/Madrid (default)"),
        window_start_hour: z.number().int().min(0).max(23).optional().describe("Local hour sending starts on weekdays (default 9)"),
        window_end_hour: z.number().int().min(1).max(24).optional().describe("Local hour sending stops (default 17)"),
      },
    },
    (input) => run(() => client().createSequence(input)),
  );

  server.registerTool(
    "update_sequence",
    {
      description:
        "Edit a sequence's name, mailbox pool, assignment, send window or steps (steps replace all existing ones; pause an active sequence first). Changing mailbox_ids moves leads not yet emailed to the new pool; leads already mid-thread stay on their mailbox, or stop if it was removed.",
      inputSchema: {
        sequence_id: z.string(),
        name: z.string().optional(),
        mailbox_ids: z.array(z.string()).min(1).max(50).optional(),
        assignment: z.enum(["capacity", "even"]).optional(),
        steps: z.array(stepSchema).min(1).max(10).optional(),
        timezone: z.string().optional(),
        window_start_hour: z.number().int().min(0).max(23).optional(),
        window_end_hour: z.number().int().min(1).max(24).optional(),
      },
    },
    ({ sequence_id, ...patch }) => run(() => client().updateSequence(sequence_id, patch)),
  );

  server.registerTool(
    "preview_sequence",
    {
      description: "Render every step of a sequence for one row (the first row by default), exactly as it will be sent, plus any template variables that row is missing.",
      inputSchema: { sequence_id: z.string(), row_id: z.string().optional() },
    },
    ({ sequence_id, row_id }) => run(() => client().previewSequence(sequence_id, row_id)),
  );

  server.registerTool(
    "enroll_rows",
    {
      description:
        "Enroll rows from the sequence's table. Skips (and counts) rows with no email, an undeliverable email, an unsubscribed address, a missing template variable, or already enrolled. Enrolling doesn't send anything until the sequence is started.",
      inputSchema: {
        sequence_id: z.string(),
        row_ids: z.array(z.string()).optional(),
        filter: z.record(z.string(), z.unknown()).optional().describe('Exact-match filter, e.g. {"email_certainty": "ultra_sure"}'),
        limit: z.number().int().min(1).max(5000).optional(),
      },
    },
    ({ sequence_id, ...opts }) => run(() => client().enrollRows(sequence_id, opts)),
  );

  server.registerTool(
    "start_sequence",
    {
      description:
        "Start sending a sequence. Real emails go to real people from the user's mailbox: only call this after the user has seen the preview and explicitly approved. Sends respect the send window, the mailbox's daily limit and spacing.",
      inputSchema: { sequence_id: z.string() },
    },
    ({ sequence_id }) => run(() => client().startSequence(sequence_id)),
  );

  server.registerTool(
    "pause_sequence",
    { description: "Pause a sequence; nothing more is sent until it's started again.", inputSchema: { sequence_id: z.string() } },
    ({ sequence_id }) => run(() => client().pauseSequence(sequence_id)),
  );

  server.registerTool(
    "list_sequences",
    { description: "List sequences with status and enrollment counts.", inputSchema: {} },
    () => run(() => client().listSequences()),
  );

  server.registerTool(
    "sequence_stats",
    {
      description:
        "A sequence's enrollment states (active, completed, replied, unsubscribed, failed...), emails sent, reply rate, and its mailbox pool: each mailbox's sends today against its limit, ramp day and number of leads.",
      inputSchema: { sequence_id: z.string() },
    },
    ({ sequence_id }) =>
      run(async () => {
        const c = client();
        const [stats, pool] = await Promise.all([c.sequenceStats(sequence_id), c.sequencePool(sequence_id)]);
        return { ...stats, pool };
      }),
  );

  server.registerTool(
    "list_replies",
    {
      description: `Replies to the user's sequences that nobody has classified yet (newest first). Each has the reply text (quoted history removed), the earlier emails in the thread, and the prospect's table row.
Meerko already stopped the sequence for anyone who replied, and handled bounces, unsubscribe requests and out-of-office replies by itself (hidden here unless include_automatic).
Read each reply, decide its intent and save it with classify_reply. Summarize the interested ones and questions for the user.`,
      inputSchema: {
        sequence_id: z.string().optional(),
        intent: z.string().optional().describe("Only replies with this intent (then classified ones are included)"),
        include_automatic: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    ({ sequence_id, intent, include_automatic, limit }) =>
      run(() => client().listReplies({ sequenceId: sequence_id, intent, includeAutomatic: include_automatic, limit })),
  );

  server.registerTool(
    "classify_reply",
    {
      description: `Set a reply's intent after reading it: interested (wants to talk / asks for a meeting), question (asks something before deciding), not_now (timing), not_interested, referral (points to someone else), wrong_person, other. Set handled: true when no further action is needed.`,
      inputSchema: { reply_id: z.string(), intent: z.enum(REPLY_INTENTS), handled: z.boolean().optional() },
    },
    ({ reply_id, intent, handled }) => run(() => client().classifyReply(reply_id, intent, handled)),
  );

  server.registerTool(
    "draft_reply",
    {
      description: `Save a draft answer to a reply (from list_replies). Nothing is sent: the user reviews it first.
Write like a person answering an email: short, specific to what they said, in their language, with one clear next step (e.g. two meeting times or a booking link if the user gave you one). Sign off with the sender's first name: Gmail doesn't add the user's signature to emails sent through Meerko. Drafting again for the same reply replaces the pending draft.`,
      inputSchema: { reply_id: z.string(), body: z.string().describe("Plain text") },
    },
    ({ reply_id, body }) => run(() => client().draftReply(reply_id, body)),
  );

  server.registerTool(
    "list_drafts",
    {
      description: "Pending drafts with the reply each answers, the thread so far and the prospect's row. Show them to the user for approval.",
      inputSchema: {},
    },
    () => run(() => client().listDrafts()),
  );

  server.registerTool(
    "approve_draft",
    {
      description:
        "Send a draft as a reply in the same email thread, from the user's mailbox. Only call this after the user has read this specific draft and explicitly said to send it. Pass `body` if the user edited the text.",
      inputSchema: { draft_id: z.string(), body: z.string().optional() },
    },
    ({ draft_id, body }) => run(() => client().approveDraft(draft_id, body)),
  );

  server.registerTool(
    "discard_draft",
    { description: "Throw a pending draft away.", inputSchema: { draft_id: z.string() } },
    ({ draft_id }) => run(() => client().discardDraft(draft_id)),
  );

  server.registerTool(
    "pipeline",
    {
      description: `Lead counts per stage (${STAGES.join(" → ")}), for one table or the whole workspace. Meerko moves leads to contacted when the first email is sent and to replied when they answer; meeting, won and lost are set with move_stage.`,
      inputSchema: { table_id: z.string().optional() },
    },
    ({ table_id }) => run(() => client().pipeline(table_id)),
  );

  server.registerTool(
    "move_stage",
    {
      description: "Move leads (rows) to a pipeline stage, e.g. meeting when a call is booked, won or lost. Use query_rows with `stage` to find leads at a stage.",
      inputSchema: { table_id: z.string(), row_ids: z.array(z.string()).min(1), stage: z.enum(STAGES) },
    },
    ({ table_id, row_ids, stage }) => run(() => client().moveStage(table_id, row_ids, stage)),
  );

  server.registerTool(
    "get_credits",
    { description: "Show the workspace's credit balance (null when self-hosted with your own provider keys).", inputSchema: {} },
    () => run(() => client().getCredits()),
  );

  server.registerPrompt(
    "find-leads",
    {
      title: "Find leads",
      description: "Build a lead list from your ideal customer, with verified emails.",
      argsSchema: { icp: z.string().describe("Who you sell to, e.g. 'heads of growth at Series A fintechs in Spain'") },
    },
    ({ icp }) =>
      ask(
        `Build a Meerko lead list for: ${icp}.\n` +
          "1. Search with find_people (use find_companies first if the description is mostly about the company). Save results to a new table named after the audience.\n" +
          "2. Find and verify work emails with enrich_rows; call it again while rows remain.\n" +
          "3. Tell me how many leads you saved, how many have verified emails, and show 5 of them. Check get_credits first if credits are on, and ask before spending more than 500.",
      ),
  );

  server.registerPrompt(
    "write-sequence",
    {
      title: "Write a sequence",
      description: "Draft a 3-step email sequence for a table, in your voice.",
      argsSchema: {
        table: z.string().describe("The table's name or id"),
        offer: z.string().optional().describe("What you're offering, if it isn't obvious"),
      },
    },
    ({ table, offer }) =>
      ask(
        `Write a 3-step cold email sequence for the Meerko table "${table}".${offer ? ` The offer: ${offer}.` : ""}\n` +
          "- Short, plain-text, one clear ask per email; personalise with {{first_name}}, {{company}} and other columns the table has.\n" +
          "- Step 1 gets a subject; steps 2 and 3 reply in the same thread 3 and 4 days later.\n" +
          "- Send from every healthy mailbox I have (list_mailboxes; skip ones in error), create it with create_sequence, then show me preview_sequence for two rows. Run check_domains and tell me about any missing DNS record.\n" +
          "Don't enroll anyone or start the sequence until I say so.",
      ),
  );

  server.registerPrompt(
    "triage-replies",
    {
      title: "Triage replies",
      description: "Sort new replies by intent and draft answers for you to approve.",
      argsSchema: {},
    },
    () =>
      ask(
        "Go through my new Meerko replies (list_replies).\n" +
          "- Classify each one with classify_reply.\n" +
          "- For interested replies and questions, write a short answer with draft_reply that moves toward a call.\n" +
          "- Summarise what came in and list the drafts. Don't approve or send anything; I'll review them in the inbox.",
      ),
  );

  server.registerPrompt(
    "pipeline",
    {
      title: "Pipeline",
      description: "See who's interested, booked and won, and what needs you.",
      argsSchema: {},
    },
    () =>
      ask(
        "Give me a short Meerko pipeline update: counts per stage (pipeline), how each running sequence is doing (list_sequences, sequence_stats), " +
          "and the replies or drafts waiting on me (list_replies, list_drafts). End with the 3 things I should do next.",
      ),
  );

  return server;
}
