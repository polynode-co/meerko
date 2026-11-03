// Writes the public OpenAPI document from the API's own route registry (apps/api/src/v1/spec.ts), so the published
// contract can't drift from what the API validates.
//   pnpm api:spec          regenerate apps/web/public/openapi.json (served at meerko.ai/openapi.json)
//   pnpm api:spec --check  fail if it's out of date
import { readFileSync, writeFileSync } from "node:fs";
import { buildOpenApi } from "../apps/api/src/v1/openapi.ts";

const out = new URL("../apps/web/public/openapi.json", import.meta.url);
const next = `${JSON.stringify(buildOpenApi(), null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(out, "utf8");
  } catch {}
  if (current !== next) {
    console.error("apps/web/public/openapi.json is out of date: run `pnpm api:spec`.");
    process.exit(1);
  }
  console.log("OpenAPI document is up to date.");
} else {
  writeFileSync(out, next);
  console.log("Wrote apps/web/public/openapi.json");
}
