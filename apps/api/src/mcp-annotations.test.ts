import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TOOL_ANNOTATIONS } from "@meerko/mcp/annotations";
import { createServer } from "@meerko/mcp/server";
import { describe, expect, it } from "vitest";

// The Claude Connectors Directory and the ChatGPT app directory require a title and explicit hints on every tool.
describe("MCP tool annotations", async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(() => {
    throw new Error("nothing is called");
  });
  await server.connect(serverSide);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientSide);
  const { tools } = await client.listTools();

  it("gives every tool a title and all three hints", () => {
    for (const t of tools) {
      expect(t.title, t.name).toBeTruthy();
      expect(typeof t.annotations?.readOnlyHint, t.name).toBe("boolean");
      expect(typeof t.annotations?.destructiveHint, t.name).toBe("boolean");
      expect(typeof t.annotations?.openWorldHint, t.name).toBe("boolean");
    }
  });

  it("has no stale entries", () => {
    expect(Object.keys(TOOL_ANNOTATIONS).sort()).toEqual(tools.map((t) => t.name).sort());
  });

  // draft_reply and enroll_rows too: a draft goes at once in a workspace that sends automatically, and enrolling into
  // a running sequence gets the leads emailed (#89).
  it("marks every tool that can lead to an email as destructive and open-world", () => {
    for (const name of ["send_test_email", "start_sequence", "approve_emails", "approve_draft", "draft_reply", "enroll_rows"]) {
      expect(tools.find((t) => t.name === name)?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
    }
  });

  // OpenAI's MCP scan compares each hint with everything the tool can do, not with what it does by default (#16).
  it("marks tools that overwrite or replace the user's data as destructive", () => {
    for (const name of ["add_column", "set_icp", "review_icp_fit", "enrich_rows", "update_rows", "update_sequence"]) {
      expect(tools.find((t) => t.name === name)?.annotations, name).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
  });

  it("marks manage_routine as open-world: run_now calls the user's Claude routine or webhook", () => {
    expect(tools.find((t) => t.name === "manage_routine")?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
  });

  it("says in draft_reply's title that it can send", () => {
    expect(tools.find((t) => t.name === "draft_reply")?.title).toBe("Draft (or send) a reply");
  });
});
