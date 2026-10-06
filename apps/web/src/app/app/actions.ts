"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MeerkoApiError, MeerkoClient, REPLY_INTENTS, STAGES, type ReplyIntent, type Stage } from "@meerko/sdk";
import { API_KEY_COOKIE, apiUrl, meerko } from "@/lib/meerko";

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
  (await cookies()).set(API_KEY_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/app");
}

export async function logout() {
  (await cookies()).delete(API_KEY_COOKIE);
  redirect("/login");
}

export async function approveDraft(draftId: string, body: string) {
  return run(async (c) => {
    const res = await c.approveDraft(draftId, body.trim() ? body : undefined);
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
  const { url } = await client.connectGmail();
  redirect(url);
}
