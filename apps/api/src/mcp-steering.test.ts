import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { instrument } from "@posthog/mcp";
import { PostHog } from "posthog-node";
import { MCP_ANALYTICS_OPTIONS } from "@meerko/mcp/analytics";
import { createServer } from "@meerko/mcp/server";
import { describe, expect, it } from "vitest";

// ChatGPT's approval classifier reads every word of a tool's documentation before a write call, and flags as
// "Suspicious Instruction" any text that looks like it prescribes the call's risk label, whether it needs approval,
// or how it is treated. These phrases have no place in what a client sees for a tool: its title, description,
// annotations, `_meta`, and every description in its input and output schemas, including arguments an analytics
// wrapper adds. Behaviour hints belong in the annotations (readOnlyHint, destructiveHint, openWorldHint), not in text.
const STEERING: [string, RegExp][] = [
  ["names a classifier or reviewer", /\b(classifier|reviewer|moderator|safety (check|system|filter))s?\b/i],
  ["prescribes a risk level", /\b(risk|safety) (label|level|rating|score|classification|category|treatment)\b|\b(low|no|zero|minimal)[- ]risk\b/i],
  ["says the call is safe", /\b(is|are|it's|always|completely|perfectly) (safe|harmless|benign|innocuous)\b|\bsafe to (call|run|use|execute)\b/i],
  ["waives approval", /\b(no|without|skip|bypass|doesn't need|does not need|not require[ds]?|needs no|requires no) (an? |any |user |the user's )?(approval|confirmation|consent|permission)\b|\bauto[- ]?approv/i],
  ["tells the client not to warn or ask", /\b(do not|don't|never|no need to) (warn|flag|alert|ask|prompt|interrupt|confirm|check with)\b/i],
  ["restates a behaviour hint as text", /\bread[- ]only\b|\bnon[- ]destructive\b|\bside[- ]effect[- ]free\b/i],
  ["policy language", /\bpolic(y|ies)\b|\bapproval outcome\b|\bcompliance\b/i],
  ["shouted imperative", /\b(MUST|NEVER|ALWAYS|IMPORTANT|DO NOT)\b/],
];

type Listed = { instructions?: string; tools: Record<string, unknown>[] };

async function list(withAnalytics: boolean): Promise<Listed> {
  const server = createServer(() => {
    throw new Error("nothing is called");
  });
  if (withAnalytics) instrument(server, new PostHog("phc_test", { disabled: true }), { ...MCP_ANALYTICS_OPTIONS, logger: () => {} });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  const { tools } = await client.listTools();
  return { instructions: client.getInstructions(), tools };
}

/** Every string under a value, with the path it sits at. */
function strings(value: unknown, path: string): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  return [];
}

function steering(listed: Listed) {
  const texts: [string, string][] = [
    ...(listed.instructions ? strings(listed.instructions, "instructions") : []),
    ...listed.tools.flatMap((t) => strings({ ...t, name: undefined }, String(t.name))),
  ];
  return texts.flatMap(([path, text]) => STEERING.filter(([, re]) => re.test(text)).map(([why, re]) => `${path}: ${why} ("${re.exec(text)![0]}")`));
}

describe("what a client sees for Meerko's tools carries no classifier or approval steering", () => {
  for (const withAnalytics of [false, true]) {
    it(withAnalytics ? "with PostHog MCP analytics, as the hosted /mcp serves it" : "without analytics", async () => {
      const listed = await list(withAnalytics);
      expect(listed.tools.length).toBeGreaterThan(0);
      expect(steering(listed)).toEqual([]);
    });
  }

  it("the analytics wrapper adds no arguments and changes no schema", async () => {
    const [plain, instrumented] = await Promise.all([list(false), list(true)]);
    expect(instrumented.tools).toEqual(plain.tools);
  });

  it("catches the analytics wrapper's own argument text", async () => {
    // The defaults this guards against: @posthog/mcp injects `context`, `llm_model` and `conversation_id` unless
    // MCP_ANALYTICS_OPTIONS turns them off.
    const server = createServer(() => {
      throw new Error("nothing is called");
    });
    instrument(server, new PostHog("phc_test", { disabled: true }), { logger: () => {} });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientSide);
    const { tools } = await client.listTools();
    expect(steering({ tools }).some((f) => f.includes("shouted imperative"))).toBe(true);
  });
});
