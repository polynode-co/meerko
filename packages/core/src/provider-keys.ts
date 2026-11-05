import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { and, eq, providerKeys, sql, type Db } from "@meerko/db";

export const BYOK_PROVIDERS = ["icypeas", "firecrawl", "generect"] as const;
export type ByokProvider = (typeof BYOK_PROVIDERS)[number];

export class EncryptionNotConfiguredError extends Error {
  constructor() {
    super("Set MEERKO_ENCRYPTION_KEY (32 random bytes, base64) to store provider keys");
  }
}

/** AES-256-GCM. Stored as base64 of iv(12) | tag(16) | ciphertext. */
export class SecretBox {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) throw new Error("MEERKO_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }

  static fromEnv(): SecretBox | null {
    const key = process.env.MEERKO_ENCRYPTION_KEY;
    return key ? new SecretBox(key) : null;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
  }

  decrypt(stored: string): string {
    const buf = Buffer.from(stored, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  }
}

export async function setProviderKey(db: Db, box: SecretBox | null, workspaceId: string, provider: ByokProvider, key: string) {
  if (!box) throw new EncryptionNotConfiguredError();
  const values = { workspaceId, provider, encryptedKey: box.encrypt(key), last4: key.slice(-4) };
  await db
    .insert(providerKeys)
    .values(values)
    .onConflictDoUpdate({
      target: [providerKeys.workspaceId, providerKeys.provider],
      set: { encryptedKey: values.encryptedKey, last4: values.last4, createdAt: sql`now()` },
    });
}

export async function deleteProviderKey(db: Db, workspaceId: string, provider: ByokProvider) {
  const res = await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.workspaceId, workspaceId), eq(providerKeys.provider, provider)))
    .returning({ id: providerKeys.id });
  return res.length > 0;
}

/** Keys are never returned, only which providers are set and their last 4 characters. */
export async function listProviderKeys(db: Db, workspaceId: string) {
  return db
    .select({ provider: providerKeys.provider, last4: providerKeys.last4, createdAt: providerKeys.createdAt })
    .from(providerKeys)
    .where(eq(providerKeys.workspaceId, workspaceId));
}

export async function getProviderKey(db: Db, box: SecretBox | null, workspaceId: string, provider: ByokProvider) {
  const [row] = await db
    .select({ encryptedKey: providerKeys.encryptedKey })
    .from(providerKeys)
    .where(and(eq(providerKeys.workspaceId, workspaceId), eq(providerKeys.provider, provider)));
  if (!row) return null;
  if (!box) throw new EncryptionNotConfiguredError();
  return box.decrypt(row.encryptedKey);
}
