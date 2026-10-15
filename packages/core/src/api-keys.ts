import { createHash, randomBytes } from "node:crypto";
import { and, apiKeys, desc, eq, workspaces, type ApiKeyScope, type Db } from "@meerko/db";
import { NotFoundError } from "./tables.ts";

const KEY_PREFIX = "mk_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * `replies` keys can only read replies, classify them and save drafts: for an agent woken by an agent hook, which
 * reads email from strangers and so must not be able to approve or send anything.
 */
export async function createApiKey(db: Db, workspaceId: string, name: string, scope: ApiKeyScope = "full") {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  const [row] = await db
    .insert(apiKeys)
    .values({ workspaceId, name, scope, keyHash: hashApiKey(key), prefix: key.slice(0, 8) })
    .returning({ id: apiKeys.id });
  return { id: row!.id, key };
}

/** Resolves a raw API key to its workspace, or null if the key is unknown. */
export async function verifyApiKey(db: Db, key: string) {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const [row] = await db
    .select({ keyId: apiKeys.id, workspaceId: workspaces.id, workspaceName: workspaces.name, scope: apiKeys.scope })
    .from(apiKeys)
    .innerJoin(workspaces, eq(apiKeys.workspaceId, workspaces.id))
    .where(eq(apiKeys.keyHash, hashApiKey(key)));
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.keyId));
  return row;
}

/** A workspace's keys, newest first. Only the prefix is kept, so keys can be told apart but not recovered. */
export async function listApiKeys(db: Db, workspaceId: string) {
  return db
    .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, scope: apiKeys.scope, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(eq(apiKeys.workspaceId, workspaceId))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(db: Db, workspaceId: string, id: string) {
  const deleted = await db.delete(apiKeys).where(and(eq(apiKeys.workspaceId, workspaceId), eq(apiKeys.id, id))).returning({ id: apiKeys.id });
  if (!deleted.length) throw new NotFoundError("API key not found");
}
