// Every CLI command. index.ts runs it; the docs reference is generated from it (scripts/docs-reference.mts).
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { hostname } from "node:os";
import { readFileSync, rmSync } from "node:fs";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import { Command } from "commander";
import { parse as parseCsv } from "csv-parse/sync";
import {
  CONFIG_PATH,
  DEFAULT_API_URL,
  MAIL_PROVIDERS,
  MeerkoClient,
  readStoredConfig,
  REPLY_INTENTS,
  STAGES,
  writeStoredConfig,
  type MailProviderId,
  type MailServers,
  type ReplyIntent,
  type Row,
  type Stage,
} from "@meerko/sdk";

export const program = new Command("meerko").description("Meerko — the open-source GTM agent.").version("0.0.0");
const json = () => program.opts<{ json?: boolean }>().json;
program.option("--json", "print raw JSON (handy for agents and scripts)");

/** Best effort: opens `url` in the default browser. Callers print the link too. */
function openInBrowser(url: string) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  spawn(opener, [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
}

/** Reads one line from the terminal (or stdin). `hidden` keeps a password off the screen. */
async function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (hidden) {
    // readline echoes what's typed through _writeToOutput; let only the question through.
    const out = rl as unknown as { _writeToOutput: (s: string) => void };
    out._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(question);
    };
  }
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
    if (hidden) process.stdout.write("\n");
    return answer.trim();
  } finally {
    rl.close();
  }
}

/**
 * OAuth sign-in for a CLI (RFC 8252): registers this machine, opens the consent page in the browser and
 * catches the redirect on a one-off loopback port. PKCE means the code is useless to anyone else.
 */
async function loginWithBrowser(apiUrl: string) {
  const metaRes = await fetch(new URL("/.well-known/oauth-authorization-server", apiUrl)).catch(() => null);
  if (!metaRes?.ok) throw new Error(`${apiUrl} doesn't offer browser sign-in. Use \`meerko login --key <key>\` instead.`);
  const meta = (await metaRes.json()) as { authorization_endpoint: string; token_endpoint: string; registration_endpoint: string };

  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  try {
    const reg = await fetch(meta.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: `Meerko CLI (${hostname()})`, redirect_uris: [redirectUri] }),
    });
    if (!reg.ok) throw new Error(`Couldn't register the CLI: ${await reg.text()}`);
    const { client_id: clientId } = (await reg.json()) as { client_id: string };

    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(16).toString("base64url");
    const authorize = new URL(meta.authorization_endpoint);
    for (const [k, v] of Object.entries({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      state,
    })) authorize.searchParams.set(k, v);

    console.log(`Approve the CLI in your browser:\n\n  ${authorize}\n`);
    openInBrowser(authorize.toString());
    console.log("Waiting for you to approve (Ctrl+C to stop)...");

    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for approval. Run `meerko login` again.")), 5 * 60_000);
      server.on("request", (req, res) => {
        const url = new URL(req.url ?? "/", redirectUri);
        if (url.pathname !== "/callback") return res.writeHead(404).end();
        const ok = url.searchParams.get("state") === state && url.searchParams.get("code");
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(`<!doctype html><title>Meerko</title><body style="font-family:system-ui;margin:15vh auto;max-width:28rem">
<h1 style="font-size:1.3rem">${ok ? "You're signed in" : "Sign-in didn't finish"}</h1><p>${ok ? "Go back to your terminal; you can close this tab." : "Go back to your terminal and try again."}</p></body>`);
        clearTimeout(timer);
        if (ok) resolve(url.searchParams.get("code")!);
        else reject(new Error(url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "Sign-in was cancelled."));
      });
    });

    const tokenRes = await fetch(meta.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirectUri, code_verifier: verifier }),
    });
    const tokens = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; error_description?: string };
    if (!tokenRes.ok || !tokens.access_token || !tokens.refresh_token) throw new Error(`Sign-in failed: ${tokens.error_description ?? tokenRes.statusText}`);
    return { clientId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
  } finally {
    server.close();
  }
}

program
  .command("login")
  .description("sign in with your browser (or an API key) and save it to ~/.meerko/config.json")
  .option("--key <apiKey>", "use an API key instead of the browser (starts with mk_)")
  .option("--url <apiUrl>", "API URL", DEFAULT_API_URL)
  .action(async ({ key, url }: { key?: string; url: string }) => {
    if (key) {
      const me = await new MeerkoClient({ apiUrl: url, apiKey: key }).me(); // verifies the key
      writeStoredConfig({ apiUrl: url, apiKey: key });
      return console.log(`Logged in to ${me.workspace.name} on ${url}. Config saved to ${CONFIG_PATH}`);
    }
    const oauth = await loginWithBrowser(url);
    const me = await new MeerkoClient({ apiUrl: url, apiKey: oauth.accessToken }).me();
    writeStoredConfig({ apiUrl: url, oauth });
    console.log(`Logged in to ${me.workspace.name} on ${url}. Config saved to ${CONFIG_PATH}`);
  });

program
  .command("logout")
  .description("sign out: revoke the browser sign-in and forget the saved key")
  .action(async () => {
    const stored = readStoredConfig();
    if (stored.oauth && stored.apiUrl) {
      await fetch(new URL("/oauth/revoke", stored.apiUrl), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: stored.oauth.refreshToken }),
      }).catch(() => {});
    }
    rmSync(CONFIG_PATH, { force: true });
    console.log("Logged out.");
  });

const workspaces = program.command("workspaces").description("your workspaces, one per brand (browser sign-in; an API key stays in its own)");

workspaces
  .command("ls")
  .description("list your workspaces; * marks the one commands act on")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listWorkspaces();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    console.table(list.map((w) => ({ "": w.current ? "*" : "", id: w.id, name: w.name, role: w.role ?? "api key" })));
  });

workspaces
  .command("use <workspace>")
  .description("act on another workspace from now on (an id or exact name from `workspaces ls`)")
  .action(async (target: string) => {
    const client = MeerkoClient.fromEnv();
    const list = await client.listWorkspaces();
    const match = list.find((w) => w.id === target) ?? list.filter((w) => w.name.toLowerCase() === target.toLowerCase())[0];
    if (!match) throw new Error(`No workspace "${target}". Run \`meerko workspaces ls\`.`);
    const ws = await client.switchWorkspace(match.id);
    console.log(json() ? JSON.stringify(ws, null, 2) : `Now working in ${ws.name}.`);
  });

workspaces
  .command("create <name>")
  .description("create a workspace for another brand (shares your plan and credits)")
  .option("--use", "switch to it")
  .action(async (name: string, opts: { use?: boolean }) => {
    const client = MeerkoClient.fromEnv();
    const ws = await client.createWorkspace(name);
    if (opts.use) await client.switchWorkspace(ws.id);
    console.log(json() ? JSON.stringify(ws, null, 2) : `Created ${ws.name} (${ws.id})${opts.use ? ", and switched to it" : ". Switch with `meerko workspaces use`"}.`);
  });

workspaces
  .command("rename <workspaceId> <name>")
  .description("rename a workspace (owners)")
  .action(async (id: string, name: string) => {
    const ws = await MeerkoClient.fromEnv().renameWorkspace(id, name);
    console.log(json() ? JSON.stringify(ws, null, 2) : `Renamed to ${ws.name}.`);
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
    console.log(`Imported ${inserted} ${inserted === 1 ? "row" : "rows"}.` + (added.size ? ` New columns: ${[...added].join(", ")}` : ""));
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
  .command("delete-rows <tableId> <rowIds...>")
  .description("delete leads by row id (their sequences stop; sent emails and do-not-email entries stay)")
  .action(async (tableId: string, rowIds: string[]) => {
    const { deleted } = await MeerkoClient.fromEnv().deleteRows(tableId, rowIds);
    console.log(json() ? JSON.stringify({ deleted }) : `Deleted ${deleted} row${deleted === 1 ? "" : "s"}.`);
  });

tables
  .command("delete <tableId>")
  .description("delete a table with its rows and its paused or draft sequences (pause active ones first)")
  .option("-y, --yes", "don't ask for confirmation")
  .action(async (tableId: string, opts: { yes?: boolean }) => {
    const client = MeerkoClient.fromEnv();
    if (!opts.yes) {
      const table = await client.getTable(tableId);
      const answer = await ask(`Delete "${table.name}" and all its rows? Type the table name to confirm: `);
      if (answer !== table.name) throw new Error("Not deleted: the name didn't match.");
    }
    const res = await client.deleteTable(tableId);
    console.log(json() ? JSON.stringify(res) : `Deleted the table, ${res.rows} rows and ${res.sequences} sequence${res.sequences === 1 ? "" : "s"}.`);
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
  .command("website <url>")
  .description("read a website's home page (title, description, headings, text) to work out who it sells to; free")
  .action(async (url: string) => {
    const site = await MeerkoClient.fromEnv().readWebsite(url);
    if (json()) return console.log(JSON.stringify(site, null, 2));
    console.log([site.title ?? site.url, site.description, site.headings.length ? `Headings: ${site.headings.join(" · ")}` : null, "", site.text].filter((l) => l !== null).join("\n"));
  });

program
  .command("enrich <tableId>")
  .description("find and verify emails (or, with --fields phone, phone numbers) for rows that don't have them yet")
  .option("--fields <list>", "comma-separated: email, email_verification, phone (80 credits each, Pro)", "email,email_verification")
  .option("-f, --filter <json>", "only enrich rows matching this exact-match filter")
  .option("-l, --limit <n>", "rows per batch (max 50)", "25")
  .option("--all", "keep going in batches until no rows remain")
  .option("--overwrite", "re-run rows that already have a result")
  .action(async (tableId: string, opts: { fields: string; filter?: string; limit: string; all?: boolean; overwrite?: boolean }) => {
    const client = MeerkoClient.fromEnv();
    const input = {
      fields: opts.fields.split(",").map((f) => f.trim()) as ("email" | "email_verification" | "phone")[],
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
            (res.found.phone ? `${res.found.phone} phones found, ` : "") +
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
  .description("connect an inbox: Gmail by default (app password, from MEERKO_APP_PASSWORD or asked), --provider outlook (signs in with Microsoft in your browser), or zoho, zoho-eu, fastmail, other")
  .option("-e, --email <address>", "the address to send from")
  .option("-p, --provider <provider>", `gmail (default), ${Object.keys(MAIL_PROVIDERS).filter((p) => p !== "gmail").join(", ")}`, "gmail")
  .option("--login <account>", "the account to sign in as, when it isn't the address (a Gmail alias's account, or a provider's user name)")
  .option("--imap-host <host>", "with --provider other: the IMAP server (TLS, port 993)")
  .option("--smtp-host <host>", "with --provider other: the SMTP server")
  .option("--smtp-port <port>", "with --provider other: 465 (TLS, default) or 587 (STARTTLS)", "465")
  .option("--name <name>", "sender name shown to recipients")
  .option("--google", "use Google's consent page instead, where the server has it on")
  .action(
    async (opts: { email?: string; provider: string; login?: string; imapHost?: string; smtpHost?: string; smtpPort: string; name?: string; google?: boolean }) => {
      const client = MeerkoClient.fromEnv();
      if (opts.google) return connectWithGoogle(client, opts.email);
      if (opts.provider === "outlook") return connectWithBrowser(client, () => client.connectOutlook(opts.email), "Microsoft");
      if (!(opts.provider in MAIL_PROVIDERS)) throw new Error(`Unknown provider "${opts.provider}". Use one of: ${Object.keys(MAIL_PROVIDERS).join(", ")}`);
      const provider = opts.provider as MailProviderId;
      let servers = MAIL_PROVIDERS[provider].servers;
      if (provider === "other") {
        if (!opts.imapHost || !opts.smtpHost) throw new Error("--provider other needs --imap-host and --smtp-host");
        servers = { imap: { host: opts.imapHost, port: 993 }, smtp: { host: opts.smtpHost, port: Number(opts.smtpPort) } };
      }

      const email = opts.email ?? (await ask("Address to send from: "));
      let password = process.env.MEERKO_APP_PASSWORD;
      if (!password) {
        console.log(
          provider === "gmail"
            ? "Create an app password for this account at https://myaccount.google.com/apppasswords (it needs 2-Step Verification on).\n" +
                "Google emails you a security alert when it's created and first used: that's expected.\n"
            : `Use an app password from ${MAIL_PROVIDERS[provider].name} if it offers them, and make sure IMAP is turned on for the account.\n`,
        );
        password = await ask(provider === "gmail" ? "App password (16 letters, not shown): " : "Password or app password (not shown): ", true);
      }
      const mailbox = servers
        ? await client.connectImapMailbox({ email, password, servers, login: opts.login, displayName: opts.name })
        : await client.connectGmailAppPassword({ email, password, login: opts.login, displayName: opts.name });
      console.log(`Connected ${mailbox.email} (${mailbox.id}). Send a test with \`meerko mailboxes test ${mailbox.id} --to <you>\`.`);
    },
  );

/** Google's consent page (Gmail API). Only where the server has it on (MEERKO_GMAIL_OAUTH=1). */
function connectWithGoogle(client: MeerkoClient, email?: string) {
  return connectWithBrowser(client, () => client.connectGmail(email), "Google");
}

/** Opens a sign-in page (Google's or Microsoft's) and waits until the new mailbox shows up. */
async function connectWithBrowser(client: MeerkoClient, start: () => Promise<{ url: string }>, provider: string) {
  const before = new Set((await client.listMailboxes()).map((m) => `${m.id}:${m.status}`));
  const { url } = await start();
  console.log(`Approve access in your browser:\n\n  ${url}\n`);
  openInBrowser(url);

  console.log("Waiting for you to approve (Ctrl+C to stop)...");
  for (let i = 0; i < 150; i++) {
    await sleep(2000);
    const added = (await client.listMailboxes()).find((m) => m.status === "active" && !before.has(`${m.id}:${m.status}`));
    if (added) return console.log(`Connected ${added.email} (${added.id}). Send a test with \`meerko mailboxes test ${added.id} --to <you>\`.`);
  }
  throw new Error(`Timed out waiting for ${provider} approval. Run \`meerko mailboxes connect\` again.`);
}

mailboxes
  .command("ls")
  .description("list connected mailboxes")
  .action(async () => {
    const list = await MeerkoClient.fromEnv().listMailboxes();
    if (json()) return console.log(JSON.stringify(list, null, 2));
    if (list.length === 0) return console.log("No mailboxes. Connect one with `meerko mailboxes connect`.");
    console.table(
      list.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.displayName ?? "",
        today: m.rampDay ? `${m.effectiveLimit}/day (ramp day ${m.rampDay}/21)` : `${m.effectiveLimit}/day`,
        status: m.status,
        error: m.lastError ?? "",
      })),
    );
  });

mailboxes
  .command("health")
  .description("check SPF, DKIM and DMARC for every domain you send from")
  .action(async () => {
    const domains = await MeerkoClient.fromEnv().mailboxHealth();
    if (json()) return console.log(JSON.stringify(domains, null, 2));
    if (domains.length === 0) return console.log("No mailboxes connected yet.");
    console.table(domains.map((d) => ({ domain: d.domain, spf: d.spf, dkim: d.dkim, dmarc: d.dmarc })));
    if (domains.some((d) => [d.spf, d.dkim, d.dmarc].includes("missing"))) {
      console.log("Missing records make spam more likely; the email deliverability guide on the Meerko site has the setup steps.");
    }
  });

mailboxes
  .command("set <mailboxId>")
  .description("change a mailbox's daily send limit, sender name or ramp")
  .option("--daily-limit <n>", "max emails per day from this mailbox")
  .option("--name <displayName>", 'sender name shown to recipients, e.g. "Pia from Slalom"')
  .option("--ramp", "restart the 21-day ramp from today (new mailboxes ramp automatically)")
  .option("--no-ramp", "send at the full daily limit now")
  .action(async (id: string, opts: { dailyLimit?: string; name?: string; ramp?: boolean }) => {
    const m = await MeerkoClient.fromEnv().updateMailbox(id, {
      dailyLimit: opts.dailyLimit ? Number(opts.dailyLimit) : undefined,
      displayName: opts.name,
      ramp: opts.ramp,
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
  .description('create a draft sequence from JSON: {"name","mailbox_ids":[…],"steps":[{"subject","body"},{"body","delay_days"}]}')
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

seqs
  .command("pool <sequenceId>")
  .description("the mailboxes a sequence sends from, with today's sends and leads per mailbox")
  .action(async (id: string) => {
    const p = await MeerkoClient.fromEnv().sequencePool(id);
    if (json()) return console.log(JSON.stringify(p, null, 2));
    console.log(`${p.sentToday} of ${p.capacityToday} sends today, assignment: ${p.assignment}`);
    console.table(
      p.mailboxes.map((m) => ({
        email: m.email,
        status: m.status === "active" ? (m.rampDay ? `ramping, day ${m.rampDay}/21` : "ready") : "reconnect",
        today: `${m.sentToday}/${m.effectiveLimit}`,
        leads: m.leads,
      })),
    );
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
  .description("store a provider key (supported: icypeas, firecrawl, generect). It's checked with the provider first")
  .action(async (provider: string, key: string) => {
    const res = await MeerkoClient.fromEnv().setProviderKey(provider, key);
    const done =
      res.provider === "firecrawl"
        ? "Email finding now tries Firecrawl when Icypeas misses; what it finds costs no credits."
        : res.provider === "generect"
          ? "Missed emails and phone numbers now go through your Generect account, on any plan, with no credits charged."
          : "Searches and enrichment now use it, with no credits charged.";
    console.log(json() ? JSON.stringify(res) : `Saved ${res.provider} key …${res.last4}. ${done}`);
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
    if (!res.enabled) return console.log("Credits are off (self-hosted with your own provider keys).");
    console.log(`${res.balance} credits${res.plan ? ` · ${res.plan === "pro" ? "Pro" : "Free"} plan` : ""}`);
    if (res.buy_url) console.log(`Buy more: ${res.buy_url}`);
  });
