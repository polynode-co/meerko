import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_PLUGIN_GITHUB, CLAUDE_PLUGIN_ID, CLAUDE_PLUGIN_REPO, CLAUDE_PLUGIN_SERVER } from "./claude-plugin";

const repo = join(__dirname, "../../../..");
const json = (path: string) => JSON.parse(readFileSync(join(repo, path), "utf8"));

describe("the Claude Code plugin commands on the site", () => {
  const marketplace = json(".claude-plugin/marketplace.json");
  const entry = marketplace.plugins[0];

  it("install the plugin the marketplace lists, from this repository", () => {
    expect(CLAUDE_PLUGIN_ID).toBe(`${entry.name}@${marketplace.name}`);
    expect(entry.source).toMatchObject({ source: "git-subdir", url: CLAUDE_PLUGIN_REPO, ref: "main" });
    expect(CLAUDE_PLUGIN_GITHUB).toBe(`https://github.com/${CLAUDE_PLUGIN_REPO}/tree/main/${entry.source.path}`);
  });

  it("name the MCP server the plugin declares", () => {
    const plugin = json(`${entry.source.path}/.claude-plugin/plugin.json`);
    const servers = Object.keys(json(`${entry.source.path}/.mcp.json`).mcpServers);
    expect(servers.map((s) => `plugin:${plugin.name}:${s}`)).toEqual([CLAUDE_PLUGIN_SERVER]);
  });
});
