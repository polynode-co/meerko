import { createHash, randomBytes } from "node:crypto";
import { and, asc, authCodes, creditLedger, eq, invitations, lte, memberships, sessions, sql, users, workspaces, type Db, type Role } from "@meerko/db";
import { FREE_TIER_CREDITS } from "./credits.ts";
import type { GoogleProfile } from "./mail/gmail.ts";

const SESSION_PREFIX = "ms_";
const CODE_PREFIX = "mc_";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const CODE_TTL_MS = 60_000;
const TOUCH_EVERY_MS = 60 * 60_000;

/** `open`: any Google account gets a workspace. `invite`: only emails with an invitation can sign in. */
export type SignupMode = "open" | "invite";

/** Sign-in refused (not invited, unverified email). The message is safe to show the user. */
export class SignInError extends Error {}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Finds or creates the user behind a Google sign-in, claims their invitations and, for a first
 * sign-in with signup open, creates their workspace. Returns the workspace the session acts on.
 */
export async function signInWithGoogle(db: Db, profile: GoogleProfile, signup: SignupMode) {
  // Invitations are matched by email, so only an address Google has verified may claim them.
  if (!profile.emailVerified) throw new SignInError("Your Google account's email isn't verified.");
  return db.transaction(async (tx) => {
    const [bySub] = await tx.select().from(users).where(eq(users.googleSub, profile.sub));
    const [byEmail] = bySub ? [] : await tx.select().from(users).where(eq(users.email, profile.email));
    let user = bySub ?? byEmail;
    if (user) {
      // A recreated Google account keeps its Meerko user; a changed address or name is picked up.
      [user] = await tx
        .update(users)
        .set({ googleSub: profile.sub, email: profile.email, name: profile.name ?? user.name })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      [user] = await tx.insert(users).values({ googleSub: profile.sub, email: profile.email, name: profile.name }).returning();
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
    if (membership) return { userId: user!.id, workspaceId: membership.workspaceId };

    // Throwing rolls back the new user row, so a refused stranger leaves nothing behind.
    if (signup === "invite") throw new SignInError(`${profile.email} hasn't been invited to Meerko yet.`);
    const [ws] = await tx
      .insert(workspaces)
      .values({ name: `${profile.name?.split(" ")[0] ?? profile.email.split("@")[0]}'s workspace` })
      .returning();
    await tx.insert(memberships).values({ userId: user!.id, workspaceId: ws!.id, role: "owner" });
    // The free tier the site promises; only counted when the server meters credits (MEERKO_CREDITS=on).
    await tx.insert(creditLedger).values({ workspaceId: ws!.id, delta: FREE_TIER_CREDITS, reason: "free_tier" });
    return { userId: user!.id, workspaceId: ws!.id };
  });
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
