/**
 * The public OpenAPI 3.1 document, built from spec.ts. `pnpm api:spec` writes it to apps/web/public/openapi.json
 * (served at meerko.ai/openapi.json); `--check` fails when the committed copy is stale.
 *
 * Only `access: "any"` operations are published: the rest need a person signed in to the dashboard, so an API key
 * can't call them anyway.
 */
import { z } from "zod";
import * as schemas from "./schemas.ts";
import { TAGS, V1, type Operation } from "./spec.ts";

type Json = Record<string, unknown>;

/**
 * Response shapes named in schemas.ts (capitalised exports) become components and are referenced by name. The id
 * goes in zod's global registry, next to the `.describe()` text that lives there too.
 */
const named = z.globalRegistry;
for (const [name, schema] of Object.entries(schemas)) {
  if (/^[A-Z]/.test(name) && schema instanceof z.ZodType) named.add(schema, { ...named.get(schema), id: name });
}

function jsonSchema(schema: z.ZodType, io: "input" | "output", components: Json): Json {
  const out = z.toJSONSchema(schema, {
    metadata: named,
    io,
    target: "draft-2020-12",
    // A `transform` (e.g. the JSON `filter` query parameter) documents as its input type.
    unrepresentable: "any",
    override: (ctx) => {
      // Responses gain fields over time; a client shouldn't reject one it doesn't know yet.
      if (ctx.jsonSchema.additionalProperties === false) delete ctx.jsonSchema.additionalProperties;
    },
  }) as Json;
  const defs = (out.$defs ?? {}) as Json;
  delete out.$defs;
  delete out.$schema;
  const rewrite = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v).replaceAll('"#/$defs/', '"#/components/schemas/'));
  for (const [id, def] of Object.entries(defs)) components[id] = rewrite(def);
  // A schema that is itself named comes back as its definition plus `id`; reference it instead.
  const id = named.get(schema)?.id;
  if (id) {
    const { id: _, ...def } = out;
    components[id] = rewrite(def);
    return { $ref: `#/components/schemas/${id}` };
  }
  return rewrite(out) as Json;
}

const toOpenApiPath = (path: string) => `/v1${path.replace(/:([^/]+)/g, "{$1}")}`;

function operation(op: Operation, components: Json): Json {
  const params: Json[] = [...op.path.matchAll(/:([^/]+)/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }));
  if (op.query) {
    const q = jsonSchema(op.query, "input", components) as { properties?: Json; required?: string[] };
    for (const [name, schema] of Object.entries(q.properties ?? {})) {
      const { description, ...rest } = schema as Json;
      params.push({ name, in: "query", required: q.required?.includes(name) ?? false, schema: rest, ...(description ? { description } : {}) });
    }
  }
  const status = String(op.status ?? 200);
  const responses: Json = {
    [status]: op.response
      ? { description: op.summary, content: { "application/json": { schema: jsonSchema(op.response, "output", components) } } }
      : { description: op.summary },
    default: { description: "An error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
  };
  return {
    operationId: op.id,
    tags: [op.tag],
    summary: op.summary,
    ...(op.description ? { description: op.description } : {}),
    ...(op.scope === "replies" ? { "x-meerko-replies-scope": true } : {}),
    ...(params.length ? { parameters: params } : {}),
    ...(op.body ? { requestBody: { required: true, content: { "application/json": { schema: jsonSchema(op.body, "input", components) } } } } : {}),
    responses,
  };
}

export function buildOpenApi(): Json {
  const components: Json = {};
  jsonSchema(schemas.ApiError, "output", components);
  const paths: Record<string, Json> = {};
  for (const op of V1) {
    if (op.access !== "any") continue;
    (paths[toOpenApiPath(op.path)] ??= {})[op.method] = operation(op, components);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Meerko API",
      version: "1",
      description:
        "Everything the Meerko dashboard, CLI and MCP server do, over HTTP: they are clients of this same API. " +
        "Authenticate with an API key from Connections → API keys (`Authorization: Bearer mk_…`).",
    },
    servers: [{ url: "https://api.meerko.ai" }],
    security: [{ bearer: [] }],
    tags: Object.entries(TAGS).map(([name, description]) => ({ name, description })),
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "An API key (mk_…) or an OAuth access token (mo_…)" } },
      schemas: Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))),
    },
  };
}
