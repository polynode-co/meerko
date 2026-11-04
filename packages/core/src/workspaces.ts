import { and, asc, creditLedger, eq, memberships, oauthGrants, sessions, sql, workspaces, type Db, type Role } from "@meerko/db";

/**
 * Workspaces are brands: their own tables, mailboxes, sequences and settings. Billing is per person instead. The
 * first workspace someone owns pays, and every workspace they create afterwards points at it
 * (`workspaces.billing_workspace_id`), so plan, Stripe customer, credit balance and plan limits are shared.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const NAME_MAX = 80;
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** A workspace request that can't be done (not a member, bad name). The message is safe to show. */
export class WorkspaceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 = 400,
  ) {
    super(message);
  }
}

/** The workspace whose plan, Stripe customer and credits `workspaceId` uses: itself, or the one it points at. */
export async function billingWorkspaceOf(db: Db | Tx, workspaceId: string): Promise<string> {
  const [ws] = await db.select({ billing: workspaces.billingWorkspaceId }).from(workspaces).where(eq(workspaces.id, workspaceId));
  return ws?.billing ?? workspaceId;
}

/** Every workspace sharing `billingId`'s plan: the payer and the ones pointing at it. */
export function sharesBilling(billingId: string) {
  return sql`(${workspaces.id} = ${billingId} or ${workspaces.billingWorkspaceId} = ${billingId})`;
}

/** The workspaces `userId` belongs to, oldest membership first, with their role in each. */
export async function listWorkspaces(db: Db, userId: string) {
  return db
    .select({ id: workspaces.id, name: workspaces.name, role: memberships.role, createdAt: workspaces.createdAt })
    .from(memberships)
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt));
}

async function membership(db: Db | Tx, userId: string, workspaceId: string): Promise<Role | null> {
  if (!isUuid(workspaceId)) return null;
  const [m] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)));
  return m?.role ?? null;
}

function cleanName(name: string) {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw new WorkspaceError("Give the workspace a name.");
  if (n.length > NAME_MAX) throw new WorkspaceError(`Keep the name under ${NAME_MAX} characters.`);
  return n;
}

/**
 * A new workspace owned by `userId`, billed to the workspace that pays for the others they own. Someone who owns none
 * yet (they were only invited) gets one that pays for itself, with the free tier a signup gets.
 */
export async function createWorkspace(db: Db, userId: string, name: string, freeTierCredits: number) {
  const clean = cleanName(name);
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: workspaces.id, billing: workspaces.billingWorkspaceId })
      .from(memberships)
      .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
      .where(and(eq(memberships.userId, userId), eq(memberships.role, "owner")))
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    const billingWorkspaceId = owned ? (owned.billing ?? owned.id) : null;
    const [ws] = await tx.insert(workspaces).values({ name: clean, billingWorkspaceId }).returning({ id: workspaces.id, name: workspaces.name });
    await tx.insert(memberships).values({ userId, workspaceId: ws!.id, role: "owner" });
    if (!billingWorkspaceId) await tx.insert(creditLedger).values({ workspaceId: ws!.id, delta: freeTierCredits, reason: "free_tier" });
    return { id: ws!.id, name: ws!.name, role: "owner" as const };
  });
}

/** Renames a workspace. Owners only. */
export async function renameWorkspace(db: Db, userId: string, workspaceId: string, name: string) {
  const clean = cleanName(name);
  const role = await membership(db, userId, workspaceId);
  if (!role) throw new WorkspaceError("Workspace not found.", 404);
  if (role !== "owner") throw new WorkspaceError("Only the workspace's owner can rename it.", 403);
  await db.update(workspaces).set({ name: clean }).where(eq(workspaces.id, workspaceId));
  return { id: workspaceId, name: clean, role };
}

/** What a request is authenticated with, for switching: a dashboard session or an app's OAuth grant. */
export type SwitchableCredential = { kind: "session"; id: string } | { kind: "oauth"; id: string };

/**
 * Points one session or one app connection at another of the person's workspaces. Only that credential moves, so
 * switching brand in one agent or tab doesn't move another.
 */
export async function switchWorkspace(db: Db, userId: string, credential: SwitchableCredential, workspaceId: string) {
  const role = await membership(db, userId, workspaceId);
  const [ws] = role ? await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId)) : [];
  if (!ws || !role) throw new WorkspaceError("Workspace not found, or you aren't a member of it.", 404);
  if (credential.kind === "session") {
    await db.update(sessions).set({ workspaceId }).where(and(eq(sessions.id, credential.id), eq(sessions.userId, userId)));
  } else {
    await db.update(oauthGrants).set({ workspaceId }).where(and(eq(oauthGrants.id, credential.id), eq(oauthGrants.userId, userId)));
  }
  return { id: ws.id, name: ws.name, role };
}
