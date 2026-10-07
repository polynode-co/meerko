import { randomBytes } from "node:crypto";
import { and, eq, mailboxes, sequenceMailboxes, sequences, sql, type Db } from "@meerko/db";
import { GmailClient, type GoogleOAuth } from "./mail/gmail.ts";
import { buildMime } from "./mail/mime.ts";
import { EncryptionNotConfiguredError, type SecretBox } from "./provider-keys.ts";
import { domainHealthFor } from "./mail/domain-health.ts";
import { rampState } from "./sending/ramp.ts";
import { NotFoundError } from "./tables.ts";

const STATE_TTL_MS = 10 * 60_000;

/** The OAuth callback's `state` is forged, corrupted or expired. */
export class OAuthStateError extends Error {}

/**
 * OAuth `state`: the workspace id, encrypted and authenticated, so the public callback can trust it.
 * `returnTo` (already validated by the caller) is where the callback sends the browser afterwards.
 */
export function createOAuthState(box: SecretBox | null, workspaceId: string, returnTo?: string) {
  if (!box) throw new EncryptionNotConfiguredError();
  const payload = JSON.stringify({ w: workspaceId, exp: Date.now() + STATE_TTL_MS, n: randomBytes(8).toString("hex"), r: returnTo });
  return Buffer.from(box.encrypt(payload), "base64").toString("base64url");
}

function decodeOAuthState(box: SecretBox, state: string): { w: string; exp: number; r?: string } | null {
  try {
    return JSON.parse(box.decrypt(Buffer.from(state, "base64url").toString("base64")));
  } catch {
    return null;
  }
}

export function readOAuthState(box: SecretBox | null, state: string): string {
  if (!box) throw new EncryptionNotConfiguredError();
  const payload = decodeOAuthState(box, state);
  if (!payload) throw new OAuthStateError("Invalid sign-in link. Start again with `meerko mailboxes connect`.");
  if (payload.exp < Date.now()) throw new OAuthStateError("This sign-in link expired. Start again with `meerko mailboxes connect`.");
  return payload.w;
}

/** The return URL carried in a genuine `state`, even an expired one (so the user still lands back in the app). */
export function readOAuthReturnTo(box: SecretBox | null, state: string): string | undefined {
  return (box && decodeOAuthState(box, state)?.r) || undefined;
}

/** Completes the OAuth callback: exchanges the code, reads the address and stores (or reconnects) the mailbox. */
export async function connectGmail(db: Db, box: SecretBox | null, oauth: GoogleOAuth, state: string, code: string, fetchImpl?: typeof fetch) {
  const workspaceId = readOAuthState(box, state);
  const { refreshToken } = await oauth.exchangeCode(code);
  const { emailAddress } = await new GmailClient(oauth, refreshToken, fetchImpl).profile();
  const encryptedRefreshToken = box!.encrypt(refreshToken);
  const [mailbox] = await db
    .insert(mailboxes)
    // A new mailbox ramps up from a few emails a day; reconnecting an existing one doesn't restart it.
    .values({ workspaceId, provider: "gmail", email: emailAddress.toLowerCase(), encryptedRefreshToken, rampStartedAt: new Date() })
    .onConflictDoUpdate({
      target: [mailboxes.workspaceId, mailboxes.email],
      // Reconnecting heals a mailbox that lost access.
      set: { encryptedRefreshToken, status: "active", lastError: null },
    })
    .returning({ id: mailboxes.id, email: mailboxes.email });
  return mailbox!;
}

const publicColumns = {
  id: mailboxes.id,
  provider: mailboxes.provider,
  email: mailboxes.email,
  displayName: mailboxes.displayName,
  dailyLimit: mailboxes.dailyLimit,
  rampStartedAt: mailboxes.rampStartedAt,
  status: mailboxes.status,
  lastError: mailboxes.lastError,
  createdAt: mailboxes.createdAt,
};

/** Adds today's limit (lower while ramping) and the ramp day. */
const withRamp = <T extends { dailyLimit: number; rampStartedAt: Date | null }>(m: T, now = new Date()) => ({ ...m, ...rampState(m, now) });

export async function listMailboxes(db: Db, workspaceId: string) {
  const rows = await db.select(publicColumns).from(mailboxes).where(eq(mailboxes.workspaceId, workspaceId)).orderBy(mailboxes.createdAt);
  return rows.map((m) => withRamp(m));
}

/** SPF, DKIM and DMARC for each domain the workspace sends from. */
export async function mailboxDomainHealth(db: Db, workspaceId: string) {
  const rows = await db.select({ email: mailboxes.email }).from(mailboxes).where(eq(mailboxes.workspaceId, workspaceId));
  return domainHealthFor(rows.map((r) => r.email.split("@")[1]!));
}

export async function updateMailbox(
  db: Db,
  workspaceId: string,
  id: string,
  patch: { dailyLimit?: number; displayName?: string | null; ramp?: boolean },
) {
  const { ramp, ...fields } = patch;
  const [row] = await db
    .update(mailboxes)
    // Turning the ramp on starts it over from today; off sends at the full limit straight away.
    .set({ ...fields, ...(ramp === undefined ? {} : { rampStartedAt: ramp ? new Date() : null }) })
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, id)))
    .returning(publicColumns);
  if (!row) throw new NotFoundError(`Mailbox ${id} not found`);
  return withRamp(row);
}

/** A mailbox can't be removed while it's the only one a sequence sends from. */
export class MailboxInUseError extends Error {}

export async function deleteMailbox(db: Db, workspaceId: string, id: string) {
  const onlySender = await db
    .select({ name: sequences.name })
    .from(sequenceMailboxes)
    .innerJoin(sequences, eq(sequenceMailboxes.sequenceId, sequences.id))
    .where(
      and(
        eq(sequenceMailboxes.mailboxId, id),
        sql`(select count(*) from ${sequenceMailboxes} sm where sm.sequence_id = ${sequenceMailboxes.sequenceId}) = 1`,
      ),
    );
  if (onlySender.length) {
    throw new MailboxInUseError(`This mailbox is the only one sending ${onlySender.map((s) => `"${s.name}"`).join(", ")}. Add another mailbox to the pool first.`);
  }
  // Leaving other pools: leads that haven't been emailed yet move to the pool's other mailboxes when the
  // sequence next enrolls or sends; leads mid-thread keep their history but stop (their mailbox is gone).
  await db.delete(sequenceMailboxes).where(eq(sequenceMailboxes.mailboxId, id));
  const res = await db
    .delete(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, id)))
    .returning({ id: mailboxes.id });
  return res.length > 0;
}

/** A Gmail client for a stored mailbox. */
export async function mailboxClient(db: Db, box: SecretBox | null, oauth: GoogleOAuth, workspaceId: string, id: string, fetchImpl?: typeof fetch) {
  const [row] = await db
    .select()
    .from(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, id)));
  if (!row) throw new NotFoundError(`Mailbox ${id} not found`);
  if (!box) throw new EncryptionNotConfiguredError();
  return { mailbox: row, gmail: new GmailClient(oauth, box.decrypt(row.encryptedRefreshToken), fetchImpl) };
}

/** Records a lost connection so the user is told to reconnect, and sending skips the mailbox. */
export async function markMailboxError(db: Db, id: string, error: string) {
  await db.update(mailboxes).set({ status: "error", lastError: error }).where(eq(mailboxes.id, id));
}

/** Sends a one-off test email, proving the connection works end to end. */
export async function sendTestEmail(
  db: Db,
  box: SecretBox | null,
  oauth: GoogleOAuth,
  workspaceId: string,
  id: string,
  to: string,
  fetchImpl?: typeof fetch,
) {
  const { mailbox, gmail } = await mailboxClient(db, box, oauth, workspaceId, id, fetchImpl);
  const { raw } = buildMime({
    from: { email: mailbox.email, name: mailbox.displayName },
    to,
    subject: "Meerko test email",
    text: `This test email was sent through Meerko from ${mailbox.email}.\n\nIf you can read it, the mailbox is connected.`,
  });
  try {
    return await gmail.send(raw);
  } catch (err) {
    if ((err as { needsReconnect?: boolean }).needsReconnect) await markMailboxError(db, id, (err as Error).message);
    throw err;
  }
}
