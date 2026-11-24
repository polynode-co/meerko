import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "@meerko/mcp/server";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

// The ChatGPT plugin package (the ZIP OpenAI's dashboard takes) is built from chatgpt-app-submission.json by
// scripts/build-chatgpt-plugin.mjs. OpenAI scans the tools from the live server and compares them with what was
// declared, so the file's tool list has to be the server's: same names, same hints, a reason for each hint.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const submission = JSON.parse(readFileSync(`${root}chatgpt-app-submission.json`, "utf8")) as {
  tools: Record<string, { annotations: Record<string, boolean>; justifications: Record<string, string> }>;
  test_cases: { user_prompt: string; tools_triggered: string; expected_output: string }[];
  negative_test_cases: { user_prompt: string; expected_output: string }[];
};

// What the expected results quote from packages/core/src/reviewer-seed.ts.
const SEED_ANCHORS = [
  "Demo leads: B2B SaaS founders",
  "Founders: agent-run outbound",
  "Okafor",
  "Ledgerline",
  "Berg",
  "Fjordly",
  "Nair",
  "Quaystack",
  "Yes, let's talk. Thursday afternoon works for me.",
];

// OpenAI verifies the plugin's domain by fetching this path with no credentials. The route reads nothing from the
// database, so the app is built without one.
describe("the ChatGPT plugin's domain verification", () => {
  const PATH = "/.well-known/openai-apps-challenge";

  it("serves the token as plain text and nothing else, with no sign-in", async () => {
    const res = await createApp(undefined as never).request(PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toBe("2JsDp1zUCAMKcGRm0X8dImMgNlqtsMZdA6P1PLtKR24");
  });

  it("serves a rotated token from MEERKO_OPENAI_APPS_CHALLENGE", async () => {
    const res = await createApp(undefined as never, { openaiAppsChallenge: "rotated-token" }).request(PATH);
    expect(await res.text()).toBe("rotated-token");
  });
});

// Glama verifies who owns the hosted connector the same way: one unauthenticated fetch, no database.
describe("Glama's connector claim file", () => {
  const PATH = "/.well-known/glama.json";

  it("serves the claim as JSON and nothing else, with no sign-in", async () => {
    const res = await createApp(undefined as never).request(PATH);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({
      $schema: "https://glama.ai/mcp/schemas/connector.json",
      claim: "glama_claim_d2pSv0D3Pap1oPTQHcxPi6rAkKDrg8nR",
    });
  });

  it("serves another claim from MEERKO_GLAMA_CLAIM", async () => {
    const res = await createApp(undefined as never, { glamaClaim: "glama_claim_other" }).request(PATH);
    expect(await res.json()).toEqual({ $schema: "https://glama.ai/mcp/schemas/connector.json", claim: "glama_claim_other" });
  });
});

describe("the ChatGPT plugin package", async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(() => {
    throw new Error("nothing is called");
  });
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  const { tools } = await client.listTools();

  it("passes the package checks", () => {
    const out = execFileSync("node", ["scripts/build-chatgpt-plugin.mjs", "--check"], { cwd: root, encoding: "utf8" });
    expect(out).toContain("OK");
  });

  // The dashboard refuses a package with any other number of cases; the build's --check says so too.
  it("has exactly 5 review cases and 3 negative ones", () => {
    expect(submission.test_cases).toHaveLength(5);
    expect(submission.negative_test_cases).toHaveLength(3);
  });

  it("lists exactly the tools the server registers", () => {
    expect(Object.keys(submission.tools).sort()).toEqual(tools.map((t) => t.name).sort());
  });

  it("declares each tool's hints as the server sends them", () => {
    for (const t of tools) {
      const { readOnlyHint, destructiveHint, openWorldHint } = t.annotations ?? {};
      expect(submission.tools[t.name]?.annotations, t.name).toEqual({ readOnlyHint, destructiveHint, openWorldHint });
    }
  });

  // A reason written for the old value of a hint argues against the new one: these are the phrases the six tools of
  // #16 and sync_crm (#20) had while they were declared non-destructive, or closed-world.
  it("gives reasons that agree with the hints", () => {
    for (const [name, tool] of Object.entries(submission.tools)) {
      if (tool.annotations.destructiveHint) expect(tool.justifications.destructive_justification, name).not.toMatch(/^Read-only|^Only adds|can set again|only replaces|created or updated/i);
      if (tool.annotations.openWorldHint) expect(tool.justifications.open_world_justification, name).not.toMatch(/reaches nothing public|^(Reads|Changes|Writes|Deletes) only/i);
    }
  });

  it("gives a reason for every hint", () => {
    for (const [name, tool] of Object.entries(submission.tools)) {
      expect(Object.keys(tool.justifications).sort(), name).toEqual(["destructive_justification", "open_world_justification", "read_only_justification"]);
      for (const text of Object.values(tool.justifications)) expect(text.trim().length, name).toBeGreaterThan(20);
    }
  });

  // A reviewer runs the cases in a workspace filled by `pnpm db:seed-reviewer`. If the seed's table, sequence or
  // people are renamed, the expected results here are wrong: this fails until they match again.
  it("writes its review cases against the reviewer seed, with no real addresses", () => {
    const seed = readFileSync(`${root}packages/core/src/reviewer-seed.ts`, "utf8");
    const cases = submission.test_cases.map((t) => t.expected_output).join("\n");
    for (const anchor of SEED_ANCHORS) {
      expect(seed, anchor).toContain(anchor);
      expect(cases, anchor).toContain(anchor);
    }
    expect(JSON.stringify([submission.test_cases, submission.negative_test_cases])).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });

  // The app directories don't allow selling inside the app: get_credits returns the balance and nothing else.
  it("keeps prices and links to buy out of what ChatGPT sees", () => {
    const seen = tools.map((t) => `${t.description} ${JSON.stringify(t.inputSchema)}`).join("\n");
    expect(seen).not.toMatch(/buy_url|checkout|\/pricing|\$\d/i);
  });
});
