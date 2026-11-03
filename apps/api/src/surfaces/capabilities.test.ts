import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
// Relative, like scripts/docs-reference.mts: neither package exports its reference builder.
import { describeCli } from "../../../../packages/cli/src/reference.ts";
import { describeMcp } from "../../../../packages/mcp/src/reference.ts";
import { V1 } from "../v1/spec.ts";
import { CAPABILITIES, type Capability, type Cell } from "./capabilities.ts";

const webSrc = fileURLToPath(new URL("../../../web/src/", import.meta.url));
const supported = (cell: Cell) => ("supported" in cell ? cell.supported : []);
const all = (column: "web" | "mcp" | "cli") => new Set(CAPABILITIES.flatMap((c) => supported(c[column])));
const where = "apps/api/src/surfaces/capabilities.ts";

const mcpTools = (await describeMcp()).tools.map((t) => t.name);
// "meerko tables create <name>" → "tables create"
const cliCommands = describeCli().commands.map((c) => c.usage.split(" ").slice(1).filter((w) => !/^[<[]/.test(w)).join(" "));

/** Every file under apps/web/src that starts with "use server", and what it exports. */
function serverActions() {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name)) {
        const src = readFileSync(path, "utf8");
        if (!/^\s*["']use server["']/.test(src)) continue;
        for (const [, fn] of src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)) out.push(`${relative(webSrc, path)}#${fn}`);
      }
    }
  };
  walk(webSrc);
  return out;
}

describe("surface capabilities", () => {
  it("names each capability once", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("maps every /v1 route to a capability, and only real ones", () => {
    const routes = new Set(CAPABILITIES.flatMap((c) => c.routes));
    expect(V1.filter((op) => !routes.has(op.id)).map((op) => op.id), `add these routes to a row in ${where}`).toEqual([]);
    const ids = new Set(V1.map((op) => op.id));
    expect([...routes].filter((r) => !ids.has(r)), "not operations in v1/spec.ts").toEqual([]);
  });

  it("marks the API supported exactly when an API key can call every route", () => {
    const access = new Map(V1.map((op) => [op.id, op.access]));
    const wrong = (c: Capability) => {
      const keyCallable = c.routes.length > 0 && c.routes.every((r) => access.get(r) === "any");
      return keyCallable !== "supported" in c.api;
    };
    expect(CAPABILITIES.filter(wrong).map((c) => c.id), "an API key can call these routes iff `api` is supported; split mixed rows").toEqual([]);
  });

  it("covers every MCP tool, and only real ones", () => {
    const listed = all("mcp");
    expect(mcpTools.filter((t) => !listed.has(t)), `add these MCP tools to ${where}`).toEqual([]);
    expect([...listed].filter((t) => !mcpTools.includes(t)), "not tools in packages/mcp").toEqual([]);
  });

  it("covers every CLI command, and only real ones", () => {
    const listed = all("cli");
    expect(cliCommands.filter((c) => !listed.has(c)), `add these CLI commands to ${where}`).toEqual([]);
    expect([...listed].filter((c) => !cliCommands.includes(c)), "not commands in packages/cli").toEqual([]);
  });

  it("covers every web server action, and points only at real pages and actions", () => {
    const actions = serverActions();
    const listed = all("web");
    expect(actions.filter((a) => !listed.has(a)), `add these server actions to ${where}`).toEqual([]);
    const missing = [...listed].filter((ref) => {
      const [file] = ref.split("#");
      return ref.includes("#") ? !actions.includes(ref) : !existsSync(join(webSrc, file!));
    });
    expect(missing, "not files or server actions under apps/web/src").toEqual([]);
  });

  it("gives every absent or missing cell a reason", () => {
    const cells = CAPABILITIES.flatMap((c) => [c.web, c.mcp, c.cli, c.api].map((cell) => [c.id, cell] as const));
    const blank = cells.filter(([, cell]) =>
      "deliberately_absent" in cell ? !cell.deliberately_absent.trim() : "missing" in cell ? !cell.missing.trim() : false,
    );
    expect(blank.map(([id]) => id)).toEqual([]);
  });
});
