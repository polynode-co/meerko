import { createHash, randomBytes } from "node:crypto";
import { and, asc, authCodes, creditLedger, emailSignIns, eq, gte, invitations, lte, memberships, sessions, sql, users, workspaces, type Db, type Role } from "@meerko/db";
import { FREE_TIER_CREDITS } from "./credits.ts";
import type { GoogleProfile } from "./mail/gmail.ts";

const SESSION_PREFIX = "ms_";
const CODE_PREFIX = "mc_";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const CODE_TTL_MS = 60_000;
const EMAIL_LINK_PREFIX = "ml_";
const EMAIL_LINK_TTL_MS = 15 * 60_000;
const TOUCH_EVERY_MS = 60 * 60_000;

/** `open`: any Google account gets a workspace. `invite`: only emails with an invitation can sign in. */
export type SignupMode = "open" | "invite";

/** Sign-in refused (not invited, unverified email). The message is safe to show the user. */
export class SignInError extends Error {}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Finds or creates the user behind a Google sign-in, claims their invitations and, for a first
 * sign-in with signup open, creates their workspace. Returns the workspace the session acts on, and
 * whether this sign-in created the user.
 */
export async function signInWithGoogle(db: Db, profile: GoogleProfile, signup: SignupMode) {
  // Invitations are matched by email, so only an address Google has verified may claim them.
  if (!profile.emailVerified) throw new SignInError("Your Google account's email isn't verified.");
  return signInVerified(db, { sub: profile.sub, email: profile.email, name: profile.name }, signup);
}

/**
 * Finds or creates the user behind an email address they just proved they own (a sign-in link), then does
 * what Google sign-in does. Matched by email, so someone who signed up with Google can use a link too.
 */
export async function signInWithEmail(db: Db, email: string, signup: SignupMode) {
  return signInVerified(db, { email: normalizeEmail(email) }, signup);
}

/** The shared half of every sign-in: `email` is verified by the caller (Google, or a link sent to it). */
async function signInVerified(db: Db, profile: { sub?: string; email: string; name?: string }, signup: SignupMode) {
  return db.transaction(async (tx) => {
    const [bySub] = profile.sub ? await tx.select().from(users).where(eq(users.googleSub, profile.sub)) : [];
    const [byEmail] = bySub ? [] : await tx.select().from(users).where(eq(users.email, profile.email));
    let user = bySub ?? byEmail;
    const newUser = !user;
    if (user) {
      // A recreated Google account keeps its Meerko user; a changed address or name is picked up.
      [user] = await tx
        .update(users)
        .set({ googleSub: profile.sub ?? user.googleSub, email: profile.email, name: profile.name ?? user.name })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      [user] = await tx.insert(users).values({ googleSub: profile.sub ?? null, email: profile.email, name: profile.name }).returning();
    }

    const invites = await tx.delete(invitations).where(eq(invitations.email, profile.email)).returning();
    for (const inv of invites) {
      await tx.insert(memberships).values({ userId: user!.id, workspaceId: inv.workspaceId, role: inv.role }).onConflictDoNothing();
    }

    const [membership] = await tx
      .select({ workspaceId: memberships.workspaceId })
      .from(memberships)
      .where(eq(memberships.userId, user!.id))
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    if (membership) return { userId: user!.id, workspaceId: membership.workspaceId, newUser };

    // Throwing rolls back the new user row, so a refused stranger leaves nothing behind.
    if (signup === "invite") throw new SignInError(`${profile.email} hasn't been invited to Meerko yet.`);
    const [ws] = await tx
      .insert(workspaces)
      .values({ name: `${profile.name?.split(" ")[0] ?? profile.email.split("@")[0]}'s workspace` })
      .returning();
    await tx.insert(memberships).values({ userId: user!.id, workspaceId: ws!.id, role: "owner" });
    // The free tier the site promises; only counted when the server meters credits (MEERKO_CREDITS=on).
    await tx.insert(creditLedger).values({ workspaceId: ws!.id, delta: FREE_TIER_CREDITS, reason: "free_tier" });
    return { userId: user!.id, workspaceId: ws!.id, newUser };
  });
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Whether `email` could sign in with signup set to `invite`: they already have an account or an invitation. */
export async function mayJoin(db: Db, email: string) {
  const address = normalizeEmail(email);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, address)).limit(1);
  if (user) return true;
  const [invite] = await db.select({ email: invitations.email }).from(invitations).where(eq(invitations.email, address)).limit(1);
  return !!invite;
}

/** How many sign-in links went to `email` in the last `windowMs` (the API's per-address limit). */
export async function recentEmailSignIns(db: Db, email: string, windowMs: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emailSignIns)
    .where(and(eq(emailSignIns.email, normalizeEmail(email)), gte(emailSignIns.createdAt, new Date(Date.now() - windowMs))));
  return row?.n ?? 0;
}

/** A one-time token for a sign-in link to `email`, valid for 15 minutes. Only its hash is stored. */
export async function createEmailSignIn(db: Db, email: string, source: Record<string, string> = {}) {
  // Rows are kept a day past expiry so recentEmailSignIns can still count them.
  await db.delete(emailSignIns).where(lte(emailSignIns.expiresAt, new Date(Date.now() - 24 * 60 * 60_000)));
  const token = EMAIL_LINK_PREFIX + randomBytes(32).toString("base64url");
  await db.insert(emailSignIns).values({ tokenHash: hashToken(token), email: normalizeEmail(email), source, expiresAt: new Date(Date.now() + EMAIL_LINK_TTL_MS) });
  return token;
}

/** Uses up a sign-in link's token: the address it proves and the visit's source, or null if unknown, used or expired. */
export async function redeemEmailSignIn(db: Db, token: string) {
  if (!token.startsWith(EMAIL_LINK_PREFIX)) return null;
  // Expiring the row instead of deleting it keeps it counted by recentEmailSignIns.
  const [row] = await db
    .update(emailSignIns)
    .set({ expiresAt: new Date(0) })
    .where(and(eq(emailSignIns.tokenHash, hashToken(token)), gte(emailSignIns.expiresAt, new Date())))
    .returning();
  return row ? { email: row.email, source: row.source } : null;
}

/** A one-time code the OAuth callback hands to the web app (so the session token never sits in a URL). */
export async function createAuthCode(db: Db, userId: string, workspaceId: string) {
  await db.delete(authCodes).where(lte(authCodes.expiresAt, new Date()));
  const code = CODE_PREFIX + randomBytes(24).toString("base64url");
  await db.insert(authCodes).values({ codeHash: hashToken(code), userId, workspaceId, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return code;
}

/** Trades a one-time code for a new session; null if the code is unknown, used or expired. */
export async function exchangeAuthCode(db: Db, code: string) {
  if (!code.startsWith(CODE_PREFIX)) return null;
  const [row] = await db.delete(authCodes).where(eq(authCodes.codeHash, hashToken(code))).returning();
  if (!row || row.expiresAt <= new Date()) return null;
  return createSession(db, row.userId, row.workspaceId);
}

export async function createSession(db: Db, userId: string, workspaceId: string) {
  const token = SESSION_PREFIX + randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ userId, workspaceId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Resolves a session token to its user and workspace, or null if it's unknown, expired or the user left the workspace. */
export async function verifySession(db: Db, token: string) {
  if (!token.startsWith(SESSION_PREFIX)) return null;
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastUsedAt: sessions.lastUsedAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      role: memberships.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(workspaces, eq(sessions.workspaceId, workspaces.id))
    .innerJoin(memberships, and(eq(memberships.userId, sessions.userId), eq(memberships.workspaceId, sessions.workspaceId)))
    .where(eq(sessions.tokenHash, hashToken(token)));
  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, row.sessionId));
  }
  return row;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** Lets `email` into the workspace on their first Google sign-in (or adds them now if they've signed in before). */
export async function inviteToWorkspace(db: Db, workspaceId: string, email: string, role: Role = "member") {
  const address = email.trim().toLowerCase();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, address));
  if (user) {
    await db.insert(memberships).values({ userId: user.id, workspaceId, role }).onConflictDoNothing();
    return { email: address, status: "added" as const };
  }
  await db
    .insert(invitations)
    .values({ email: address, workspaceId, role })
    .onConflictDoUpdate({ target: [invitations.email, invitations.workspaceId], set: { role: sql`excluded.role` } });
  return { email: address, status: "invited" as const };
}
