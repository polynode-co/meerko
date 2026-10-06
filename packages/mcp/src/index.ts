#!/usr/bin/env -S npx tsx
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MeerkoClient } from "@meerko/sdk";
import { createServer } from "./server.ts";

await createServer(() => MeerkoClient.fromEnv()).connect(new StdioServerTransport());
