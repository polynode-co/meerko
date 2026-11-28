import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { perplexityPluginFiles } from "./perplexity-plugin";
import { crc32, zip } from "./zip";

const hasUnzip = (() => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("makes the same bytes from the same files", () => {
    const files = [{ path: "a.txt", content: "hello" }];
    expect(zip(files)).toEqual(zip(files));
  });

  it.skipIf(!hasUnzip)("makes an archive unzip reads back, file for file", () => {
    const files = [
      { path: "plugin.json", content: '{"name":"meerko"}\n' },
      { path: "skills/meerko-pipeline/SKILL.md", content: "---\nname: meerko-pipeline\n---\nÁ · é\n" },
    ];
    const file = join(mkdtempSync(join(tmpdir(), "zip-")), "t.zip");
    writeFileSync(file, zip(files));
    execFileSync("unzip", ["-tq", file]);
    expect(execFileSync("unzip", ["-Z1", file], { encoding: "utf8" }).trim().split("\n")).toEqual(files.map((f) => f.path));
    for (const f of files) expect(execFileSync("unzip", ["-p", file, f.path], { encoding: "utf8" })).toBe(f.content);
  });
});

describe("the Perplexity plugin", () => {
  const files = perplexityPluginFiles("https://api.example.test/mcp");
  const byPath = (p: string) => files.find((f) => f.path === p)?.content ?? "";

  it("has plugin.json at the root, named meerko", () => {
    expect(JSON.parse(byPath("plugin.json"))).toMatchObject({ name: "meerko" });
  });

  it("points mcp.json at this install's server, typed, with no fixed headers (Perplexity skips those)", () => {
    const server = JSON.parse(byPath("mcp.json")).mcpServers.meerko;
    expect(server).toEqual({ type: "http", url: "https://api.example.test/mcp" });
  });

  it("has a skill per workflow, each with a name and description", () => {
    const skills = files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f.path));
    expect(skills.length).toBe(5);
    for (const s of skills) expect(s.content).toMatch(/^---\nname: meerko-[a-z-]+\ndescription: ".+"\n---\n/);
  });
});
