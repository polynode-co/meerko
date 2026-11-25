import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  // infer: Postgres.js 4 leaves every parameter's type to the server, so a value the query doesn't
  // type (`select ${true}`, `coalesce(x, ${false})`) arrives as text. infer: true types booleans,
  // bigints, Buffers and Dates from JavaScript, as 3.x did, so raw sql`` fragments keep their types.
  const client = postgres(url, { max: 10, infer: true });
  return Object.assign(drizzle(client, { schema }), { close: () => client.end() });
}

export type Db = ReturnType<typeof createDb>;
