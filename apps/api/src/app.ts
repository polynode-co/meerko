import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { addColumn, createTable, getTable, insertRows, listTables, NotFoundError, queryRows, verifyApiKey } from "@meerko/core";
import type { Db } from "@meerko/db";

type Env = { Variables: { workspaceId: string } };

const columnType = z.enum(["text", "number", "email", "url", "boolean", "json"]);
const columnInput = z.object({ name: z.string().min(1), type: columnType.default("text") });
const createTableInput = z.object({ name: z.string().min(1), columns: z.array(columnInput).optional() });
const insertRowsInput = z.object({ rows: z.array(z.record(z.string(), z.unknown())).max(10_000) });
const queryInput = z.object({
  filter: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s) return undefined;
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      } catch {}
      ctx.addIssue({ code: "custom", message: "filter must be a JSON object, e.g. {\"country\":\"Spain\"}" });
      return z.NEVER;
    }),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

async function parse<T extends z.ZodType>(schema: T, data: unknown): Promise<z.infer<T>> {
  const result = await schema.safeParseAsync(data);
  if (!result.success) throw new HTTPException(400, { message: z.prettifyError(result.error) });
  return result.data;
}

export function createApp(db: Db) {
  const app = new Hono<Env>();

  app.get("/health", (c) => c.json({ ok: true }));

  const v1 = new Hono<Env>();

  v1.use(async (c, next) => {
    const key = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const auth = key ? await verifyApiKey(db, key) : null;
    if (!auth) throw new HTTPException(401, { message: "Missing or invalid API key" });
    c.set("workspaceId", auth.workspaceId);
    await next();
  });

  v1.get("/tables", async (c) => c.json({ tables: await listTables(db, c.var.workspaceId) }));

  v1.post("/tables", async (c) => {
    const input = await parse(createTableInput, await c.req.json());
    return c.json({ table: await createTable(db, c.var.workspaceId, input) }, 201);
  });

  v1.get("/tables/:id", async (c) => c.json({ table: await getTable(db, c.var.workspaceId, c.req.param("id")) }));

  v1.post("/tables/:id/columns", async (c) => {
    const input = await parse(columnInput, await c.req.json());
    return c.json({ table: await addColumn(db, c.var.workspaceId, c.req.param("id"), input) });
  });

  v1.post("/tables/:id/rows", async (c) => {
    const { rows } = await parse(insertRowsInput, await c.req.json());
    return c.json(await insertRows(db, c.var.workspaceId, c.req.param("id"), rows), 201);
  });

  v1.get("/tables/:id/rows", async (c) => {
    const opts = await parse(queryInput, c.req.query());
    return c.json({ rows: await queryRows(db, c.var.workspaceId, c.req.param("id"), opts) });
  });

  app.route("/v1", v1);

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404);
    // Postgres "invalid input syntax for type uuid" -> treat as not found.
    if ((err as { code?: string }).code === "22P02" || (err as { cause?: { code?: string } }).cause?.code === "22P02")
      return c.json({ error: "Not found" }, 404);
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
