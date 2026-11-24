/**
 * Compares the lifecycle emails PostHog sends with git's, or pushes git's over them.
 *
 *   pnpm --filter @meerko/api posthog-emails                    # check prd; exit 1 on drift
 *   pnpm --filter @meerko/api posthog-emails --env dev          # check dev
 *   pnpm --filter @meerko/api posthog-emails --apply            # push what differs to prd, then publish
 *
 * `--apply --env prd` is the API deploy's `sync-lifecycle-emails` step (core-infrastructure apps/meerko/app/build.tf),
 * after the new revision serves traffic. It reads the committed artifact, `apps/api/posthog/email-templates.json`,
 * which the lifecycle test keeps equal to `src/lifecycle/`.
 *
 * Environment:
 *   POSTHOG_PERSONAL_API_KEY   (or POSTHOG_CLI_API_KEY, as the deploy passes it) with hog_flow:read, + hog_flow:write for --apply
 *   POSTHOG_PROJECT_ID         overrides the env's project
 *   POSTHOG_HOST               defaults to https://eu.posthog.com
 */
import { readFileSync } from "node:fs";
import { syncEmails, type ArtifactEmail, type PostHogEnv } from "./index.ts";
import { postHogApi, syncLifecycleEmails } from "./posthog-sync.ts";

/** Meerko's PostHog projects (core-infrastructure apps/meerko/app/posthog.tf). */
const PROJECTS: Record<PostHogEnv, string> = { dev: "297149", prd: "297150" };

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const envArg = args[args.indexOf("--env") + 1];
const env: PostHogEnv = args.includes("--env") ? (envArg as PostHogEnv) : "prd";
if (!(env in PROJECTS)) {
  console.error(`--env must be dev or prd, not ${envArg}`);
  process.exit(2);
}

const host = process.env.POSTHOG_HOST || "https://eu.posthog.com";
const projectId = process.env.POSTHOG_PROJECT_ID || PROJECTS[env];
const key = process.env.POSTHOG_PERSONAL_API_KEY || process.env.POSTHOG_CLI_API_KEY;
if (!key) {
  console.error(`POSTHOG_PERSONAL_API_KEY is not set. Create a personal API key with hog_flow:read (and hog_flow:write for --apply) at ${host}/settings/user-api-keys`);
  process.exit(2);
}

const artifact = new URL("../../posthog/email-templates.json", import.meta.url);
const { templates } = JSON.parse(readFileSync(artifact, "utf8")) as { templates: ArtifactEmail[] };
const results = await syncLifecycleEmails(syncEmails(templates, env), postHogApi({ host, projectId, key }), { apply });

const MARK = { in_sync: "✔", updated: "↻", unpublished: "○", drifted: "✖", error: "✖" } as const;
for (const r of results) console.log(`${MARK[r.status]} ${r.key}: ${r.status}${r.problems.length ? ` (${r.problems.join(", ")})` : ""}`);

const bad = results.filter((r) => r.status === "drifted" || r.status === "error");
const updated = results.filter((r) => r.status === "updated").length;
if (bad.length) {
  console.error(`\n${bad.length} of ${results.length} lifecycle emails in ${env} differ from git.${apply ? "" : ` Push them with --apply --env ${env}.`}`);
  process.exit(1);
}
console.log(`\nEvery wired lifecycle email in ${env} matches git${updated ? ` (${updated} updated and published)` : ""}.`);
