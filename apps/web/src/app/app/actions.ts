"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient, REPLY_INTENTS, STAGES, type ReplyIntent, type Stage } from "@meerko/sdk";
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
  const { url } = await client.connectGmail(undefined, `${site.url}/app/settings`);
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
