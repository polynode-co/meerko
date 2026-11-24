/**
 * Keeps the lifecycle emails PostHog sends identical to the ones in git (ported from Antwork's
 * `src/lib/emails/posthog-sync.ts`). Git is the only writer: `apply` overwrites any edit made in PostHog's editor.
 *
 * Patching is safe because every one of these emails is ONE Unlayer `html` block holding the whole message. The step
 * email endpoint applies design operations and re-renders the sent HTML server-side, so writing that block keeps the
 * design and what goes out in step by construction.
 */
import type { WorkflowStep } from "./types.ts";

export interface SyncEmail {
  key: string;
  /** Null: not wired in this env yet (unpublished). */
  target: WorkflowStep | null;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  fromName: string;
  replyTo: string | null;
  /** The step's `message_category_type`: marketing respects unsubscribes, transactional always sends. */
  category: "marketing" | "transactional";
}

export interface PostHogApi {
  get(path: string): Promise<unknown>;
  patch(path: string, body: unknown): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
}

/** The parts of PostHog's shapes this reads. Everything else passes through untouched. */
interface DesignContent {
  id: string;
  type: string;
  values?: { html?: string };
}
interface Design {
  body?: { rows?: Array<{ id: string; columns?: Array<{ contents?: DesignContent[] }> }> };
}
interface StepEmail {
  design?: Design;
  from?: { name?: string; email?: string; integrationId?: number };
  replyTo?: string | null;
  subject?: string;
  preheader?: string;
  text?: string;
}
interface Flow {
  draft?: unknown;
  updated_at?: string;
  actions?: Array<{ id: string; type?: string; config?: { message_category_type?: string; inputs?: { email?: { value?: StepEmail } } } }>;
}
interface PublishPreview {
  confirm_token?: string;
  impact?: { deleted_steps?: unknown[]; empty_variables?: unknown[]; schedule_conflicts?: unknown[] } | null;
}

export type SyncStatus = "in_sync" | "drifted" | "updated" | "unpublished" | "error";

export interface SyncResult {
  key: string;
  status: SyncStatus;
  problems: string[];
}

/** The `html` content blocks of an Unlayer design, with their ids. */
export function htmlBlocks(design: Design | undefined): Array<{ id: string; html: string }> {
  const blocks: Array<{ id: string; html: string }> = [];
  for (const row of design?.body?.rows ?? []) {
    for (const column of row.columns ?? []) {
      for (const content of column.contents ?? []) {
        if (content.type === "html") blocks.push({ id: content.id, html: content.values?.html ?? "" });
      }
    }
  }
  return blocks;
}

/**
 * What differs between git's email and a workflow step's. A step on PostHog's test sender (`email_sandbox`, a project
 * with no verified sender, as dev is) has no From name or reply-to to compare.
 */
export function compareEmail(expected: SyncEmail, live: StepEmail, sandbox = false): string[] {
  const problems: string[] = [];
  const blocks = htmlBlocks(live.design);
  if (blocks.length !== 1) problems.push(`design holds ${blocks.length} html blocks, expected 1 (edited in the visual builder)`);
  else if (blocks[0]!.html !== expected.html) problems.push("html differs");
  if (live.subject !== expected.subject) problems.push("subject differs");
  if (live.preheader !== expected.preheader) problems.push("preheader differs");
  if (live.text !== expected.text) problems.push("text differs");
  if (!sandbox) {
    if (live.from?.name !== expected.fromName) problems.push("sender name differs");
    if ((live.replyTo || null) !== expected.replyTo) problems.push("reply-to differs");
  }
  return problems;
}

/**
 * The design operations that make the step's design git's single block: overwrite it when there's exactly one,
 * otherwise (rebuilt in the visual editor) replace every row with one row holding it.
 */
export function designOperations(design: Design | undefined, html: string): unknown[] {
  const blocks = htmlBlocks(design);
  if (blocks.length === 1) return [{ op: "update_content", id: blocks[0]!.id, patch: { values: { html } } }];
  return [
    ...(design?.body?.rows ?? []).map((row) => ({ op: "remove_row", id: row.id })),
    { op: "add_row", row: { cells: [1], columns: [{ contents: [{ type: "html", values: { html } }], values: {} }], values: {} } },
  ];
}

function stepOf(flow: Flow, actionId: string) {
  const action = (flow.actions ?? []).find((a) => a.id === actionId);
  if (!action) throw new Error(`workflow has no step "${actionId}"; it was renamed or removed`);
  return {
    email: action.config?.inputs?.email?.value ?? {},
    sandbox: action.type === "email_sandbox",
    // PostHog treats a step without one as marketing.
    category: action.config?.message_category_type ?? "marketing",
  };
}

/** A publish that only changes email content deletes no step and orphans no variable. */
function contentOnly(impact: PublishPreview["impact"]): boolean {
  return (impact?.deleted_steps ?? []).length === 0 && (impact?.empty_variables ?? []).length === 0 && (impact?.schedule_conflicts ?? []).length === 0;
}

async function syncOne(api: PostHogApi, email: SyncEmail, apply: boolean): Promise<SyncResult> {
  const { key, target } = email;
  if (!target) return { key, status: "unpublished", problems: [] };

  const path = `/hog_flows/${target.workflowId}/`;
  const flow = (await api.get(path)) as Flow;
  const live = stepOf(flow, target.actionId);
  const problems = compareEmail(email, live.email, live.sandbox);
  // The step-email endpoint writes the message, not the step's category, so a wrong category is reported, never
  // fixed here: set it on the step in PostHog (or with workflows-patch-graph).
  const categoryProblem = live.category === email.category ? null : `message category is ${live.category} in PostHog, ${email.category} in git; set it on the step in PostHog`;
  if (problems.length === 0 && !categoryProblem) return { key, status: "in_sync", problems };
  if (!apply) return { key, status: "drifted", problems: categoryProblem ? [...problems, categoryProblem] : problems };
  if (problems.length === 0) return { key, status: "error", problems: [categoryProblem!] };

  // Someone is mid-edit in PostHog: patching would compose with their draft and publishing would ship it.
  if (flow.draft) return { key, status: "error", problems: [...problems, "workflow has an unpublished draft; not touching it"] };

  await api.patch(`${path}actions/${target.actionId}/email/`, {
    base_updated_at: flow.updated_at,
    operations: designOperations(live.email.design, email.html),
    email_patch: {
      subject: email.subject,
      preheader: email.preheader,
      text: email.text,
      ...(live.sandbox ? {} : { from: { name: email.fromName }, replyTo: email.replyTo }),
    },
  });

  // The endpoint either edits a draft-status workflow in place or stages a draft on an active one; publish only then.
  const after = (await api.get(path)) as Flow;
  if (after.draft) {
    const preview = (await api.post(`${path}publish/`, {})) as PublishPreview;
    if (!contentOnly(preview.impact)) {
      return { key, status: "error", problems: [...problems, "publish preview showed more than a content change; left as a draft"] };
    }
    await api.post(`${path}publish/`, { confirm: true, confirm_token: preview.confirm_token, sandbox_sender_warned: false });
  }
  if (categoryProblem) return { key, status: "error", problems: [...problems, categoryProblem] };
  return { key, status: "updated", problems };
}

/** Checks (or, with `apply`, pushes) every email. One failure never stops the rest. */
export async function syncLifecycleEmails(emails: readonly SyncEmail[], api: PostHogApi, { apply }: { apply: boolean }): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const email of emails) {
    try {
      results.push(await syncOne(api, email, apply));
    } catch (error) {
      results.push({ key: email.key, status: "error", problems: [error instanceof Error ? error.message : String(error)] });
    }
  }
  return results;
}

/** A `fetch`-backed client for one PostHog project. */
export function postHogApi({ host, projectId, key, fetch: fetchImpl = fetch }: { host: string; projectId: string; key: string; fetch?: typeof fetch }): PostHogApi {
  const base = `${host.replace(/\/$/, "")}/api/projects/${projectId}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res.json();
  };
  return { get: (p) => call("GET", p), patch: (p, b) => call("PATCH", p, b), post: (p, b) => call("POST", p, b) };
}
