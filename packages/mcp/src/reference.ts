import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.ts";

/** The tools and prompts exactly as an agent sees them (tools/list and prompts/list), for the docs. */
export async function describeMcp() {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer(() => {
    throw new Error("The docs only list tools; nothing is called");
  });
  await server.connect(serverSide);
  const client = new Client({ name: "meerko-docs", version: "0.0.0" });
  await client.connect(clientSide);
  const [{ tools }, { prompts }] = await Promise.all([client.listTools(), client.listPrompts()]);
  await client.close();
  return {
    tools: tools.map(({ name, title, description, annotations, inputSchema }) => ({ name, title: title ?? name, description: description ?? "", annotations: annotations ?? {}, inputSchema })),
    prompts: prompts.map(({ name, title, description, arguments: args }) => ({ name, title: title ?? name, description: description ?? "", arguments: args ?? [] })),
  };
}
