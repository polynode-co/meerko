import { createHash } from "node:crypto";
import { asc, workspaces, type Db } from "@meerko/db";

/**
 * Opt-in install count for self-hosted Meerko (MEERKO_TELEMETRY=1; off by default, see /docs/self-hosting#telemetry).
 * The worker sends one ping a day carrying only `install_id`: a SHA-256 of the install's first workspace id, so the
 * same install counts once and nothing about it can be read back. No leads, mail, users, hosts or counts are sent.
 */
export const TELEMETRY_URL = "https://api.meerko.ai/telemetry/ping";
export const TELEMETRY_EVERY_MS = 24 * 60 * 60 * 1000;

/** A hex SHA-256 is all the ping carries; the API rejects anything else. */
export const INSTALL_ID_RE = /^[0-9a-f]{64}$/;

export function telemetryEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.MEERKO_TELEMETRY === "1" || env.MEERKO_TELEMETRY === "true";
}

/** Stable for the life of the database; null before anyone has created a workspace (nothing to count yet). */
export async function installId(db: Db): Promise<string | null> {
  const [first] = await db.select({ id: workspaces.id }).from(workspaces).orderBy(asc(workspaces.createdAt)).limit(1);
  return first ? createHash("sha256").update(`meerko-install:${first.id}`).digest("hex") : null;
}

/** Sends the ping. Never throws: telemetry failing must not touch sending. Returns whether it went out. */
export async function sendTelemetryPing(db: Db, opts: { url?: string; fetch?: typeof fetch } = {}): Promise<boolean> {
  try {
    const id = await installId(db);
    if (!id) return false;
    const res = await (opts.fetch ?? fetch)(opts.url ?? TELEMETRY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ install_id: id }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
