// The REST API reference, read from public/openapi.json: the document `pnpm api:spec` builds from the API's own route
// registry (apps/api/src/v1/spec.ts). The docs page can't drift from the API because the API test checks that file.
import openapi from "../../public/openapi.json";

interface Schema {
  type?: string | string[];
  $ref?: string;
  description?: string;
  enum?: unknown[];
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: Schema | boolean;
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

interface Parameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description?: string;
  schema: Schema;
}

interface Operation {
  operationId: string;
  tags: string[];
  summary: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: { content: { "application/json": { schema: Schema } } };
  responses: Record<string, { description: string; content?: { "application/json": { schema: Schema } } }>;
  "x-meerko-replies-scope"?: boolean;
}

export interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiOperation {
  id: string;
  tag: string;
  method: string;
  path: string;
  summary: string;
  description?: string;
  repliesScope: boolean;
  params: Field[];
  body: Field[];
  status: string;
  /** The response's shape, e.g. `{ tables: Table[] }`, or `Mailbox` for a named schema. */
  returns: string;
}

const doc = openapi as unknown as {
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Schema> };
};

const refName = (ref: string) => ref.split("/").pop()!;

/** A short TypeScript-like name for a schema: `string`, `Table[]`, `"new" | "won"`, `Mailbox | null`. */
export function typeOf(s: Schema | undefined): string {
  if (!s) return "unknown";
  if (s.$ref) return refName(s.$ref);
  const union = s.anyOf ?? s.oneOf;
  if (union) return union.map(typeOf).join(" | ");
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(" | ");
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : [];
  const one = (t: string) => {
    if (t === "array") return `${typeOf(s.items)}[]`;
    if (t === "integer") return "number";
    if (t === "object") {
      if (s.properties) return "object";
      const values = typeof s.additionalProperties === "object" ? typeOf(s.additionalProperties) : "unknown";
      return `Record<string, ${values === "object" ? "object" : values}>`;
    }
    return t;
  };
  return types.length ? types.map(one).join(" | ") : "unknown";
}

function describe(s: Schema) {
  const bits = [s.description ?? ""];
  if (s.default !== undefined) bits.push(`Default ${JSON.stringify(s.default)}.`);
  if (s.minimum !== undefined && s.maximum !== undefined && s.maximum < Number.MAX_SAFE_INTEGER) bits.push(`${s.minimum}–${s.maximum}.`);
  return bits.filter(Boolean).join(" ");
}

export const fieldsOf = (s: Schema | undefined): Field[] =>
  Object.entries(s?.properties ?? {}).map(([name, p]) => ({ name, type: typeOf(p), required: s?.required?.includes(name) ?? false, description: describe(p) }));

function shape(s: Schema | undefined): string {
  if (!s) return "nothing";
  if (s.$ref || !s.properties) return typeOf(s);
  return `{ ${Object.entries(s.properties)
    .map(([k, v]) => `${k}${s.required?.includes(k) ? "" : "?"}: ${typeOf(v)}`)
    .join("; ")} }`;
}

export const apiOperations: ApiOperation[] = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => {
    const [status, res] = Object.entries(op.responses).find(([code]) => code !== "default")!;
    return {
      id: op.operationId,
      tag: op.tags[0]!,
      method: method.toUpperCase(),
      path,
      summary: op.summary,
      description: op.description,
      repliesScope: !!op["x-meerko-replies-scope"],
      params: (op.parameters ?? []).map((p) => ({ name: p.name, type: `${p.in} · ${typeOf(p.schema)}`, required: p.required, description: p.description ?? describe(p.schema) })),
      body: fieldsOf(op.requestBody?.content["application/json"].schema),
      status,
      returns: shape(res.content?.["application/json"].schema),
    };
  }),
);

export const apiGroups = doc.tags
  .map((t) => ({ id: t.name, label: t.name[0]!.toUpperCase() + t.name.slice(1), description: t.description, ops: apiOperations.filter((o) => o.tag === t.name) }))
  .filter((g) => g.ops.length > 0);

/** Named response shapes (Table, Mailbox…), with their fields, for the Objects section. */
export const apiObjects = Object.entries(doc.components.schemas)
  .filter(([name, s]) => name !== "ApiError" && s.properties)
  .map(([name, s]) => ({ name, fields: fieldsOf(s) }));
