import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The *.db.test.ts files share one database, and the sender and reply scan process every
    // workspace in it (as the worker does), so test files must not run concurrently.
    fileParallelism: false,
  },
});
