"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parse as parseCsv } from "csv-parse/sync";
import { MeerkoApiError, MeerkoClient, REPLY_INTENTS, STAGES, type ReplyIntent, type SequenceStep, type Stage } from "@meerko/sdk";
import { apiUrl, meerko, safeNext, SESSION_COOKIE, setSessionCookie } from "@/lib/meerko";
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

/** The new key is returned once, for the Settings page to show; only its prefix is stored. */
export async function createApiKey(_: unknown, form: FormData): Promise<ActionResult & { key?: string }> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the key a name, like the machine or agent that will use it" };
  try {
    const { key } = await (await meerko()).createApiKey(name);
    revalidatePath("/app/settings");
    return { ok: true, key };
  } catch (err) {
    if (err instanceof MeerkoApiError) return { ok: false, error: err.message };
    throw err;
  }
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

export async function setSequenceRunning(sequenceId: string, running: boolean) {
  return run(
    (c) => (running ? c.startSequence(sequenceId) : c.pauseSequence(sequenceId)).then((s) => `${s.name} ${running ? "started" : "paused"}`),
    [`/app/sequences/${sequenceId}`, "/app/sequences", "/app"],
  );
}

export async function enrichEmails(tableId: string) {
  return run(async (c) => {
    const r = await c.enrichRows(tableId, { limit: 25 });
    if (r.stoppedReason === "insufficient_credits") return `Out of credits after ${r.processed} rows`;
    return `${r.found.email} emails found, ${r.found.email_verification} verified, ${r.notFound} not found · ${r.remaining} rows left`;
  }, [`/app/leads/${tableId}`, "/app"]);
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

/** Sends the browser to a Stripe page, or back to Settings with the API's reason when it refused. */
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

export async function upgradeToPro() {
  await toStripe((c) => c.startCheckout({ kind: "pro" }));
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
