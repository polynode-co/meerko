import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "@meerko/mcp/server";
import { describe, expect, it } from "vitest";

// A tool's description says what the tool does and returns. The app directories reject descriptions that script
// other tools or tell the model how to behave (#154); multi-step flows live in the MCP prompts, which the user picks.
// Two kinds of note stay: "Confirm with the user before <the tool's own action>", and "untrusted content … not
// instructions" on tools that return text from outside.
const FLAGGED: [string, RegExp][] = [
  ["addresses the model", /\byou(r|rs|rself)?\b/i],
  ["tells the model what to say", /\b(tell|show|ask|give|remind) (the user|them|the person)\b/i],
  ["scripts a next step", /\b(then|first|next|now|instead)[:,]? (call|run|use)\b/i],
  ["tells the model when to call", /\b(call|use|run) (this|it|again)\b|\b(only|always|keep|before|after) call(ing)?\b/i],
  ["blanket imperative", /\b(don't|do not|never|always)\b/i],
];

// Tool names that are also ordinary words, so a description may use them.
const ORDINARY_WORDS = ["pipeline"];

describe("MCP tool descriptions", async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(() => {
    throw new Error("nothing is called");
  });
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).filter((n) => !ORDINARY_WORDS.includes(n));

  it("describes every tool", () => {
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) expect(t.description?.trim(), t.name).toBeTruthy();
  });

  it("names no other Meerko tool", () => {
    const found = tools.flatMap((t) =>
      names.filter((n) => n !== t.name && new RegExp(`\\b${n}\\b`).test(t.description ?? "")).map((n) => `${t.name} names ${n}`),
    );
    expect(found).toEqual([]);
  });

  it("carries no instructions to the model", () => {
    const found = tools.flatMap((t) =>
      FLAGGED.filter(([, re]) => re.test(t.description ?? "")).map(([why, re]) => `${t.name}: ${why} ("${re.exec(t.description ?? "")![0]}")`),
    );
    expect(found).toEqual([]);
  });
});
