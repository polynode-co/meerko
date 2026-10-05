import type { ColumnDef, ColumnType } from "@meerko/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/|www\.)\S+$/i;

/** Normalizes a header like "First Name" into a stable column key: "first_name". */
export function toColumnKey(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || "column";
}

export function inferColumnType(values: unknown[]): ColumnType {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (present.length === 0) return "text";
  const all = (test: (v: unknown) => boolean) => present.every(test);
  if (all((v) => typeof v === "boolean" || v === "true" || v === "false")) return "boolean";
  if (all((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))))
    return "number";
  if (all((v) => typeof v === "string" && EMAIL_RE.test(v))) return "email";
  if (all((v) => typeof v === "string" && URL_RE.test(v))) return "url";
  if (all((v) => typeof v === "object")) return "json";
  return "text";
}

/** Returns column definitions for keys present in `rows` but missing from `existing`. */
export function inferNewColumns(existing: ColumnDef[], rows: Record<string, unknown>[]): ColumnDef[] {
  const known = new Set(existing.map((c) => c.key));
  const added: ColumnDef[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (known.has(key)) continue;
      known.add(key);
      added.push({ key, name: key, type: inferColumnType(rows.map((r) => r[key])) });
    }
  }
  return added;
}

/** Re-keys a raw record (e.g. a CSV row) so every key is a normalized column key. */
export function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(raw)) out[toColumnKey(name)] = value;
  return out;
}

/** Converts string values (e.g. from CSV) to their column's type; blank strings become null. */
export function coerceRow(row: Record<string, unknown>, columns: ColumnDef[]): Record<string, unknown> {
  const types = new Map(columns.map((c) => [c.key, c.type]));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== "string") {
      out[key] = value;
      continue;
    }
    if (value.trim() === "") {
      out[key] = null;
      continue;
    }
    const type = types.get(key);
    if (type === "number" && !Number.isNaN(Number(value))) out[key] = Number(value);
    else if (type === "boolean" && (value === "true" || value === "false")) out[key] = value === "true";
    else out[key] = value;
  }
  return out;
}
