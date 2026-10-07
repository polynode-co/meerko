#!/usr/bin/env -S npx tsx
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { instrument } from "@posthog/mcp";
import { PostHog } from "posthog-node";
import { MeerkoClient } from "@meerko/sdk";
import { createServer } from "./server.ts";

let client: MeerkoClient | undefined;
const getClient = () => (client ??= MeerkoClient.fromEnv());
const server = createServer(getClient);

// Analytics are off unless POSTHOG_API_KEY is set: a self-hosted install sends nothing anywhere.
// Meerko Cloud's hosted /mcp is instrumented on the API side instead.
const key = process.env.POSTHOG_API_KEY;
if (key) {
  // Sent one by one: agents end stdio servers abruptly, so a batch waiting in memory would be lost.
  const posthog = new PostHog(key, { host: process.env.POSTHOG_HOST || "https://eu.i.posthog.com", flushAt: 1, flushInterval: 0 });
  let workspace: Promise<{ id: string; name: string } | null> | undefined;
  instrument(server, posthog, {
    // The key acts on one workspace; look it up once.
    identify: async () => {
      workspace ??= getClient()
        .me()
        .then((me) => me.workspace)
        .catch(() => null);
      const ws = await workspace;
      return ws ? { distinctId: ws.id, properties: { workspace_name: ws.name }, groups: { workspace: ws.id } } : null;
    },
    eventProperties: async () => ({ app_env: process.env.APP_ENV || "local", surface: "mcp" }),
    // stdout carries the protocol, so warnings go to stderr.
    logger: (message) => console.error(`[posthog-mcp] ${message}`),
  });
  const flush = async () => {
    await posthog.shutdown().catch(() => {});
    process.exit(0);
  };
  process.once("SIGINT", flush);
  process.once("SIGTERM", flush);
  process.stdin.once("end", flush);
}

await server.connect(new StdioServerTransport());
