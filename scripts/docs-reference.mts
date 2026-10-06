// Writes the docs site's MCP and CLI reference from the code itself, so the docs can't drift from it.
//   pnpm docs:reference          regenerate apps/web/src/generated/reference.json
//   pnpm docs:reference --check  fail if it's out of date
import { readFileSync, writeFileSync } from "node:fs";
import { describeCli } from "../packages/cli/src/reference.ts";
import { describeMcp } from "../packages/mcp/src/reference.ts";

const out = new URL("../apps/web/src/generated/reference.json", import.meta.url);
const next = `${JSON.stringify({ mcp: await describeMcp(), cli: describeCli() }, null, 2)}\n`;

if (process.argv.includes("--check")) {
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
