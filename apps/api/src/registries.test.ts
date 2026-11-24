import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// server.json (the official MCP Registry) and glama.json (Glama) sit at the repo root because that is where each
// registry reads them. docs/registries.md has the publish steps. `mcp-publisher validate` is the full check and runs
// by hand before a publish; this keeps the fields that drift (the URL, the length limits) right in between.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const json = (file: string) => JSON.parse(readFileSync(`${root}${file}`, "utf8"));

describe("server.json, the official MCP Registry listing", () => {
  const server = json("server.json") as {
    $schema: string;
    name: string;
    title: string;
    description: string;
    version: string;
    remotes: { type: string; url: string }[];
    packages?: unknown[];
  };

  it("uses the meerko.ai namespace, which publishing proves with a DNS record on that domain", () => {
    expect(server.name).toBe("ai.meerko/meerko");
  });

  it("stays inside the schema's length limits", () => {
    expect(server.$schema).toBe("https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json");
    expect(server.description.length).toBeGreaterThan(0);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.title.length).toBeLessThanOrEqual(100);
  });

  it("has a version the registry accepts: semantic, not a range", () => {
    expect(server.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
  });

  it("describes the hosted server and no package", () => {
    expect(server.packages).toBeUndefined();
    expect(server.remotes).toEqual([{ type: "streamable-http", url: "https://api.meerko.ai/mcp" }]);
    // The ChatGPT plugin points at the same server.
    expect(server.remotes[0]!.url).toBe(json("chatgpt-app-submission.json").plugin.mcpServerURL);
  });
});

// .mcp.json is what Cursor Directory reads from the repo root to list the server: one entry under `mcpServers`, whose
// `url` must be public https. Cursor signs in with OAuth by itself, so the entry carries no header and no key.
describe(".mcp.json, the Cursor Directory listing", () => {
  it("describes the hosted server, the same one server.json lists", () => {
    expect(json(".mcp.json")).toEqual({ mcpServers: { meerko: { type: "http", url: json("server.json").remotes[0].url } } });
  });
});

// The README badge is the backlink the awesome-remote-mcp-servers list checks for before it takes an entry.
describe("the Glama badge in the README", () => {
  it("links to the connector listing named in server.json", () => {
    const listing = `https://glama.ai/mcp/connectors/${json("server.json").name}`;
    expect(readFileSync(`${root}README.md`, "utf8")).toContain(`<a href="${listing}"><img src="${listing}/badges/score.svg"`);
  });
});

describe("glama.json", () => {
  it("names the GitHub users who may maintain the Glama listing", () => {
    expect(json("glama.json")).toEqual({ $schema: "https://glama.ai/mcp/schemas/server.json", maintainers: ["iker-gonzalez"] });
  });
});
