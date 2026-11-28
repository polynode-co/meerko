// What the Meerko plugins share: the MCP server, the description, and the skills, all built from the MCP server's own
// workflows (packages/mcp/src/workflows.ts) so no plugin's skills can drift from the MCP prompts. Used by
// scripts/perplexity-plugin.mts (integrations/perplexity-plugin/) and scripts/claude-plugin.mts
// (integrations/claude-plugin/ and .claude-plugin/marketplace.json).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { skillText, WORKFLOWS, type Workflow } from "../packages/mcp/src/workflows.ts";

export { WORKFLOWS };

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Meerko Cloud's MCP server, signed in with OAuth. */
export const MCP_URL = "https://api.meerko.ai/mcp";

export const DESCRIPTION =
  "Meerko, the open-source outbound engine: find B2B leads, verify their work emails, send email sequences from your own Gmail or Outlook, and sort and answer the replies. By default every email waits for your approval.";

export interface PluginFile {
  path: string;
  /** Text, or the bytes of a file copied in (an icon). */
  content: string | Buffer;
}

/** A file of the repo, copied into a plugin as it is. */
export const copyOf = (repoPath: string) => readFileSync(join(root, repoPath));

/** A workflow as a SKILL.md: YAML front matter with its name and description, a title, a line on where the tools are, the recipe. */
export const skillFile = (w: Workflow, opts: { name: string; descriptionSuffix: string; toolsLine: string }) =>
  [
    "---",
    `name: ${opts.name}`,
    `description: ${JSON.stringify(`${w.description} ${opts.descriptionSuffix}`)}`,
    "---",
    "",
    `# ${w.title}`,
    "",
    opts.toolsLine,
    "",
    skillText(w),
    "",
  ].join("\n");

/** Every file under the folder, relative to it. */
const onDisk = (dir: string, prefix = ""): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? onDisk(join(dir, d.name), `${prefix}${d.name}/`) : [`${prefix}${d.name}`]))
    : [];

/** Whether the file at `p` holds exactly `content`. */
const same = (p: string, content: string | Buffer) => existsSync(p) && readFileSync(p).equals(Buffer.from(content));

/**
 * Writes a generated folder (replacing what's there) plus single files elsewhere in the repo, or with `--check` on the
 * command line lists what is out of date and exits 1. Paths are relative to the repo root.
 */
export function writeOrCheck(label: string, command: string, folder: string, files: PluginFile[], extras: PluginFile[] = []) {
  const dir = join(root, folder);
  if (process.argv.includes("--check")) {
    const stale: string[] = [];
    for (const f of files) if (!same(join(dir, f.path), f.content)) stale.push(`${folder}/${f.path}`);
    for (const p of onDisk(dir)) if (!files.some((f) => f.path === p)) stale.push(`${folder}/${p} (not generated)`);
    for (const f of extras) if (!same(join(root, f.path), f.content)) stale.push(f.path);
    if (stale.length) {
      console.error(`The ${label} is out of date: run \`${command}\`.\n${stale.map((s) => `  - ${s}`).join("\n")}`);
      process.exit(1);
    }
    console.log(`${label} is up to date.`);
    return;
  }
  rmSync(dir, { recursive: true, force: true });
  for (const f of files) {
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.content);
  }
  for (const f of extras) {
    mkdirSync(dirname(join(root, f.path)), { recursive: true });
    writeFileSync(join(root, f.path), f.content);
  }
  console.log(`Wrote ${folder}/ (${files.length} files)${extras.length ? ` and ${extras.map((f) => f.path).join(", ")}` : ""}`);
}

/** Exits 1 when a plugin breaks a limit its host states. */
export function failOn(label: string, problems: string[]) {
  if (!problems.length) return;
  console.error(`The ${label} breaks its host's limits:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
