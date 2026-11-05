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

  it("marks every real send as destructive and open-world", () => {
    for (const name of ["send_test_email", "start_sequence", "approve_draft"]) {
      expect(tools.find((t) => t.name === name)?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
    }
  });
});
