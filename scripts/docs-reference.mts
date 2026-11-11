// Writes the docs site's MCP and CLI reference from the code itself, so the docs can't drift from it.
//   pnpm docs:reference          regenerate apps/web/src/generated/reference.json
//   pnpm docs:reference --check  fail if it's out of date
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { describeCli } from "../packages/cli/src/reference.ts";
import { describeMcp } from "../packages/mcp/src/reference.ts";

const out = new URL("../apps/web/src/generated/reference.json", import.meta.url);
const next = `${JSON.stringify({ mcp: await describeMcp(), cli: describeCli() }, null, 2)}\n`;

/**
 * What `next build` would refuse, checked here so `pnpm typecheck` catches it before a deploy does (on 2026-11-10 a
 * missing toolGroups entry failed the prd web build and left the site a release behind):
 * - every MCP tool sits in exactly one docs group, and every grouped tool exists;
 * - every guide in lib/content.ts has a page under app/guides, and every guide page is registered.
 */
async function siteProblems(tools: { name: string }[]): Promise<string[]> {
  const { toolGroups } = await import("../apps/web/src/lib/tool-groups.ts");
  const { guides } = await import("../apps/web/src/lib/content.ts");
  const problems: string[] = [];
  const grouped = toolGroups.flatMap((g) => g.tools);
  for (const t of tools) if (!grouped.includes(t.name)) problems.push(`MCP tool ${t.name} isn't in any group in apps/web/src/lib/tool-groups.ts`);
  for (const n of new Set(grouped)) {
    if (!tools.some((t) => t.name === n)) problems.push(`tool-groups.ts lists ${n}, which the MCP server doesn't have`);
    if (grouped.filter((g) => g === n).length > 1) problems.push(`tool-groups.ts lists ${n} more than once`);
  }
  const guidesDir = new URL("../apps/web/src/app/guides/", import.meta.url);
  const pages = readdirSync(guidesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/page.tsx`, guidesDir)))
    .map((d) => d.name);
  for (const g of guides) if (!pages.includes(g.slug)) problems.push(`lib/content.ts lists guide "${g.slug}" but app/guides/${g.slug}/page.tsx doesn't exist`);
  for (const p of pages) if (!guides.some((g) => g.slug === p)) problems.push(`app/guides/${p} isn't registered in lib/content.ts guides (hubs, sitemap)`);
  return problems;
}

if (process.argv.includes("--check")) {
  const problems = await siteProblems((JSON.parse(next) as { mcp: { tools: { name: string }[] } }).mcp.tools);
  if (problems.length) {
    console.error(`The docs site would fail to build:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {}
  if (current !== next) {
    console.error("apps/web/src/generated/reference.json is out of date: run `pnpm docs:reference`.");
    process.exit(1);
  }
  console.log("Docs reference is up to date.");
} else {
  writeFileSync(out, next);
  console.log("Wrote apps/web/src/generated/reference.json");
}
