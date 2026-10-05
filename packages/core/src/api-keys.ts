import { createHash, randomBytes } from "node:crypto";
import { apiKeys, eq, workspaces, type Db } from "@meerko/db";

const KEY_PREFIX = "mk_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(db: Db, workspaceId: string, name: string) {
  const key = KEY_PREFIX + randomBytes(24).toString("base64url");
  const [row] = await db
    .insert(apiKeys)
    .values({ workspaceId, name, keyHash: hashApiKey(key), prefix: key.slice(0, 8) })
    .returning({ id: apiKeys.id });
  return { id: row!.id, key };
}

/** Resolves a raw API key to its workspace, or null if the key is unknown. */
export async function verifyApiKey(db: Db, key: string) {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const [row] = await db
    .select({ keyId: apiKeys.id, workspaceId: workspaces.id, workspaceName: workspaces.name })
    .from(apiKeys)
    .innerJoin(workspaces, eq(apiKeys.workspaceId, workspaces.id))
    .where(eq(apiKeys.keyHash, hashApiKey(key)));
  if (!row) return null;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.keyId));
  return row;
}
