// The lifecycle emails in this folder are the source; PostHog holds copies. This keeps the committed artifact the sync
// pushes equal to what the modules render (offline), and checks the sync's logic against a fake PostHog. Whether
// PostHog itself has drifted needs the network and a key: `pnpm --filter @meerko/api posthog-emails --env dev|prd`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LIFECYCLE_EMAILS, renderArtifact, syncEmails, type ArtifactEmail } from "./index.ts";
import { syncLifecycleEmails, type PostHogApi, type SyncEmail } from "./posthog-sync.ts";

const ARTIFACT = fileURLToPath(new URL("../../posthog/email-templates.json", import.meta.url));

describe("the lifecycle email artifact", () => {
  it("matches what the lifecycle modules render", () => {
    const rendered = renderArtifact();
    if (process.env.UPDATE_LIFECYCLE_EMAILS === "1") {
      mkdirSync(dirname(ARTIFACT), { recursive: true });
      writeFileSync(ARTIFACT, rendered);
      return;
    }
    // Parsed, so a failure names the field that moved. Regenerate: UPDATE_LIFECYCLE_EMAILS=1 vitest run src/lifecycle
    expect(JSON.parse(readFileSync(ARTIFACT, "utf8"))).toEqual(JSON.parse(rendered));
  });
});

describe.each(LIFECYCLE_EMAILS.map((e) => [e.key, e] as const))("%s", (_key, email) => {
  it("is a fragment, not a document (PostHog's editor supplies that)", () => {
    expect(email.html).not.toMatch(/<!doctype|<html|<body/i);
  });

  it("carries its voice", () => {
    if (email.sender === "iker") {
      expect(email.html).toContain("<p>Iker<br>Founder, Meerko</p>");
      expect(email.html).not.toContain(">Meerko</p><h1");
    } else {
      expect(email.html).toContain(">Meerko</p><h1");
    }
  });

  it("offers an unsubscribe only when it's marketing (a transactional email always sends)", () => {
    const offers = email.html.includes("{{ unsubscribe_url }}") || email.text.includes("{{ unsubscribe_url }}");
    if (email.category === "transactional") expect(offers).toBe(false);
    else if (email.sender === "meerko") expect(offers).toBe(true);
  });

  it("has a plain-text alternative without markup", () => {
    expect(email.text.length).toBeGreaterThan(0);
    expect(email.text).not.toMatch(/<p|<a |<div/);
  });

  it("links only to meerko.ai", () => {
    for (const [, href] of email.html.matchAll(/href="([^"]+)"/g)) {
      expect(href!.startsWith("https://meerko.ai/") || href === "{{ unsubscribe_url }}").toBe(true);
    }
  });

  it("is wired in dev before prd", () => {
    if (email.targets.prd) expect(email.targets.dev).toBeDefined();
  });
});

it("sends the account-state notices as transactional, the rest as marketing (#38)", () => {
  const transactional = LIFECYCLE_EMAILS.filter((e) => e.category === "transactional").map((e) => e.key);
  expect(transactional).toEqual(["mailbox-disconnected", "credits-low"]);
});

it("has a unique key per email", () => {
  const keys = LIFECYCLE_EMAILS.map((e) => e.key);
  expect(new Set(keys).size).toBe(keys.length);
});

// --- The sync, against a fake PostHog ---

const email: SyncEmail = {
  key: "k",
  target: { workflowId: "wf", actionId: "email_1" },
  subject: "S",
  preheader: "P",
  html: "<div>new</div>",
  text: "new",
  fromName: "Meerko",
  replyTo: null,
  category: "marketing",
};

function fakePostHog(step: Record<string, unknown>, opts: { stagesDraft?: boolean; draft?: unknown; type?: string; category?: string } = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let draft = opts.draft ?? null;
  const flow = () => ({
    updated_at: "t0",
    draft,
    actions: [{ id: "email_1", type: opts.type ?? "function_email", config: { message_category_type: opts.category ?? "marketing", inputs: { email: { value: step } } } }],
  });
  const api: PostHogApi = {
    get: async (path) => (calls.push({ method: "GET", path }), flow()),
    patch: async (path, body) => {
      calls.push({ method: "PATCH", path, body });
      if (opts.stagesDraft) draft = { staged: true };
      return {};
    },
    post: async (path, body) => {
      calls.push({ method: "POST", path, body });
      return (body as { confirm?: boolean }).confirm ? {} : { confirm_token: "tok", impact: { deleted_steps: [] } };
    },
  };
  return { api, calls };
}

const design = (html: string) => ({ body: { rows: [{ id: "r", columns: [{ contents: [{ id: "c", type: "html", values: { html } }] }] }] } });
const live = (over: Record<string, unknown> = {}) => ({ design: design(email.html), subject: "S", preheader: "P", text: "new", from: { name: "Meerko", integrationId: 1 }, ...over });

describe("syncLifecycleEmails", () => {
  it("reports an email PostHog holds unchanged as in sync, and touches nothing", async () => {
    const { api, calls } = fakePostHog(live());
    expect(await syncLifecycleEmails([email], api, { apply: true })).toEqual([{ key: "k", status: "in_sync", problems: [] }]);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });

  it("names what drifted, and only checks without --apply", async () => {
    const { api, calls } = fakePostHog(live({ design: design("<div>edited</div>"), subject: "Edited", replyTo: "x@y.z" }));
    const [r] = await syncLifecycleEmails([email], api, { apply: false });
    expect(r).toEqual({ key: "k", status: "drifted", problems: ["html differs", "subject differs", "reply-to differs"] });
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  it("overwrites the step's one html block and publishes the draft the edit staged", async () => {
    const { api, calls } = fakePostHog(live({ design: design("<div>old</div>") }), { stagesDraft: true });
    const [r] = await syncLifecycleEmails([email], api, { apply: true });
    expect(r!.status).toBe("updated");
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.path).toBe("/hog_flows/wf/actions/email_1/email/");
    expect(patch.body).toMatchObject({
      base_updated_at: "t0",
      operations: [{ op: "update_content", id: "c", patch: { values: { html: email.html } } }],
      email_patch: { subject: "S", from: { name: "Meerko" }, replyTo: null },
    });
    expect(calls.filter((c) => c.method === "POST").map((c) => (c.body as { confirm?: boolean }).confirm ?? false)).toEqual([false, true]);
  });

  it("leaves a workflow with someone's unpublished draft alone", async () => {
    const { api, calls } = fakePostHog(live({ subject: "Edited" }), { draft: { theirs: true } });
    const [r] = await syncLifecycleEmails([email], api, { apply: true });
    expect(r!.status).toBe("error");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("doesn't compare or write a sender on a PostHog test-sender step", async () => {
    const { api, calls } = fakePostHog(live({ from: undefined, subject: "Edited" }), { type: "email_sandbox" });
    const [r] = await syncLifecycleEmails([email], api, { apply: true });
    expect(r).toEqual({ key: "k", status: "updated", problems: ["subject differs"] });
    expect((calls.find((c) => c.method === "PATCH")!.body as { email_patch: object }).email_patch).not.toHaveProperty("from");
  });

  it("reports a step in the wrong message category, and says it can't fix it", async () => {
    const transactional: SyncEmail = { ...email, category: "transactional" };
    const check = fakePostHog(live());
    expect((await syncLifecycleEmails([transactional], check.api, { apply: false }))[0]).toEqual({
      key: "k",
      status: "drifted",
      problems: ["message category is marketing in PostHog, transactional in git; set it on the step in PostHog"],
    });
    const apply = fakePostHog(live());
    expect((await syncLifecycleEmails([transactional], apply.api, { apply: true }))[0]!.status).toBe("error");
    expect(apply.calls.some((c) => c.method !== "GET")).toBe(false);
    const right = fakePostHog(live(), { category: "transactional" });
    expect((await syncLifecycleEmails([transactional], right.api, { apply: true }))[0]!.status).toBe("in_sync");
  });

  it("skips an email not wired in the env", async () => {
    const { api, calls } = fakePostHog(live());
    const templates = (JSON.parse(renderArtifact()).templates as ArtifactEmail[]).map((t) =>
      t.key === "welcome" ? { ...t, targets: { dev: t.targets.dev } } : t,
    );
    const results = await syncLifecycleEmails(syncEmails(templates, "prd"), api, { apply: false });
    expect(results.find((r) => r.key === "welcome")).toEqual({ key: "welcome", status: "unpublished", problems: [] });
    expect(calls.length).toBe(results.filter((r) => r.status !== "unpublished").length);
  });
});
