import { afterAll, describe, expect, it } from "vitest";
import { createDb, sql, type Db } from "@meerko/db";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("the database client (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  afterAll(async () => {
    await db.close();
  });

  // Postgres.js 4 sends parameters untyped unless `infer` is on; then a boolean the query doesn't
  // type comes back as the text "true".
  it("keeps the JavaScript type of a parameter the query doesn't type", async () => {
    const [row] = await db.execute<{ yes: unknown; no: unknown }>(sql`select ${true} as yes, coalesce(null, ${false}) as no`);
    expect(row).toEqual({ yes: true, no: false });
  });
});
