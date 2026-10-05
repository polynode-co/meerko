#!/usr/bin/env -S npx tsx
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { dirname } from "node:path";
import { Command } from "commander";
import { parse as parseCsv } from "csv-parse/sync";
import { CONFIG_PATH, DEFAULT_API_URL, MeerkoClient, REPLY_INTENTS, STAGES, type ReplyIntent, type Row, type Stage } from "@meerko/sdk";

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
  .option("-s, --stage <stage>", `only rows at this pipeline stage (${STAGES.join(", ")})`)
  .action(async (tableId: string, opts: { filter?: string; limit: string; offset: string; stage?: Stage }) => {
    const client = MeerkoClient.fromEnv();
    const rows: Row[] = await client.queryRows(tableId, {
      filter: opts.filter ? JSON.parse(opts.filter) : undefined,
      stage: opts.stage,
      limit: Number(opts.limit),
      offset: Number(opts.offset),
    });
    if (json()) return console.log(JSON.stringify(rows, null, 2));
    if (rows.length === 0) return console.log("No rows.");
    const keys = (await client.getTable(tableId)).columns.map((c) => c.key);
    console.table(rows.map((r) => ({ stage: r.stage, ...r.data })), ["stage", ...keys]);
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

tables
  .command("stage <tableId> <stage> <rowIds...>")
  .description(`move rows to a pipeline stage: ${STAGES.join(" | ")}`)
  .action(async (tableId: string, stage: string, rowIds: string[]) => {
    if (!STAGES.includes(stage as Stage)) throw new Error(`stage must be one of: ${STAGES.join(", ")}`);
    const { moved } = await MeerkoClient.fromEnv().moveStage(tableId, rowIds, stage as Stage);
    console.log(`Moved ${moved} row(s) to ${stage}.`);
  });

program
  .command("pipeline")
  .description("lead counts per stage")
  .option("-t, --table <tableId>", "only this table")
  .action(async (opts: { table?: string }) => {
    const p = await MeerkoClient.fromEnv().pipeline(opts.table);
    if (json()) return console.log(JSON.stringify(p, null, 2));
    console.log(STAGES.map((s) => `${s} ${p.stages[s]}`).join("  ·  ") + `   (${p.total} leads)`);
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
    console.log(
      `Saved ${res.inserted} of ${res.total} matching ${kind} to "${res.tableName}" (${res.tableId}).` +
        (res.creditsSpent ? ` ${res.creditsSpent} credits.` : "") +
        (res.cappedByCredits ? " Results were capped by your credit balance." : ""),
    );
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

const mailboxes = program.command("mailboxes").description("connect the inboxes Meerko sends from");

mailboxes
  .command("connect")
  .description("connect a Gmail or Google Workspace inbox (opens Google's consent page)")
  .option("-e, --email <address>", "pre-select this Google account")
  .action(async (opts: { email?: string }) => {
    const client = MeerkoClient.fromEnv();
    const before = new Set((await client.listMailboxes()).map((m) => `${m.id}:${m.status}`));
    const { url } = await client.connectGmail(opts.email);
    console.log(`Approve access in your browser:\n\n  ${url}\n`);
    // Best effort: open the browser; the printed link works either way.
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    spawn(opener, [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();

    console.log("Waiting for you to approve (Ctrl+C to stop)...");
    for (let i = 0; i < 150; i++) {
      await sleep(2000);
      const added = (await client.listMailboxes()).find((m) => m.status === "active" && !before.has(`${m.id}:${m.status}`));
      if (added) return console.log(`Connected ${added.email} (${added.id}). Send a test with \`meerko mailboxes test ${added.id} --to <you>\`.`);
    }
    throw new Error("Timed out waiting for Google approval. Run `meerko mailboxes connect` again.");
  });

mailboxes
  .command("ls")
  .description("list connected mailboxes")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listMailboxes();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No mailboxes. Connect one with `meerko mailboxes connect`.");
    console.table(list.map((m) => ({ id: m.id, email: m.email, name: m.displayName ?? "", daily_limit: m.dailyLimit, status: m.status, error: m.lastError ?? "" })));
  });

mailboxes
  .command("set <mailboxId>")
  .description("change a mailbox's daily send limit or sender name")
  .option("--daily-limit <n>", "max emails per day from this mailbox")
  .option("--name <displayName>", 'sender name shown to recipients, e.g. "Pia from Slalom"')
  .action(async (id: string, opts: { dailyLimit?: string; name?: string }) => {
    const m = await MeerkoClient.fromEnv().updateMailbox(id, {
      dailyLimit: opts.dailyLimit ? Number(opts.dailyLimit) : undefined,
      displayName: opts.name,
    });
    console.log(json() ? JSON.stringify(m) : `${m.email}: ${m.dailyLimit}/day, name "${m.displayName ?? ""}"`);
  });

mailboxes
  .command("test <mailboxId>")
  .description("send a test email to check the connection")
  .requiredOption("--to <address>", "recipient")
  .action(async (id: string, opts: { to: string }) => {
    await MeerkoClient.fromEnv().sendTestEmail(id, opts.to);
    console.log(`Test email sent to ${opts.to}.`);
  });

mailboxes
  .command("rm <mailboxId>")
  .description("disconnect a mailbox")
  .action(async (id: string) => {
    const { deleted } = await MeerkoClient.fromEnv().deleteMailbox(id);
    console.log(deleted ? "Mailbox disconnected." : "No such mailbox.");
  });

const seqs = program.command("sequences").alias("seq").description("multi-step email sequences sent from your mailbox");

seqs
  .command("ls")
  .description("list sequences")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listSequences();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No sequences. Create one with `meerko seq create <tableId> <file.json>`.");
    console.table(list.map((s) => ({ id: s.id, name: s.name, status: s.status, enrolled: s.enrolled })));
  });

seqs
  .command("create <tableId> <file>")
  .description('create a draft sequence from JSON: {"name","mailbox_id","steps":[{"subject","body"},{"body","delay_days"}]}')
  .action(async (tableId: string, file: string) => {
    const seq = await MeerkoClient.fromEnv().createSequence({ ...JSON.parse(readFileSync(file, "utf8")), table_id: tableId });
    console.log(json() ? JSON.stringify(seq, null, 2) : `Created draft "${seq.name}" (${seq.id}) with ${seq.steps.length} steps. Preview it with \`meerko seq preview ${seq.id}\`.`);
  });

seqs
  .command("preview <sequenceId>")
  .description("render every step for one row (the first by default)")
  .option("-r, --row <rowId>", "row to render")
  .action(async (id: string, opts: { row?: string }) => {
    const p = await MeerkoClient.fromEnv().previewSequence(id, opts.row);
    if (json()) return console.log(JSON.stringify(p, null, 2));
    console.log(`To: ${p.to ?? "(no email)"}` + (p.missingVars.length ? `   Missing: ${p.missingVars.join(", ")}` : ""));
    for (const s of p.steps) console.log(`\n--- Step ${s.position + 1}${s.position ? ` (+${s.delayDays}d)` : ""}: ${s.subject}\n${s.body}`);
  });

seqs
  .command("enroll <sequenceId>")
  .description("enroll rows from the sequence's table (rows that are unsafe to email are skipped)")
  .option("-f, --filter <json>", "only rows matching this exact-match filter")
  .option("-l, --limit <n>", "max rows")
  .action(async (id: string, opts: { filter?: string; limit?: string }) => {
    const res = await MeerkoClient.fromEnv().enrollRows(id, {
      filter: opts.filter ? JSON.parse(opts.filter) : undefined,
      limit: opts.limit ? Number(opts.limit) : undefined,
    });
    if (json()) return console.log(JSON.stringify(res));
    const skipped = Object.entries(res.skipped).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
    console.log(`Enrolled ${res.enrolled}.` + (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : ""));
  });

seqs
  .command("start <sequenceId>")
  .description("start sending (within the send window, respecting mailbox limits)")
  .action(async (id: string) => {
    const s = await MeerkoClient.fromEnv().startSequence(id);
    console.log(`"${s.name}" is active. Emails go out ${s.windowStartHour}:00-${s.windowEndHour}:00 ${s.timezone}, weekdays.`);
  });

seqs
  .command("pause <sequenceId>")
  .description("stop sending until started again")
  .action(async (id: string) => {
    const s = await MeerkoClient.fromEnv().pauseSequence(id);
    console.log(`"${s.name}" is paused.`);
  });

seqs
  .command("stats <sequenceId>")
  .description("enrollment states, emails sent and reply rate")
  .action(async (id: string) => {
    const s = await MeerkoClient.fromEnv().sequenceStats(id);
    if (json()) return console.log(JSON.stringify(s, null, 2));
    console.log(`${s.name} (${s.status}): ${s.enrolled} enrolled, ${s.emailsSent} emails sent, ${s.replyRate}% replied`);
    console.table(s.states);
  });

const replies = program.command("replies").description("replies to your sequences");

replies
  .command("ls", { isDefault: true })
  .description("list unclassified replies (newest first)")
  .option("-s, --sequence <id>", "only this sequence")
  .option("-i, --intent <intent>", `only this intent (${REPLY_INTENTS.join(", ")})`)
  .option("-a, --all", "include classified replies, out-of-office, bounces and unsubscribes")
  .option("-l, --limit <n>", "max replies", "25")
  .action(async (opts: { sequence?: string; intent?: string; all?: boolean; limit: string }) => {
    const list = await MeerkoClient.fromEnv().listReplies({
      sequenceId: opts.sequence,
      intent: opts.intent,
      unclassified: opts.all ? false : undefined,
      includeAutomatic: opts.all,
      limit: Number(opts.limit),
    });
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No replies waiting.");
    for (const r of list) {
      console.log(`\n[${r.id}] ${r.from} · ${r.sequenceName ?? ""} · ${new Date(r.receivedAt).toLocaleString()}${r.intent ? ` · ${r.intent}` : ""}`);
      console.log(r.body.split("\n").map((l) => `  ${l}`).join("\n"));
    }
  });

replies
  .command("classify <replyId> <intent>")
  .description(`set a reply's intent: ${REPLY_INTENTS.join(" | ")}`)
  .option("--done", "also mark it handled")
  .action(async (id: string, intent: string, opts: { done?: boolean }) => {
    if (!REPLY_INTENTS.includes(intent as ReplyIntent)) throw new Error(`intent must be one of: ${REPLY_INTENTS.join(", ")}`);
    const r = await MeerkoClient.fromEnv().classifyReply(id, intent as ReplyIntent, opts.done);
    console.log(`Marked ${r.reply.intent}${r.reply.handledAt ? " (handled)" : ""}.`);
  });

replies
  .command("draft <replyId> <file>")
  .description("save a draft answer to a reply from a text file (nothing is sent until approved)")
  .action(async (id: string, file: string) => {
    const d = await MeerkoClient.fromEnv().draftReply(id, readFileSync(file, "utf8"));
    console.log(`Draft ${d.id} saved. Review with \`meerko drafts\`, send with \`meerko drafts approve ${d.id}\`.`);
  });

const drafts = program.command("drafts").description("answers to replies, waiting for your approval");

drafts
  .command("ls", { isDefault: true })
  .description("list pending drafts with the reply they answer")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listDrafts();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No drafts waiting.");
    for (const d of list) {
      console.log(`\n[${d.id}] to ${d.to}${d.intent ? ` · ${d.intent}` : ""}`);
      console.log(`  They wrote:\n${d.replyBody.split("\n").map((l) => `    ${l}`).join("\n")}`);
      console.log(`  Draft:\n${d.body.split("\n").map((l) => `    ${l}`).join("\n")}`);
    }
  });

drafts
  .command("approve <draftId>")
  .description("send the draft as a reply in the same thread")
  .option("-f, --file <file>", "send this edited text instead of the draft")
  .action(async (id: string, opts: { file?: string }) => {
    const res = await MeerkoClient.fromEnv().approveDraft(id, opts.file ? readFileSync(opts.file, "utf8") : undefined);
    console.log(`Sent to ${res.to}: "${res.subject}".`);
  });

drafts
  .command("discard <draftId>")
  .description("throw a draft away")
  .action(async (id: string) => {
    await MeerkoClient.fromEnv().discardDraft(id);
    console.log("Draft discarded.");
  });

const keys = program.command("keys").description("bring your own provider keys (calls through them cost no credits)");

keys
  .command("ls")
  .description("list stored provider keys")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listProviderKeys();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No provider keys. Add one with `meerko keys set icypeas <key>`.");
    console.table(list.map((k) => ({ provider: k.provider, key: `…${k.last4}`, added: k.createdAt })));
  });

keys
  .command("set <provider> <key>")
  .description("store a provider key (supported: icypeas). It's checked with the provider first")
  .action(async (provider: string, key: string) => {
    const res = await MeerkoClient.fromEnv().setProviderKey(provider, key);
    console.log(json() ? JSON.stringify(res) : `Saved ${res.provider} key …${res.last4}. Searches and enrichment now use it, with no credits charged.`);
  });

keys
  .command("rm <provider>")
  .description("remove a stored provider key")
  .action(async (provider: string) => {
    const { deleted } = await MeerkoClient.fromEnv().deleteProviderKey(provider);
    console.log(deleted ? `Removed ${provider} key.` : `No ${provider} key was stored.`);
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
