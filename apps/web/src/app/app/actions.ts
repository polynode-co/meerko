"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parse as parseCsv } from "csv-parse/sync";
import { MAIL_PROVIDERS, MeerkoApiError, MeerkoClient, REPLY_INTENTS, STAGES, type MailProviderId, type MailServers, type ReplyIntent, type SequenceStep, type Stage } from "@meerko/sdk";
import { apiUrl, meerko, safeNext, SESSION_COOKIE, setSessionCookie } from "@/lib/meerko";
import { buildLeadQuery, defaultTableName } from "@/lib/lead-query";
import { site } from "@/lib/site";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

// Every action re-reads the key from the cookie (actions are plain POST endpoints) and
// turns API errors into a message the UI can show, instead of an error page.
async function run(fn: (c: MeerkoClient) => Promise<string | void>, paths: string[]): Promise<ActionResult> {
  try {
    const message = await fn(await meerko());
    for (const p of paths) revalidatePath(p, p === "/app" ? "layout" : "page");
    return { ok: true, message: message || undefined };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function login(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const key = String(form.get("key") ?? "").trim();
  if (!key.startsWith("mk_")) return { ok: false, error: "Meerko API keys start with mk_" };
  try {
    await new MeerkoClient({ apiUrl: apiUrl(), apiKey: key }).listTables();
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.status === 401 ? "That key isn't valid" : err.message };
    return { ok: false, error: `Can't reach the Meerko API at ${apiUrl()}` };
  }
  await setSessionCookie(key);
  redirect(safeNext(String(form.get("next") ?? "")) ?? "/app");
}

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  // Ends the session server-side too; an API key (self-hosting) just stays valid for the CLI.
  if (token?.startsWith("ms_")) await new MeerkoClient({ apiUrl: apiUrl(), apiKey: token }).logout().catch(() => {});
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

// --- Workspaces (brands). Switching moves this browser's session only; ids on the old page belong to the old
// workspace, so both land on the overview.

export async function switchWorkspace(form: FormData) {
  const id = String(form.get("workspace_id") ?? "");
  const res = await run((c) => c.switchWorkspace(id).then(() => {}), []);
  if (!res.ok) redirect(`/app?workspace_error=${encodeURIComponent(res.error)}`);
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function createWorkspace(_: unknown, form: FormData): Promise<ActionResult> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give it a name, like the brand" };
  const res = await run(async (c) => {
    const ws = await c.createWorkspace(name);
    await c.switchWorkspace(ws.id);
  }, []);
  if (!res.ok) return res;
  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function renameWorkspace(_: unknown, form: FormData): Promise<ActionResult> {
  const id = String(form.get("workspace_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "The name can't be empty" };
  return run((c) => c.renameWorkspace(id, name).then((w) => `Renamed to ${w.name}`), ["/app"]);
}

/** The new key is returned once, for the Connections page to show; only its prefix is stored. */
export async function createApiKey(_: unknown, form: FormData): Promise<ActionResult & { key?: string }> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the key a name, like the machine or agent that will use it" };
  const scope = form.get("scope") === "replies" ? "replies" : "full";
  try {
    const { key } = await (await meerko()).createApiKey(name, scope);
    revalidatePath("/app/settings");
    return { ok: true, key };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

const AUTOPILOT = ["/app/autopilot"];

/** The routine form's fields; `cadence` only for a scheduled routine. */
function routineFields(form: FormData) {
  const when = form.get("when") === "replies" ? ("replies" as const) : ("schedule" as const);
  return {
    name: String(form.get("name") ?? "").trim(),
    brief: String(form.get("brief") ?? "").trim(),
    when,
    cadence:
      when === "schedule"
        ? { days: form.getAll("days").map(Number), time: String(form.get("time") ?? ""), timezone: String(form.get("timezone") ?? "") }
        : undefined,
  };
}

export async function createRoutine(_: unknown, form: FormData): Promise<ActionResult> {
  return run((c) => c.createRoutine(routineFields(form)).then(() => "Created. Choose how it runs below."), AUTOPILOT);
}

export async function updateRoutine(_: unknown, form: FormData): Promise<ActionResult> {
  const id = String(form.get("id") ?? "");
  return run((c) => c.updateRoutine(id, routineFields(form)).then(() => "Saved"), AUTOPILOT);
}

export async function setRoutineStatus(id: string, status: "active" | "paused") {
  return run((c) => c.updateRoutine(id, { status }).then(() => (status === "active" ? "Resumed, from now" : "Paused")), AUTOPILOT);
}

export async function deleteRoutine(id: string) {
  return run((c) => c.deleteRoutine(id).then(() => "Deleted"), AUTOPILOT);
}

export async function runRoutine(id: string): Promise<ActionResult> {
  try {
    const res = await (await meerko()).runRoutine(id);
    revalidatePath("/app/autopilot");
    if (res.started) return { ok: true, message: "Started" };
    if (res.error) return { ok: false, error: res.error };
    return { ok: false, error: "This routine runs on your AI's own schedule, so Meerko can't start it. Run its prompt in your AI." };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Sets what starts a routine. A webhook's signing secret comes back once, for the page to show. */
export async function setRoutineTrigger(_: unknown, form: FormData): Promise<ActionResult & { secret?: string }> {
  const id = String(form.get("id") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (kind !== "own_scheduler" && kind !== "claude_routine" && kind !== "webhook") return { ok: false, error: "Choose what starts it" };
  const url = String(form.get("url") ?? "").trim();
  const token = String(form.get("token") ?? "").trim();
  if (kind !== "own_scheduler" && !url) return { ok: false, error: kind === "webhook" ? "Enter the URL Meerko should call" : "Paste the routine's API trigger URL" };
  try {
    const { secret } = await (await meerko()).setRoutineTrigger(id, { kind, url: url || undefined, token: token || undefined });
    revalidatePath("/app/autopilot");
    return { ok: true, message: kind === "own_scheduler" ? "Saved" : "Saved. Run it now to check it.", secret };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function approveEmails(input: { enrollmentIds?: string[]; sequenceId?: string }) {
  return run((c) => c.approveEmails(input).then((r) => `Approved ${r.approved} ${r.approved === 1 ? "email" : "emails"}`), ["/app"]);
}

export async function setSendingMode(mode: { sequence_emails?: "approve" | "auto"; reply_drafts?: "approve" | "auto" }) {
  return run((c) => c.setSendingMode(mode).then(() => "Saved"), ["/app"]);
}

export async function setDigest(enabled: boolean) {
  return run((c) => c.setDigest(enabled).then(() => (enabled ? "Turned on" : "Turned off")), ["/app/settings"]);
}

/** The optional questions after sign-up. Saving with nothing picked counts as a skip; either way, carry on. */
export async function saveProfile(form: FormData) {
  const pick = (k: string) => {
    const v = String(form.get(k) ?? "");
    return v || undefined;
  };
  try {
    await (await meerko()).saveProfile({ role: pick("role") as never, company_size: pick("company_size") as never, agent: pick("agent") as never });
  } catch (err) {
    // Never block someone on an optional screen.
    if (!(err instanceof MeerkoApiError)) throw err;
  }
  redirect(safeNext(String(form.get("next") ?? "")) ?? "/app");
}

export async function saveSlackWebhook(_: unknown, form: FormData): Promise<ActionResult> {
  const url = String(form.get("url") ?? "").trim();
  if (!url) return { ok: false, error: "Paste the incoming webhook URL from Slack" };
  try {
    await (await meerko()).setSlackWebhook(url);
    revalidatePath("/app/settings");
    return { ok: true, message: "Connected. Meerko posted a hello to the channel." };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Starts the Meerko Slack app's install: the browser goes to Slack, then back to Connections. */
export async function installSlack(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    return { ok: true, url: await (await meerko()).slackInstallUrl() };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function testSlack(): Promise<ActionResult> {
  try {
    const res = await (await meerko()).testSlack();
    revalidatePath("/app/settings");
    return res.ok ? { ok: true, message: "Test posted to Slack" } : { ok: false, error: res.error ?? "The test failed" };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function removeSlack() {
  return run((c) => c.deleteSlack().then(() => "Disconnected"), ["/app/settings"]);
}

/** Connects HubSpot or Attio. The API checks the token with the CRM before saving it, encrypted. */
export async function connectCrm(_: unknown, form: FormData): Promise<ActionResult> {
  const provider = form.get("provider");
  const token = String(form.get("token") ?? "").trim();
  if (provider !== "hubspot" && provider !== "attio") return { ok: false, error: "Pick HubSpot or Attio" };
  if (token.length < 8) return { ok: false, error: provider === "hubspot" ? "Paste the full private app token" : "Paste the full API key" };
  return run(
    (c) => c.connectCrm(provider, token).then((conn) => `Connected ${conn.accountName ?? provider}. Leads go there once Meerko has emailed them.`),
    ["/app/settings"],
  );
}

export async function setCrmAutoSync(autoSync: boolean) {
  return run((c) => c.setCrmAutoSync(autoSync).then((conn) => (conn.autoSync ? "Auto-sync on" : "Auto-sync off: only manual syncs")), ["/app/settings"]);
}

export async function removeCrm() {
  return run((c) => c.deleteCrm().then(() => "Disconnected. Contacts already in the CRM stay there."), ["/app/settings"]);
}

/** One pass of up to 100 rows; the button calls it again while rows remain. */
export async function syncCrmBatch(tableId: string, rowIds?: string[]) {
  try {
    const res = await (await meerko()).syncCrm(tableId, rowIds);
    return { ok: true as const, ...res };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false as const, error: err.message };
    throw err;
  }
}

const PROVIDER_KEYS = ["icypeas", "firecrawl", "generect"] as const;
const PROVIDER_NAMES: Record<ProviderKeyId, string> = { icypeas: "Icypeas", firecrawl: "Firecrawl", generect: "Generect" };
type ProviderKeyId = (typeof PROVIDER_KEYS)[number];
const isProvider = (p: unknown): p is ProviderKeyId => PROVIDER_KEYS.includes(p as ProviderKeyId);

/** Stores your own Icypeas, Firecrawl or Generect key. The API checks it with the provider before saving. */
export async function saveProviderKey(_: unknown, form: FormData): Promise<ActionResult> {
  const provider = form.get("provider");
  const key = String(form.get("key") ?? "").trim();
  if (!isProvider(provider)) return { ok: false, error: "Pick Icypeas, Firecrawl or Generect" };
  if (key.length < 8) return { ok: false, error: "Paste the full API key" };
  const name = PROVIDER_NAMES[provider];
  return run((c) => c.setProviderKey(provider, key).then((r) => `${name} key …${r.last4} saved. Lookups through it cost no credits.`), ["/app/settings"]);
}

export async function removeProviderKey(provider: string) {
  if (!isProvider(provider)) return { ok: false, error: "Unknown provider" } as ActionResult;
  return run((c) => c.deleteProviderKey(provider).then(() => "Key removed"), ["/app/settings"]);
}

export async function revokeApiKey(id: string) {
  return run((c) => c.revokeApiKey(id).then(() => "Key revoked"), ["/app/settings"]);
}

/** Saves a sequence's mailbox pool and how new leads are spread over it. */
export async function updatePool(id: string, mailboxIds: string[], assignment: "capacity" | "even") {
  return run((c) => c.updateSequence(id, { mailbox_ids: mailboxIds, assignment }).then(() => "Pool saved"), [`/app/sequences/${id}`]);
}

export async function disconnectApp(id: string) {
  return run((c) => c.revokeConnectedApp(id).then(() => "App disconnected"), ["/app/settings"]);
}

export async function approveDraft(draftId: string, body: string) {
  return run(async (c) => {
    const res = await c.approveDraft(draftId, body.trim() ? body : undefined);
    return `Sent to ${res.to}`;
  }, ["/app/inbox", "/app"]);
}

/** A reply written in the inbox: saved as a draft and approved at once, so it sends exactly like an agent's draft. */
export async function sendReply(replyId: string, body: string) {
  if (!body.trim()) return { ok: false, error: "Write a reply first" } as const;
  return run(async (c) => {
    const draft = await c.draftReply(replyId, body);
    const res = await c.approveDraft(draft.id);
    return `Sent to ${res.to}`;
  }, ["/app/inbox", "/app"]);
}

export async function discardDraft(draftId: string) {
  return run((c) => c.discardDraft(draftId).then(() => "Draft discarded"), ["/app/inbox"]);
}

export async function classifyReply(replyId: string, intent: string) {
  if (!REPLY_INTENTS.includes(intent as ReplyIntent)) return { ok: false, error: "Unknown intent" } as const;
  return run((c) => c.classifyReply(replyId, intent as ReplyIntent).then(() => undefined), ["/app/inbox", "/app"]);
}

export async function moveStage(tableId: string, rowIds: string[], stage: string) {
  if (!STAGES.includes(stage as Stage)) return { ok: false, error: "Unknown stage" } as const;
  return run(
    (c) => c.moveStage(tableId, rowIds, stage as Stage).then((r) => `Moved ${r.moved} to ${stage}`),
    [`/app/leads/${tableId}`, "/app"],
  );
}

export async function deleteRows(tableId: string, rowIds: string[]) {
  return run(
    (c) => c.deleteRows(tableId, rowIds).then((r) => `Deleted ${r.deleted} lead${r.deleted === 1 ? "" : "s"}`),
    [`/app/leads/${tableId}`, "/app"],
  );
}

/** Disconnects a mailbox: Meerko forgets its credentials and stops sending from it. */
export async function disconnectMailbox(mailboxId: string): Promise<ActionResult> {
  return run(async (c) => {
    const { deleted } = await c.deleteMailbox(mailboxId);
    return deleted ? "Mailbox disconnected." : "That mailbox was already gone.";
  }, ["/app/settings"]);
}

/** Lifts the hold Meerko put on a mailbox after too many bounces or spam rejections. */
export async function resumeMailbox(mailboxId: string): Promise<ActionResult> {
  return run((c) => c.updateMailbox(mailboxId, { resume: true }).then((m) => `${m.email} is sending again.`), ["/app/settings"]);
}

/** Deletes a table, then leaves its (now missing) page for the list of tables. */
export async function deleteTable(tableId: string): Promise<ActionResult> {
  const res = await run((c) => c.deleteTable(tableId).then(() => undefined), ["/app/leads", "/app"]);
  if (res.ok) redirect("/app/leads");
  return res;
}

/** Deletes a paused or draft sequence, then leaves its (now missing) page for the list of sequences. */
export async function deleteSequence(sequenceId: string): Promise<ActionResult> {
  const res = await run((c) => c.deleteSequence(sequenceId).then(() => undefined), ["/app/sequences", "/app"]);
  if (res.ok) redirect("/app/sequences");
  return res;
}

export async function setSequenceRunning(sequenceId: string, running: boolean) {
  return run(
    (c) => (running ? c.startSequence(sequenceId) : c.pauseSequence(sequenceId)).then((s) => `${s.name} ${running ? "started" : "paused"}`),
    [`/app/sequences/${sequenceId}`, "/app/sequences", "/app"],
  );
}

export type EnrichBatchResult =
  | { ok: true; processed: number; found: number; notFound: number; remaining: number; outOfCredits: boolean }
  | { ok: false; error: string };

/**
 * One small batch of email finding, for the button's progress loop: it calls this until nothing remains, refreshing
 * the table between batches so emails appear as they're found.
 */
export async function enrichEmailsBatch(tableId: string, minScore?: number, limit = 5): Promise<EnrichBatchResult> {
  try {
    const r = await (await meerko()).enrichRows(tableId, { limit, ...(minScore !== undefined ? { min_icp_score: minScore } : {}) });
    revalidatePath(`/app/leads/${tableId}`);
    return { ok: true, processed: r.processed, found: r.found.email, notFound: r.notFound, remaining: r.remaining, outOfCredits: r.stoppedReason === "insufficient_credits" };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function findPhones(tableId: string) {
  return run(async (c) => {
    const r = await c.enrichRows(tableId, { fields: ["phone"], limit: 25 });
    if (r.stoppedReason === "insufficient_credits") return `Out of credits after ${r.processed} rows`;
    return `${r.found.phone} phone numbers found, ${r.notFound} not found · ${r.remaining} rows left`;
  }, [`/app/leads/${tableId}`, "/app"]);
}

// --- Ideal customer profile (Settings). Lists are comma- or newline-separated in the form.

const icpList = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveIcp(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const n = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    return v === "" ? undefined : Number(v);
  };
  const min = n("minHeadcount");
  const max = n("maxHeadcount");
  if ((min !== undefined && !(min >= 0)) || (max !== undefined && !(max >= 0))) return { ok: false, error: "Company size must be whole numbers" };
  if (min !== undefined && max !== undefined && min > max) return { ok: false, error: "The minimum company size is above the maximum" };
  const countries = icpList(form.get("countries")).map((c) => c.toUpperCase());
  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) return { ok: false, error: "Countries are two-letter codes: ES, US, GB" };
  return run(
    (c) =>
      c
        .setIcp({
          summary: String(form.get("summary") ?? "").trim() || undefined,
          industries: icpList(form.get("industries")),
          countries,
          headcount: min !== undefined || max !== undefined ? { min, max } : undefined,
          titles: icpList(form.get("titles")),
          keywords: icpList(form.get("keywords")),
          exclude: icpList(form.get("exclude")),
        })
        .then(() => "Saved. Every lead is rescored."),
    ["/app/settings", "/app/leads", "/app"],
  );
}

export async function clearIcp() {
  return run((c) => c.clearIcp().then(() => "ICP removed."), ["/app/settings", "/app/leads"]);
}

/** Connects an inbox with an app password: Gmail, a preset provider or any IMAP/SMTP server. A refusal comes back as the form's error. */
export async function connectMailbox(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const provider = (field("provider") || "gmail") as MailProviderId;
  if (!(provider in MAIL_PROVIDERS)) return { ok: false, error: "Pick an email provider" };
  if (provider === "outlook") return { ok: false, error: "Outlook connects with Sign in with Microsoft, not a password" };
  const account = { email: field("email"), password: field("password"), login: field("login") || undefined, displayName: field("name") || undefined };
  const servers: MailServers | undefined =
    provider === "other"
      ? { imap: { host: field("imap_host"), port: 993 }, smtp: { host: field("smtp_host"), port: Number(field("smtp_port")) || 465 } }
      : MAIL_PROVIDERS[provider].servers;
  return run(async (c) => {
    const mailbox = servers ? await c.connectImapMailbox({ ...account, servers }) : await c.connectGmailAppPassword(account);
    return `Connected ${mailbox.email}. Send yourself a test email to see how it lands.`;
  }, ["/app/settings"]);
}

/** Google's consent page (Gmail API), where the server has it on. */
/** Sends the browser to Microsoft's sign-in for an Outlook mailbox; the API's callback brings it back to Connections. */
export async function connectOutlook(): Promise<ActionResult | void> {
  let url: string;
  try {
    url = (await (await meerko()).connectOutlook(undefined, `${site.url}/app/settings`)).url;
  } catch (err) {
    if (!(err instanceof MeerkoApiError)) throw err;
    return { ok: false, error: err.message };
  }
  redirect(url);
}

export async function connectGmail() {
  const client = await meerko();
  // Google sends the browser to the API's callback, which redirects back here with the outcome.
  let url: string;
  try {
    url = (await client.connectGmail(undefined, `${site.url}/app/settings`)).url;
  } catch (err) {
    // E.g. a self-hosted server without a Google OAuth client yet: say so on the page instead of crashing it.
    if (!(err instanceof MeerkoApiError)) throw err;
    url = `/app/settings?gmail_error=${encodeURIComponent(err.message)}`;
  }
  redirect(url);
}

/** Sends the browser to a Stripe page, or back to Connections with the API's reason when it refused. */
async function toStripe(fn: (c: MeerkoClient) => Promise<string>) {
  let url: string;
  try {
    url = await fn(await meerko());
  } catch (err) {
    if (!(err instanceof MeerkoApiError)) throw err;
    url = `/app/settings?billing_error=${encodeURIComponent(err.message)}#billing`;
  }
  redirect(url);
}

export async function upgradeToPro(form: FormData) {
  const interval = form.get("interval") === "year" ? "year" : "month";
  await toStripe((c) => c.startCheckout({ kind: "pro", interval }));
}

export async function buyCredits(form: FormData) {
  const packs = Number(form.get("packs") ?? 1);
  await toStripe((c) => c.startCheckout({ kind: "credits", packs: Number.isInteger(packs) && packs > 0 ? packs : 1 }));
}

export async function manageBilling() {
  await toStripe((c) => c.openBillingPortal());
}

// next.config.ts lets action bodies reach 10 MB for this; the API takes 10,000 rows per call.
const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CSV_ROWS = 10_000;

/** A CSV with a header row becomes a new leads table; the browser then opens it. */
export async function importCsv(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  if (file.size > MAX_CSV_BYTES) return { ok: false, error: "That file is over 10 MB. Split it, or import it with the CLI." };
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(await file.text(), { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
  } catch (err) {
    return { ok: false, error: `That doesn't read as a CSV: ${(err as Error).message}` };
  }
  if (rows.length === 0) return { ok: false, error: "The file has a header row but no rows under it" };
  if (rows.length > MAX_CSV_ROWS) return { ok: false, error: `That's ${rows.length.toLocaleString("en")} rows; import up to ${MAX_CSV_ROWS.toLocaleString("en")} at a time` };
  const name = String(form.get("name") ?? "").trim() || file.name.replace(/\.csv$/i, "") || "Imported leads";

  let tableId: string;
  try {
    const client = await meerko();
    const table = await client.createTable({ name });
    for (let i = 0; i < rows.length; i += 1000) await client.insertRows(table.id, rows.slice(i, i + 1000));
    tableId = table.id;
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/app/leads");
  redirect(`/app/leads/${tableId}`);
}

export interface NewSequence {
  name: string;
  tableId: string;
  mailboxIds: string[];
  steps: SequenceStep[];
  timezone: string;
  windowStartHour: number;
  windowEndHour: number;
}

/** Saves a draft sequence (nothing sends until it's started) and opens it. */
export async function createSequence(input: NewSequence): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Give the sequence a name" };
  if (!input.mailboxIds.length) return { ok: false, error: "Pick at least one mailbox to send from" };
  if (!input.steps.length || input.steps.some((s) => !s.body.trim())) return { ok: false, error: "Every email needs a body" };
  if (!input.steps[0]!.subject?.trim()) return { ok: false, error: "The first email needs a subject" };
  let id: string;
  try {
    const seq = await (await meerko()).createSequence({
      table_id: input.tableId,
      name: input.name.trim(),
      mailbox_ids: input.mailboxIds,
      // Follow-ups have no subject of their own: they're sent as replies in the first email's thread.
      steps: input.steps.map((s, i) => ({ subject: i === 0 ? s.subject!.trim() : null, body: s.body, delay_days: i === 0 ? 0 : s.delay_days })),
      timezone: input.timezone,
      window_start_hour: input.windowStartHour,
      window_end_hour: input.windowEndHour,
    });
    id = seq.id;
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/app/sequences");
  redirect(`/app/sequences/${id}`);
}

const SKIP_LABELS: Record<string, string> = {
  no_email: "without an email",
  undeliverable: "with an undeliverable email",
  suppressed: "who unsubscribed or bounced before",
  missing_vars: "missing a placeholder value",
  already_enrolled: "already in it",
};

/** Adds everyone in the sequence's table who can be emailed. Nothing sends until the sequence is started. */
export async function enrollTable(sequenceId: string) {
  return run(async (c) => {
    const r = await c.enrollRows(sequenceId, { limit: 5000 });
    const skipped = Object.entries(r.skipped)
      .filter(([, n]) => n > 0)
      .map(([why, n]) => `${n} ${SKIP_LABELS[why] ?? why}`);
    return `Added ${r.enrolled} ${r.enrolled === 1 ? "person" : "people"}${skipped.length ? ` · skipped ${skipped.join(", ")}` : ""}`;
  }, [`/app/sequences/${sequenceId}`, "/app/sequences"]);
}

export async function sendTestEmail(mailboxId: string, to: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) return { ok: false, error: "Enter an email address" } as const;
  return run((c) => c.sendTestEmail(mailboxId, to.trim()).then(() => `Test email sent to ${to.trim()}`), []);
}

// The columns the dashboard shows as Name / Company / Email; the add-lead form asks for these by name.
const LEAD_FIELDS = ["first_name", "last_name", "email", "company", "title"] as const;

/**
 * Adds one person to a table. Without a table (a new workspace), it first creates "My leads".
 * Extra columns arrive as `col:<key>`, so placeholders like {{pain_point}} get a value too.
 */
export async function addLead(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const row: Record<string, string> = {};
  for (const key of LEAD_FIELDS) {
    const v = String(form.get(key) ?? "").trim();
    if (v) row[key] = key === "email" ? v.toLowerCase() : v;
  }
  for (const [name, value] of form.entries()) {
    const v = typeof value === "string" ? value.trim() : "";
    if (name.startsWith("col:") && v) row[name.slice(4)] = v;
  }
  if (!row.email) return { ok: false, error: "Add their email: sequences only send to people with one" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return { ok: false, error: "That email doesn't look right" };

  let tableId = String(form.get("tableId") ?? "");
  const created = !tableId;
  try {
    const client = await meerko();
    if (!tableId) tableId = (await client.createTable({ name: "My leads" })).id;
    await client.insertRows(tableId, [row]);
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath(`/app/leads/${tableId}`);
  revalidatePath("/app/leads");
  if (created) redirect(`/app/leads/${tableId}`);
  return { ok: true, message: `Added ${[row.first_name, row.last_name].filter(Boolean).join(" ") || row.email}` };
}

export type FindLeadsResult = ActionResult & { total?: number };

/**
 * The "Find leads" form. `intent=count` asks how many match (free); `intent=add` saves up to `limit` of them into a
 * new or existing table (1 credit each, none with your own Icypeas key) and opens it. The same /v1/search routes as
 * the find_people and find_companies tools.
 */
export async function findLeads(_: FindLeadsResult | null, form: FormData): Promise<FindLeadsResult> {
  const kind = form.get("kind") === "companies" ? "companies" : "people";
  const built = buildLeadQuery(kind, Object.fromEntries(form.entries()));
  if ("error" in built) return { ok: false, error: built.error };

  if (form.get("intent") === "count") {
    try {
      const total = await (await meerko()).countLeads(kind, built.query);
      return { ok: true, total };
    } catch (err) {
      if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
      throw err;
    }
  }

  const limit = Number(form.get("limit"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return { ok: false, error: "Add between 1 and 1,000 at a time" };
  const tableId = String(form.get("tableId") ?? "") || undefined;
  // An empty name is easy to miss (the placeholder looks filled in), so name the table after the search instead.
  const tableName = tableId ? undefined : String(form.get("tableName") ?? "").trim() || defaultTableName(kind, Object.fromEntries(form.entries()));

  let result;
  try {
    result = await (await meerko()).searchLeads(kind, { query: built.query, limit, tableId, tableName });
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/app/leads");
  revalidatePath("/app", "layout");
  redirect(`/app/leads/${result.tableId}`);
}
