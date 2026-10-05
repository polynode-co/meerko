#!/usr/bin/env -S npx tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MeerkoClient } from "@meerko/sdk";

const columnType = z.enum(["text", "number", "email", "url", "boolean", "json"]);
const server = new McpServer({ name: "meerko", version: "0.0.0" });

// Resolved per call so a missing key surfaces as a tool error, not a crashed server.
const client = () => MeerkoClient.fromEnv();

async function run(fn: () => Promise<unknown>) {
  try {
    return { content: [{ type: "text" as const, text: JSON.stringify(await fn(), null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text" as const, text: (err as Error).message }] };
  }
}

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
    description: "Add a column to a table.",
    inputSchema: { table_id: z.string(), name: z.string(), type: columnType.optional() },
  },
  ({ table_id, name, type }) => run(() => client().addColumn(table_id, { name, type })),
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
    description: "Read rows from a table. `filter` is an exact-match object on column keys, e.g. {\"country\": \"Spain\"}.",
    inputSchema: {
      table_id: z.string(),
      filter: z.record(z.string(), z.unknown()).optional(),
      limit: z.number().int().min(1).max(1000).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  ({ table_id, ...opts }) => run(() => client().queryRows(table_id, opts)),
);

await server.connect(new StdioServerTransport());
