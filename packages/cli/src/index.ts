#!/usr/bin/env -S npx tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Command } from "commander";
import { parse as parseCsv } from "csv-parse/sync";
import { CONFIG_PATH, DEFAULT_API_URL, MeerkoClient, type Row } from "@meerko/sdk";

const program = new Command("meerko").description("Meerko — the open-source GTM agent.").version("0.0.0");
const json = () => program.opts<{ json?: boolean }>().json;
program.option("--json", "print raw JSON (handy for agents and scripts)");

program
  .command("login")
  .description("save your API key and API URL to ~/.meerko/config.json")
  .requiredOption("--key <apiKey>", "API key (starts with mk_)")
  .option("--url <apiUrl>", "API URL", DEFAULT_API_URL)
  .action(async ({ key, url }: { key: string; url: string }) => {
    const tables = await new MeerkoClient({ apiUrl: url, apiKey: key }).listTables(); // verifies the key
    mkdirSync(dirname(CONFIG_PATH), { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify({ apiUrl: url, apiKey: key }, null, 2), { mode: 0o600 });
    console.log(`Logged in to ${url} (${tables.length} tables). Config saved to ${CONFIG_PATH}`);
  });

const tables = program.command("tables").description("manage prospect tables");

tables
  .command("ls")
  .description("list tables")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listTables();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No tables yet. Create one with `meerko tables create <name>`.");
    console.table(list.map((t) => ({ id: t.id, name: t.name, rows: t.rowCount, columns: t.columns.length })));
  });

tables
  .command("create <name>")
  .description("create a table")
  .action(async (name: string) => {
    const table = await MeerkoClient.fromEnv().createTable({ name });
    console.log(json() ? JSON.stringify(table, null, 2) : `Created table "${table.name}" (${table.id})`);
  });

tables
  .command("add-column <tableId> <name>")
  .description("add a column")
  .option("-t, --type <type>", "text | number | email | url | boolean | json", "text")
  .action(async (tableId: string, name: string, { type }: { type: "text" }) => {
    const table = await MeerkoClient.fromEnv().addColumn(tableId, { name, type });
    console.log(json() ? JSON.stringify(table, null, 2) : `Columns: ${table.columns.map((c) => c.key).join(", ")}`);
  });

tables
  .command("import <tableId> <file>")
  .description("import rows from a CSV (with header row) or a JSON array file")
  .action(async (tableId: string, file: string) => {
    const content = readFileSync(file, "utf8");
    const rows: Record<string, unknown>[] = file.toLowerCase().endsWith(".json")
      ? JSON.parse(content)
      : parseCsv(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const client = MeerkoClient.fromEnv();
    let inserted = 0;
    const added = new Set<string>();
    for (let i = 0; i < rows.length; i += 5000) {
      const res = await client.insertRows(tableId, rows.slice(i, i + 5000));
      inserted += res.inserted;
      res.addedColumns.forEach((c) => added.add(c.key));
    }
    if (json()) return console.log(JSON.stringify({ inserted, addedColumns: [...added] }));
    console.log(`Imported ${inserted} rows.` + (added.size ? ` New columns: ${[...added].join(", ")}` : ""));
  });

tables
  .command("rows <tableId>")
  .description("list rows, optionally filtered")
  .option("-f, --filter <json>", `exact-match filter, e.g. '{"country":"Spain"}'`)
  .option("-l, --limit <n>", "max rows", "50")
  .option("-o, --offset <n>", "rows to skip", "0")
  .action(async (tableId: string, opts: { filter?: string; limit: string; offset: string }) => {
    const client = MeerkoClient.fromEnv();
    const rows: Row[] = await client.queryRows(tableId, {
      filter: opts.filter ? JSON.parse(opts.filter) : undefined,
      limit: Number(opts.limit),
      offset: Number(opts.offset),
    });
    if (json()) return console.log(JSON.stringify(rows, null, 2));
    if (rows.length === 0) return console.log("No rows.");
    const keys = (await client.getTable(tableId)).columns.map((c) => c.key);
    console.table(rows.map((r) => r.data), keys);
  });

program
  .command("find <kind>")
  .description("search Icypeas for people or companies and save the results to a table")
  .requiredOption("-q, --query <json>", `filters, e.g. '{"currentJobTitle":{"include":["CTO"]},"location":{"include":["ES"]}}'`)
  .option("-l, --limit <n>", "max results to fetch (costs credits)", "25")
  .option("-t, --table <tableId>", "append to an existing table")
  .option("-n, --name <tableName>", "name for the new table")
  .option("-c, --count", "only count matches (free)")
  .action(async (kind: string, opts: { query: string; limit: string; table?: string; name?: string; count?: boolean }) => {
    if (kind !== "people" && kind !== "companies") throw new Error("kind must be `people` or `companies`");
    const client = MeerkoClient.fromEnv();
    const query = JSON.parse(opts.query);
    if (opts.count) {
      const total = await client.countLeads(kind, query);
      return console.log(json() ? JSON.stringify({ total }) : `${total} ${kind} match.`);
    }
    const res = await client.searchLeads(kind, { query, limit: Number(opts.limit), tableId: opts.table, tableName: opts.name });
    if (json()) return console.log(JSON.stringify(res, null, 2));
    console.log(`Saved ${res.inserted} of ${res.total} matching ${kind} to "${res.tableName}" (${res.tableId}).`);
  });

program.parseAsync().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
