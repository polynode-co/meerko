import { OutlookClient, type MicrosoftOAuth } from "./mail/outlook.ts";
import { randomBytes } from "node:crypto";
import { and, eq, mailboxes, sequenceMailboxes, sequences, sql, type Db, type MailboxServers } from "@meerko/db";
import { mailClient } from "./mail/client.ts";
import { GmailClient, GmailError, type GoogleOAuth } from "./mail/gmail.ts";
import { GmailImapClient } from "./mail/gmail-imap.ts";
import { ImapClient } from "./mail/imap.ts";
import type { ImapConnectors } from "./mail/imap-common.ts";
import { buildMime } from "./mail/mime.ts";
import { EncryptionNotConfiguredError, type SecretBox } from "./provider-keys.ts";
import { domainHealthFor } from "./mail/domain-health.ts";
import { rampState } from "./sending/ramp.ts";
import { assertMailboxAllowed } from "./billing.ts";
import { NotFoundError } from "./tables.ts";

const STATE_TTL_MS = 10 * 60_000;

/** The OAuth callback's `state` is forged, corrupted or expired. */
export class OAuthStateError extends Error {}

/**
 * OAuth `state`: the workspace id, encrypted and authenticated, so the public callback can trust it.
 * `returnTo` (already validated by the caller) is where the callback sends the browser afterwards. `actorId` is who
 * started the connect, so the callback's analytics land on that person rather than on the workspace.
 */
export function createOAuthState(box: SecretBox | null, workspaceId: string, returnTo?: string, actorId?: string) {
  if (!box) throw new EncryptionNotConfiguredError();
  const payload = JSON.stringify({ w: workspaceId, exp: Date.now() + STATE_TTL_MS, n: randomBytes(8).toString("hex"), r: returnTo, a: actorId });
  return Buffer.from(box.encrypt(payload), "base64").toString("base64url");
}

function decodeOAuthState(box: SecretBox, state: string): { w: string; exp: number; r?: string; a?: string } | null {
  try {
    return JSON.parse(box.decrypt(Buffer.from(state, "base64url").toString("base64")));
  } catch {
    return null;
  }
}

export function readOAuthState(box: SecretBox | null, state: string): string {
  if (!box) throw new EncryptionNotConfiguredError();
  const payload = decodeOAuthState(box, state);
  if (!payload) throw new OAuthStateError("Invalid sign-in link. Start again with `meerko mailboxes connect --google`.");
  if (payload.exp < Date.now()) throw new OAuthStateError("This sign-in link expired. Start again with `meerko mailboxes connect --google`.");
  return payload.w;
}

/** Who started the connect, from a genuine `state`; undefined for states made before it was recorded. */
export function readOAuthActor(box: SecretBox | null, state: string): string | undefined {
  return (box && decodeOAuthState(box, state)?.a) || undefined;
}

/** The return URL carried in a genuine `state`, even an expired one (so the user still lands back in the app). */
export function readOAuthReturnTo(box: SecretBox | null, state: string): string | undefined {
  return (box && decodeOAuthState(box, state)?.r) || undefined;
}

/** Completes the OAuth callback: exchanges the code, reads the address and stores (or reconnects) the mailbox. */
export async function connectGmail(
  db: Db,
  box: SecretBox | null,
  oauth: GoogleOAuth,
  state: string,
  code: string,
  fetchImpl?: typeof fetch,
  /** Meerko Cloud caps mailboxes by plan; self-hosted installs don't. */
  opts: { enforcePlan?: boolean } = {},
) {
  const workspaceId = readOAuthState(box, state);
  const { refreshToken } = await oauth.exchangeCode(code);
  const { emailAddress } = await new GmailClient(oauth, refreshToken, fetchImpl).profile();
  if (opts.enforcePlan) await assertMailboxAllowed(db, workspaceId, emailAddress);
  const encryptedRefreshToken = box!.encrypt(refreshToken);
  const [mailbox] = await db
    .insert(mailboxes)
    // A new mailbox ramps up from a few emails a day; reconnecting an existing one doesn't restart it.
    .values({ workspaceId, provider: "gmail", email: emailAddress.toLowerCase(), encryptedRefreshToken, rampStartedAt: new Date() })
    .onConflictDoUpdate({
      target: [mailboxes.workspaceId, mailboxes.email],
      // Reconnecting heals a mailbox that lost access (and moves an app-password mailbox to the API).
      set: { provider: "gmail", login: null, servers: null, encryptedRefreshToken, encryptedPassword: null, status: "active", lastError: null },
    })
    .returning({ id: mailboxes.id, email: mailboxes.email, workspaceId: mailboxes.workspaceId });
  return mailbox!;
}

/**
 * Completes Microsoft's sign-in callback: exchanges the code, reads the address and stores (or reconnects)
 * an Outlook / Microsoft 365 mailbox. Reconnecting an address that's already a mailbox moves it to Outlook.
 */
export async function connectOutlook(
  db: Db,
  box: SecretBox | null,
  oauth: MicrosoftOAuth,
  state: string,
  code: string,
  fetchImpl?: typeof fetch,
  opts: { enforcePlan?: boolean } = {},
) {
  const workspaceId = readOAuthState(box, state);
  const { refreshToken } = await oauth.exchangeCode(code);
  const client = new OutlookClient(oauth, refreshToken, { fetch: fetchImpl });
  const { emailAddress } = await client.profile();
  // Signing in works for any Microsoft account, but sending needs a mailbox: refuse now rather than fail later.
  await client.assertMailbox();
  if (opts.enforcePlan) await assertMailboxAllowed(db, workspaceId, emailAddress);
  const credential = { provider: "outlook" as const, login: null, servers: null, encryptedRefreshToken: box!.encrypt(refreshToken), encryptedPassword: null };
  const [mailbox] = await db
    .insert(mailboxes)
    .values({ workspaceId, email: emailAddress, ...credential, rampStartedAt: new Date() })
    .onConflictDoUpdate({ target: [mailboxes.workspaceId, mailboxes.email], set: { ...credential, status: "active", lastError: null } })
    .returning({ id: mailboxes.id, email: mailboxes.email, workspaceId: mailboxes.workspaceId });
  return mailbox!;
}

const publicColumns = {
  id: mailboxes.id,
  provider: mailboxes.provider,
  email: mailboxes.email,
  login: mailboxes.login,
  servers: mailboxes.servers,
  displayName: mailboxes.displayName,
  dailyLimit: mailboxes.dailyLimit,
  rampStartedAt: mailboxes.rampStartedAt,
  status: mailboxes.status,
  lastError: mailboxes.lastError,
  createdAt: mailboxes.createdAt,
};

/** Adds today's limit (lower while ramping) and the ramp day. */
const withRamp = <T extends { dailyLimit: number; rampStartedAt: Date | null }>(m: T, now = new Date()) => ({ ...m, ...rampState(m, now) });

/** The app password was rejected, or the account can't be used over IMAP and SMTP. The message says what to fix. */
export class MailboxConnectError extends Error {}

export const APP_PASSWORDS_URL = "https://myaccount.google.com/apppasswords";

/**
 * Connects a Gmail or Google Workspace inbox with an app password (IMAP and SMTP, no Gmail API scopes).
 * Signs in to Gmail first, so nothing is stored unless the password works. Connecting an address that's
 * already a mailbox replaces its credential, which also moves a Gmail API mailbox over.
 */
export async function connectGmailAppPassword(
  db: Db,
  box: SecretBox | null,
  workspaceId: string,
  input: { email: string; password: string; login?: string | null; displayName?: string | null },
  opts: { enforcePlan?: boolean; imap?: ImapConnectors } = {},
) {
  if (!box) throw new EncryptionNotConfiguredError();
  const email = input.email.trim().toLowerCase();
  const login = input.login?.trim().toLowerCase() || email;
  // Google shows it as four groups of four letters.
  const password = input.password.replace(/\s+/g, "");
  if (!/^[a-z]{16}$/i.test(password)) {
    throw new MailboxConnectError(`An app password is 16 letters. Create one at ${APP_PASSWORDS_URL}: your normal Google password won't work here.`);
  }
  if (opts.enforcePlan) await assertMailboxAllowed(db, workspaceId, email);

  const client = new GmailImapClient({ email, login, password }, opts.imap);
  try {
    await client.verify();
  } catch (err) {
    if (!(err instanceof GmailError)) throw err;
    if (err.status === 534) throw new MailboxConnectError(`Google wants an app password, not your account password. Create one at ${APP_PASSWORDS_URL}.`);
    if (err.status === 535) {
      const alias = login === email ? ` If ${email} is an alias, also give the Google account you sign in with.` : "";
      throw new MailboxConnectError(`Gmail didn't accept that app password for ${login}. Check you copied all 16 letters and that 2-Step Verification is on.${alias}`);
    }
    throw new MailboxConnectError(err.message);
  } finally {
    await client.close();
  }

  return savePasswordMailbox(db, box, workspaceId, { provider: "gmail_imap", email, login, password, displayName: input.displayName, servers: null });
}

/**
 * Connects any provider's inbox over IMAP and SMTP (Zoho, Fastmail, a host's mail server) with its password
 * or app password. The servers must be public, on TLS ports; Meerko signs in to both before storing anything.
 */
export async function connectImapMailbox(
  db: Db,
  box: SecretBox | null,
  workspaceId: string,
  input: { email: string; password: string; login?: string | null; displayName?: string | null; servers: MailboxServers },
  opts: { enforcePlan?: boolean; imap?: ImapConnectors } = {},
) {
  if (!box) throw new EncryptionNotConfiguredError();
  const email = input.email.trim().toLowerCase();
  const login = input.login?.trim() || email;
  const servers: MailboxServers = {
    imap: { host: input.servers.imap.host.trim().toLowerCase(), port: input.servers.imap.port },
    smtp: { host: input.servers.smtp.host.trim().toLowerCase(), port: input.servers.smtp.port },
  };
  if (opts.enforcePlan) await assertMailboxAllowed(db, workspaceId, email);

  const client = new ImapClient({ email, login, password: input.password, servers }, opts.imap);
  try {
    await client.verify();
  } catch (err) {
    if (!(err instanceof GmailError)) throw err;
    if (err.needsReconnect && (err.status === 535 || /didn't accept the password/.test(err.message))) {
      throw new MailboxConnectError(
        `${servers.imap.host} didn't accept the password for ${login}. Check it, and whether your provider wants an app password or needs IMAP turned on.`,
      );
    }
    throw new MailboxConnectError(err.message);
  } finally {
    await client.close();
  }
  return savePasswordMailbox(db, box, workspaceId, { provider: "imap", email, login, password: input.password, displayName: input.displayName, servers });
}

/** Stores a password-based mailbox. Reconnecting the same address heals it, keeps its ramp and replaces its credential. */
async function savePasswordMailbox(
  db: Db,
  box: SecretBox,
  workspaceId: string,
  m: { provider: "gmail_imap" | "imap"; email: string; login: string; password: string; displayName?: string | null; servers: MailboxServers | null },
) {
  const credential = {
    provider: m.provider,
    login: m.login.toLowerCase() === m.email ? null : m.login,
    encryptedPassword: box.encrypt(m.password),
    encryptedRefreshToken: null,
    servers: m.servers,
  };
  const displayName = m.displayName?.trim() || undefined;
  const [mailbox] = await db
    .insert(mailboxes)
    .values({ workspaceId, email: m.email, displayName, ...credential, rampStartedAt: new Date() })
    .onConflictDoUpdate({
      target: [mailboxes.workspaceId, mailboxes.email],
      set: { ...credential, ...(displayName ? { displayName } : {}), status: "active", lastError: null },
    })
    .returning(publicColumns);
  return withRamp(mailbox!);
}


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
  // Only this workspace's mailbox: the pool clean-up below must never touch another workspace's sequences.
  const [own] = await db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, id)));
  if (!own) return false;
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

/** Records a lost connection so the user is told to reconnect, and sending skips the mailbox. */
export async function markMailboxError(db: Db, id: string, error: string) {
  await db.update(mailboxes).set({ status: "error", lastError: error }).where(eq(mailboxes.id, id));
}

/** Sends a one-off test email, proving the connection works end to end. */
export async function sendTestEmail(
  db: Db,
  workspaceId: string,
  id: string,
  to: string,
  deps: { box: SecretBox | null; oauth?: GoogleOAuth; microsoft?: MicrosoftOAuth; fetch?: typeof fetch; imap?: ImapConnectors },
) {
  const [mailbox] = await db
    .select()
    .from(mailboxes)
    .where(and(eq(mailboxes.workspaceId, workspaceId), eq(mailboxes.id, id)));
  if (!mailbox) throw new NotFoundError(`Mailbox ${id} not found`);
  if (!deps.box) throw new EncryptionNotConfiguredError();
  const { raw, messageId } = buildMime({
    from: { email: mailbox.email, name: mailbox.displayName },
    to,
    subject: "Meerko test email",
    text: `This test email was sent through Meerko from ${mailbox.email}.\n\nIf you can read it, the mailbox is connected.`,
  });
  try {
    const client = mailClient(mailbox, { box: deps.box, oauth: deps.oauth, microsoft: deps.microsoft, fetch: deps.fetch, imap: deps.imap, db });
    try {
      return await client.send({ raw, messageId, from: mailbox.email, to });
    } finally {
      await client.close();
    }
  } catch (err) {
    if ((err as { needsReconnect?: boolean }).needsReconnect) await markMailboxError(db, id, (err as Error).message);
    throw err;
  }
}
