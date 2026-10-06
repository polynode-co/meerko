#!/usr/bin/env -S npx tsx
import { program } from "./program.ts";

program.parseAsync().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
