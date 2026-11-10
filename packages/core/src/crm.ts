/**
 * CRM sync: leads Meerko works on are pushed to the workspace's HubSpot or Attio as contacts (people), matched by
 * email so a sync never makes duplicates. One-way, Meerko → CRM. Automatic syncs cover leads past `new` (Meerko has
 * emailed them) whose stage changed since they were last pushed; a manual sync pushes any rows with an email.
 *
 * HubSpot: a private app token (scopes crm.objects.contacts.read and .write; crm.schemas.contacts.read lets the
 * stage land in Lead status). Attio: an API key with record_permission:read-write and object_configuration:read.
 */
import { and, crmConnections, dataTables, eq, isNotNull, sql, tableRows, type CrmProvider, type Db, type Stage } from "@meerko/db";
import { EncryptionNotConfiguredError, type SecretBox } from "./provider-keys.ts";
import { getTable, NotFoundError } from "./tables.ts";

export class CrmError extends Error {
  constructor(
    message: string,
    /** `auth`: the token was rejected or lacks a scope; automatic syncs stop until it's replaced. */
    readonly code: "auth" | "crm_error" = "crm_error",
  ) {
    super(message);
  }
}

export interface CrmPerson {
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  company: string | null;
  domain: string | null;
  linkedin: string | null;
  stage: Stage;
}

export interface CrmClient {
  /** Checks the token and names the account. Throws CrmError("auth") when it's refused. */
  identify(): Promise<{ accountName: string | null }>;
  /** Upserts by email. Returns the CRM's record id per lowercased email; people that failed are left out. */
  upsert(people: CrmPerson[]): Promise<{ ids: Map<string, string>; errors: string[] }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** The person a row describes, or null when it has no usable email. Reads the columns search and import write. */
export function rowToPerson(data: Record<string, unknown>, stage: Stage): CrmPerson | null {
  const email = str(data.email)?.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  let firstName = str(data.first_name) ?? str(data.firstname);
  let lastName = str(data.last_name) ?? str(data.lastname);
  const full = str(data.name) ?? str(data.full_name);
  if (!firstName && !lastName && full) {
    const [first, ...rest] = full.split(/\s+/);
    firstName = first ?? null;
    lastName = rest.join(" ") || null;
  }
  const domain = (str(data.domain) ?? str(data.website) ?? str(data.company_domain))
    ?.replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]!
    .toLowerCase();
  return {
    email,
    firstName,
    lastName,
    title: str(data.title) ?? str(data.job_title),
    company: str(data.company),
    domain: domain && domain.includes(".") ? domain : null,
    linkedin: str(data.linkedin_url) ?? str(data.linkedin),
    stage,
  };
}

async function readError(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { message?: string };
    return j.message ?? text.slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

// --- HubSpot ---

const HUBSPOT = "https://api.hubapi.com";

/** Meerko stages → HubSpot's default Lead status labels. Matched by label, since each portal can rename values. */
const HUBSPOT_LEAD_STATUS: Partial<Record<Stage, string>> = {
  new: "new",
  contacted: "attempted to contact",
  replied: "connected",
  meeting: "open deal",
  lost: "unqualified",
};

export function hubspotClient(token: string, f: typeof fetch = fetch): CrmClient {
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await f(`${HUBSPOT}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) throw new CrmError("HubSpot rejected the token. Create a new private app token and reconnect.", "auth");
    if (res.status === 403) throw new CrmError(`HubSpot refused: ${await readError(res)}. Give the private app the contacts read and write scopes.`, "auth");
    return res;
  };
  let statusValues: Map<string, string> | null | undefined;
  const leadStatus = async (stage: Stage) => {
    if (statusValues === undefined) {
      // Needs crm.schemas.contacts.read. Without it, contacts still sync, just without Lead status.
      const res = await f(`${HUBSPOT}/crm/v3/properties/contacts/hs_lead_status`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      }).catch(() => null);
      if (res?.ok) {
        const body = (await res.json()) as { options?: { label: string; value: string; hidden?: boolean }[] };
        statusValues = new Map((body.options ?? []).filter((o) => !o.hidden).map((o) => [o.label.trim().toLowerCase(), o.value]));
      } else statusValues = null;
    }
    const label = HUBSPOT_LEAD_STATUS[stage];
    return label ? (statusValues?.get(label) ?? null) : null;
  };
  return {
    async identify() {
      const res = await call("/crm/v3/objects/contacts?limit=1");
      if (!res.ok) throw new CrmError(`HubSpot answered ${res.status}: ${await readError(res)}`);
      const info = await f(`${HUBSPOT}/account-info/v3/details`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
      const portal = info?.ok ? ((await info.json()) as { portalId?: number }).portalId : undefined;
      return { accountName: portal ? `HubSpot account ${portal}` : "HubSpot" };
    },
    async upsert(people) {
      const ids = new Map<string, string>();
      const errors: string[] = [];
      for (let i = 0; i < people.length; i += 100) {
        const batch = people.slice(i, i + 100);
        const inputs = await Promise.all(
          batch.map(async (p) => {
            const props: Record<string, string> = { email: p.email };
            if (p.firstName) props.firstname = p.firstName;
            if (p.lastName) props.lastname = p.lastName;
            if (p.title) props.jobtitle = p.title;
            if (p.company) props.company = p.company;
            if (p.domain) props.website = p.domain;
            const status = await leadStatus(p.stage);
            if (status) props.hs_lead_status = status;
            return { idProperty: "email", id: p.email, properties: props };
          }),
        );
        const res = await call("/crm/v3/objects/contacts/batch/upsert", { method: "POST", body: JSON.stringify({ inputs }) });
        if (!res.ok && res.status !== 207) {
          errors.push(`HubSpot answered ${res.status}: ${await readError(res)}`);
          continue;
        }
        const body = (await res.json()) as { results?: { id: string; properties?: { email?: string } }[]; errors?: { message?: string }[] };
        for (const r of body.results ?? []) if (r.properties?.email) ids.set(r.properties.email.toLowerCase(), r.id);
        for (const e of body.errors ?? []) errors.push(e.message ?? "HubSpot refused a contact");
      }
      return { ids, errors };
    },
  };
}

// --- Attio ---

const ATTIO = "https://api.attio.com/v2";

export function attioClient(token: string, f: typeof fetch = fetch): CrmClient {
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await f(`${ATTIO}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401) throw new CrmError("Attio rejected the API key. Create a new one and reconnect.", "auth");
    if (res.status === 403) throw new CrmError(`Attio refused: ${await readError(res)}. Give the key read-write access to records.`, "auth");
    return res;
  };
  const put = (values: Record<string, unknown>) =>
    call("/objects/people/records?matching_attribute=email_addresses", { method: "PUT", body: JSON.stringify({ data: { values } }) });
  return {
    async identify() {
      const res = await call("/self");
      if (!res.ok) throw new CrmError(`Attio answered ${res.status}: ${await readError(res)}`);
      const body = (await res.json()) as { active?: boolean; workspace_name?: string };
      if (body.active === false) throw new CrmError("Attio says this API key is no longer active.", "auth");
      return { accountName: body.workspace_name ? `Attio · ${body.workspace_name}` : "Attio" };
    },
    async upsert(people) {
      const ids = new Map<string, string>();
      const errors: string[] = [];
      // Attio has no batch upsert; one request per person stays well inside its rate limit at these sizes.
      for (const p of people) {
        const values: Record<string, unknown> = { email_addresses: [p.email] };
        if (p.firstName || p.lastName) {
          const full = [p.firstName, p.lastName].filter(Boolean).join(" ");
          values.name = [{ first_name: p.firstName ?? "", last_name: p.lastName ?? "", full_name: full }];
        }
        if (p.title) values.job_title = p.title;
        if (p.linkedin) values.linkedin = p.linkedin;
        let res = p.domain
          ? await put({
              ...values,
              company: [
                {
                  target_object: "companies",
                  target_record_reference: {
                    match: { domains: [{ domain: p.domain }] },
                    if_unmatched: "create",
                    if_multiple_matches: "error",
                    create: { name: p.company ?? p.domain },
                  },
                },
              ],
            })
          : await put(values);
        // A company that can't be matched or created shouldn't lose the person: retry without it.
        if (!res.ok && p.domain && res.status === 400) res = await put(values);
        if (!res.ok) {
          errors.push(`${p.email}: Attio answered ${res.status}: ${await readError(res)}`);
          continue;
        }
        const body = (await res.json()) as { data?: { id?: { record_id?: string } } };
        if (body.data?.id?.record_id) ids.set(p.email, body.data.id.record_id);
      }
      return { ids, errors };
    },
  };
}

// --- Connection ---

export interface CrmDeps {
  fetch?: typeof fetch;
  /** Tests swap the HTTP clients. */
  client?: (provider: CrmProvider, token: string) => CrmClient;
}

const makeClient = (deps: CrmDeps, provider: CrmProvider, token: string) =>
  deps.client ? deps.client(provider, token) : provider === "hubspot" ? hubspotClient(token, deps.fetch) : attioClient(token, deps.fetch);

export interface CrmConnectionView {
  provider: CrmProvider;
  last4: string;
  accountName: string | null;
  autoSync: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

/** Checks the token with the CRM, then stores it encrypted. Replaces any CRM the workspace had. */
export async function connectCrm(
  db: Db,
  box: SecretBox | null,
  workspaceId: string,
  input: { provider: CrmProvider; token: string; autoSync?: boolean },
  deps: CrmDeps = {},
): Promise<CrmConnectionView> {
  if (!box) throw new EncryptionNotConfiguredError();
  const token = input.token.trim();
  const { accountName } = await makeClient(deps, input.provider, token).identify();
  const before = await getCrmConnection(db, workspaceId);
  const values = {
    workspaceId,
    provider: input.provider,
    encryptedToken: box.encrypt(token),
    last4: token.slice(-4),
    accountName,
    autoSync: input.autoSync ?? true,
  };
  await db
    .insert(crmConnections)
    .values(values)
    .onConflictDoUpdate({
      target: crmConnections.workspaceId,
      set: { ...values, lastSyncedAt: null, lastError: null, createdAt: sql`now()` },
    });
  // A different CRM (or account) doesn't have the records the old one did, so everything goes again.
  if (!before || before.provider !== input.provider || before.accountName !== accountName) await db
    .update(tableRows)
    .set({ crmSyncedAt: null, crmRecordId: null })
    .where(and(isNotNull(tableRows.crmSyncedAt), sql`${tableRows.tableId} in (select id from data_tables where workspace_id = ${workspaceId})`));
  return (await getCrmConnection(db, workspaceId))!;
}

export async function getCrmConnection(db: Db, workspaceId: string): Promise<CrmConnectionView | null> {
  const [row] = await db
    .select({
      provider: crmConnections.provider,
      last4: crmConnections.last4,
      accountName: crmConnections.accountName,
      autoSync: crmConnections.autoSync,
      lastSyncedAt: crmConnections.lastSyncedAt,
      lastError: crmConnections.lastError,
      createdAt: crmConnections.createdAt,
    })
    .from(crmConnections)
    .where(eq(crmConnections.workspaceId, workspaceId));
  return row ?? null;
}

export async function setCrmAutoSync(db: Db, workspaceId: string, autoSync: boolean) {
  const res = await db.update(crmConnections).set({ autoSync }).where(eq(crmConnections.workspaceId, workspaceId)).returning({ id: crmConnections.id });
  if (!res.length) throw new NotFoundError("No CRM is connected");
  return (await getCrmConnection(db, workspaceId))!;
}

/** Disconnects. Contacts already in the CRM stay there. */
export async function deleteCrmConnection(db: Db, workspaceId: string) {
  const res = await db.delete(crmConnections).where(eq(crmConnections.workspaceId, workspaceId)).returning({ id: crmConnections.id });
  if (!res.length) throw new NotFoundError("No CRM is connected");
}

async function loadConnection(db: Db, box: SecretBox | null, workspaceId: string) {
  const [row] = await db.select().from(crmConnections).where(eq(crmConnections.workspaceId, workspaceId));
  if (!row) return null;
  if (!box) throw new EncryptionNotConfiguredError();
  return { ...row, token: box.decrypt(row.encryptedToken) };
}

// --- Sync ---

export interface CrmSyncResult {
  provider: CrmProvider;
  synced: number;
  /** Rows without a usable email: CRMs match contacts by email. */
  skipped: number;
  failed: number;
  /** Rows of the request still waiting, when it was bigger than one pass. Call again to continue. */
  remaining: number;
  errors: string[];
}

type Candidate = { id: string; data: Record<string, unknown>; stage: Stage };

async function pushRows(db: Db, conn: NonNullable<Awaited<ReturnType<typeof loadConnection>>>, rows: Candidate[], deps: CrmDeps) {
  const people: CrmPerson[] = [];
  const rowsByEmail = new Map<string, string[]>();
  let skipped = 0;
  for (const r of rows) {
    const p = rowToPerson(r.data, r.stage);
    if (!p) {
      skipped++;
      continue;
    }
    if (!rowsByEmail.has(p.email)) people.push(p);
    rowsByEmail.set(p.email, [...(rowsByEmail.get(p.email) ?? []), r.id]);
  }
  let ids = new Map<string, string>();
  let errors: string[] = [];
  try {
    if (people.length) ({ ids, errors } = await makeClient(deps, conn.provider, conn.token).upsert(people));
  } catch (err) {
    if (!(err instanceof CrmError)) throw err;
    // A refused token stops automatic syncs until someone reconnects, instead of failing every minute.
    await db
      .update(crmConnections)
      .set({ lastError: err.message, ...(err.code === "auth" ? { autoSync: false } : {}) })
      .where(eq(crmConnections.id, conn.id));
    throw err;
  }
  let synced = 0;
  for (const [email, recordId] of ids) {
    const rowIds = rowsByEmail.get(email) ?? [];
    if (!rowIds.length) continue;
    await db.update(tableRows).set({ crmSyncedAt: sql`now()`, crmRecordId: recordId }).where(sql`${tableRows.id} in ${rowIds}`);
    synced += rowIds.length;
  }
  // Rows without an email are marked too, so the automatic pass doesn't pick them up every minute.
  const noEmail = rows.filter((r) => !rowToPerson(r.data, r.stage)).map((r) => r.id);
  if (noEmail.length) await db.update(tableRows).set({ crmSyncedAt: sql`now()` }).where(sql`${tableRows.id} in ${noEmail}`);
  const failed = rows.length - skipped - synced;
  await db
    .update(crmConnections)
    .set({ lastSyncedAt: sql`now()`, lastError: errors.length ? errors.slice(0, 3).join("; ") : null })
    .where(eq(crmConnections.id, conn.id));
  return { synced, skipped, failed, errors: errors.slice(0, 10) };
}

export const CRM_SYNC_BATCH = 100;

/**
 * Pushes a table's rows to the CRM: `rowIds` (up to CRM_SYNC_BATCH), or every row. Rows never pushed, or changed stage since, go first,
 * `CRM_SYNC_BATCH` per call; `remaining` says how many of the request are still waiting.
 */
export async function syncRowsToCrm(
  db: Db,
  box: SecretBox | null,
  workspaceId: string,
  input: { tableId: string; rowIds?: string[] },
  deps: CrmDeps = {},
): Promise<CrmSyncResult> {
  await getTable(db, workspaceId, input.tableId);
  const conn = await loadConnection(db, box, workspaceId);
  if (!conn) throw new NotFoundError("No CRM is connected. Connect HubSpot or Attio in Connections first");
  const scope = [eq(tableRows.tableId, input.tableId)];
  if (input.rowIds) {
    if (input.rowIds.length > CRM_SYNC_BATCH) throw new CrmError(`Sync up to ${CRM_SYNC_BATCH} rows at a time`);
    if (!input.rowIds.length) return { provider: conn.provider, synced: 0, skipped: 0, failed: 0, remaining: 0, errors: [] };
    scope.push(sql`${tableRows.id} in ${input.rowIds}`);
  }
  const stale = sql`(${tableRows.crmSyncedAt} is null or ${tableRows.stageChangedAt} > ${tableRows.crmSyncedAt})`;
  // A manual sync of specific rows always pushes them; a whole-table sync skips rows already up to date.
  const conds = input.rowIds ? scope : [...scope, stale];
  const rows = await db
    .select({ id: tableRows.id, data: tableRows.data, stage: tableRows.stage })
    .from(tableRows)
    .where(and(...conds))
    .orderBy(sql`${tableRows.crmSyncedAt} asc nulls first`, tableRows.seq)
    .limit(CRM_SYNC_BATCH);
  const res = await pushRows(db, conn, rows, deps);
  // Specific rows (at most CRM_SYNC_BATCH) are all done in one pass. A whole table: rows still out of date,
  // failures included, so a caller looping on `remaining` should stop when a pass syncs nothing.
  let remaining = 0;
  if (!input.rowIds) {
    const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(tableRows).where(and(...conds));
    remaining = left?.n ?? 0;
  }
  return { provider: conn.provider, ...res, remaining };
}

export interface CrmTickResult {
  workspaces: number;
  synced: number;
  failed: number;
}

/**
 * The automatic pass: for each workspace with auto-sync on, leads past `new` whose stage changed since their last
 * push (or that were never pushed), up to CRM_SYNC_BATCH per workspace.
 */
export async function runCrmSyncTick(db: Db, deps: CrmDeps & { box: SecretBox | null }): Promise<CrmTickResult> {
  const result: CrmTickResult = { workspaces: 0, synced: 0, failed: 0 };
  if (!deps.box) return result;
  const conns = await db.select({ workspaceId: crmConnections.workspaceId }).from(crmConnections).where(eq(crmConnections.autoSync, true));
  for (const { workspaceId } of conns) {
    const rows = await db
      .select({ id: tableRows.id, data: tableRows.data, stage: tableRows.stage })
      .from(tableRows)
      .innerJoin(dataTables, eq(tableRows.tableId, dataTables.id))
      .where(
        and(
          eq(dataTables.workspaceId, workspaceId),
          sql`${tableRows.stage} <> 'new'`,
          sql`(${tableRows.crmSyncedAt} is null or ${tableRows.stageChangedAt} > ${tableRows.crmSyncedAt})`,
        ),
      )
      .limit(CRM_SYNC_BATCH);
    if (!rows.length) continue;
    const conn = await loadConnection(db, deps.box, workspaceId);
    if (!conn) continue;
    result.workspaces++;
    try {
      const res = await pushRows(db, conn, rows, deps);
      result.synced += res.synced;
      result.failed += res.failed;
    } catch (err) {
      if (!(err instanceof CrmError)) throw err;
      result.failed += rows.length;
    }
  }
  return result;
}
