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
  .option("-p, --prompt <prompt>", "make it an AI column: an instruction your agent answers per row ({{column_key}} inserts values)")
  .action(async (tableId: string, name: string, { type, prompt }: { type: "text"; prompt?: string }) => {
    const table = await MeerkoClient.fromEnv().addColumn(tableId, { name, type, prompt });
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

tables
  .command("pending <tableId> <column>")
  .description("print rows whose AI column is still empty, with the instruction rendered per row (JSON)")
  .option("-l, --limit <n>", "max rows", "25")
  .action(async (tableId: string, column: string, opts: { limit: string }) => {
    const res = await MeerkoClient.fromEnv().getPendingCells(tableId, column, { limit: Number(opts.limit) });
    console.log(JSON.stringify(res, null, 2));
  });

tables
  .command("update <tableId> <file>")
  .description("merge values into rows from a JSON file: [{ \"id\": \"<rowId>\", \"data\": { ... } }]")
  .action(async (tableId: string, file: string) => {
    const res = await MeerkoClient.fromEnv().updateRows(tableId, JSON.parse(readFileSync(file, "utf8")));
    console.log(json() ? JSON.stringify(res) : `Updated ${res.updated} rows.`);
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

program
  .command("enrich <tableId>")
  .description("find and verify emails for rows that don't have them yet")
  .option("--fields <list>", "comma-separated: email, email_verification", "email,email_verification")
  .option("-f, --filter <json>", "only enrich rows matching this exact-match filter")
  .option("-l, --limit <n>", "rows per batch (max 50)", "25")
  .option("--all", "keep going in batches until no rows remain")
  .option("--overwrite", "re-run rows that already have a result")
  .action(async (tableId: string, opts: { fields: string; filter?: string; limit: string; all?: boolean; overwrite?: boolean }) => {
    const client = MeerkoClient.fromEnv();
    const input = {
      fields: opts.fields.split(",").map((f) => f.trim()) as ("email" | "email_verification")[],
      filter: opts.filter ? JSON.parse(opts.filter) : undefined,
      limit: Number(opts.limit),
      overwrite: opts.overwrite,
    };
    while (true) {
      const res = await client.enrichRows(tableId, input);
      if (json()) console.log(JSON.stringify(res));
      else
        console.log(
          `Processed ${res.processed}: ${res.found.email} emails found, ${res.found.email_verification} verified, ` +
            `${res.notFound} not found, ${res.errors} errors. ${res.creditsSpent} credits` +
            (res.balance !== undefined ? ` (balance ${res.balance})` : "") +
            `. ${res.remaining} rows remaining.` +
            (res.firstError ? `\n  First error: ${res.firstError}` : ""),
        );
      if (res.stoppedReason === "insufficient_credits") throw new Error("Out of credits");
      // Overwrite re-selects the same rows every batch, so it never loops.
      if (!opts.all || opts.overwrite || res.remaining === 0 || res.processed === 0) break;
      if (res.errors === res.processed) throw new Error("Every row in the batch failed; stopping");
    }
  });

program
  .command("credits")
  .description("show the workspace credit balance")
  .action(async () => {
    const res = await MeerkoClient.fromEnv().getCredits();
    if (json()) return console.log(JSON.stringify(res));
    console.log(res.enabled ? `${res.balance} credits` : "Credits are off (self-hosted with your own provider keys).");
  });

program.parseAsync().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
