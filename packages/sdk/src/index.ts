import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type ColumnType = "text" | "number" | "email" | "url" | "boolean" | "json";
export interface Column { key: string; name: string; type: ColumnType; prompt?: string }
export interface PendingCells {
  column: string;
  prompt: string;
  remaining: number;
  rows: { id: string; instruction: string; data: Record<string, unknown> }[];
}
export interface Table { id: string; name: string; columns: Column[]; rowCount: number; createdAt: string }
export interface Row { id: string; data: Record<string, unknown>; createdAt: string }

export type LeadKind = "people" | "companies";
/** Icypeas filters, e.g. { currentJobTitle: { include: ["CTO"] }, "currentCompany.headcount": { ">=": 20 } }. */
export type LeadQuery = Record<string, Record<string, unknown>>;
export interface SearchResult {
  tableId: string;
  tableName: string;
  total: number;
  inserted: number;
  addedColumns: Column[];
}

export type EnrichField = "email" | "email_verification";
export interface EnrichResult {
  processed: number;
  found: Record<EnrichField, number>;
  notFound: number;
  errors: number;
  firstError?: string;
  creditsSpent: number;
  remaining: number;
  stoppedReason?: "insufficient_credits";
  balance?: number;
}

export interface MeerkoConfig { apiUrl: string; apiKey: string }

export const CONFIG_PATH = join(homedir(), ".meerko", "config.json");
export const DEFAULT_API_URL = "http://localhost:8787";

/** Env vars win over ~/.meerko/config.json, so agents can be configured without a login step. */
export function loadConfig(): Partial<MeerkoConfig> {
  let file: Partial<MeerkoConfig> = {};
  try {
    file = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {}
  return {
    apiUrl: process.env.MEERKO_API_URL ?? file.apiUrl ?? DEFAULT_API_URL,
    apiKey: process.env.MEERKO_API_KEY ?? file.apiKey,
  };
}

export class MeerkoApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class MeerkoClient {
  constructor(private config: MeerkoConfig) {}

  static fromEnv(): MeerkoClient {
    const { apiUrl, apiKey } = loadConfig();
    if (!apiKey) throw new Error("No API key. Run `meerko login --key <key>` or set MEERKO_API_KEY.");
    return new MeerkoClient({ apiUrl: apiUrl!, apiKey });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(new URL(`/v1${path}`, this.config.apiUrl), {
      method,
      headers: { authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new MeerkoApiError(res.status, json.error ?? res.statusText);
    return json as T;
  }

  listTables() {
    return this.request<{ tables: Table[] }>("GET", "/tables").then((r) => r.tables);
  }

  getTable(id: string) {
    return this.request<{ table: Table }>("GET", `/tables/${id}`).then((r) => r.table);
  }

  createTable(input: { name: string; columns?: { name: string; type?: ColumnType }[] }) {
    return this.request<{ table: Table }>("POST", "/tables", input).then((r) => r.table);
  }

  addColumn(tableId: string, column: { name: string; type?: ColumnType; prompt?: string }) {
    return this.request<{ table: Table }>("POST", `/tables/${tableId}/columns`, column).then((r) => r.table);
  }

  insertRows(tableId: string, rows: Record<string, unknown>[]) {
    return this.request<{ inserted: number; addedColumns: Column[] }>("POST", `/tables/${tableId}/rows`, { rows });
  }

  /** Free: how many leads match, before spending credits on a search. */
  countLeads(kind: LeadKind, query: LeadQuery) {
    return this.request<{ total: number }>("POST", `/search/${kind}/count`, { query }).then((r) => r.total);
  }

  /** Searches people or companies and writes the results into `tableId`, or a new table named `tableName`. */
  searchLeads(kind: LeadKind, input: { query: LeadQuery; limit?: number; tableId?: string; tableName?: string }) {
    return this.request<SearchResult & { creditsSpent: number; cappedByCredits?: boolean }>("POST", `/search/${kind}`, {
      query: input.query,
      limit: input.limit,
      table_id: input.tableId,
      table_name: input.tableName,
    });
  }

  /** Finds and/or verifies emails for rows that don't have them yet. Call again while `remaining > 0`. */
  enrichRows(
    tableId: string,
    input: { fields?: EnrichField[]; filter?: Record<string, unknown>; limit?: number; overwrite?: boolean } = {},
  ) {
    return this.request<EnrichResult>("POST", `/tables/${tableId}/enrich`, input);
  }

  listProviderKeys() {
    return this.request<{ keys: { provider: string; last4: string; createdAt: string }[] }>("GET", "/provider-keys").then((r) => r.keys);
  }

  /** Stores your own provider key (validated first); calls through it cost no Meerko credits. */
  setProviderKey(provider: string, key: string) {
    return this.request<{ provider: string; last4: string }>("PUT", `/provider-keys/${provider}`, { key });
  }

  deleteProviderKey(provider: string) {
    return this.request<{ deleted: boolean }>("DELETE", `/provider-keys/${provider}`);
  }

  getCredits() {
    return this.request<{ enabled: boolean; balance: number | null }>("GET", "/credits");
  }

  updateRows(tableId: string, updates: { id: string; data: Record<string, unknown> }[]) {
    return this.request<{ updated: number; addedColumns: Column[] }>("PATCH", `/tables/${tableId}/rows`, { updates });
  }

  /** Rows whose AI column is still empty, with the column's instruction rendered per row. */
  getPendingCells(tableId: string, column: string, opts: { filter?: Record<string, unknown>; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.filter) params.set("filter", JSON.stringify(opts.filter));
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    const qs = params.size ? `?${params}` : "";
    return this.request<PendingCells>("GET", `/tables/${tableId}/columns/${encodeURIComponent(column)}/pending${qs}`);
  }

  queryRows(tableId: string, opts: { filter?: Record<string, unknown>; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.filter) params.set("filter", JSON.stringify(opts.filter));
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    const qs = params.size ? `?${params}` : "";
    return this.request<{ rows: Row[] }>("GET", `/tables/${tableId}/rows${qs}`).then((r) => r.rows);
  }
}
