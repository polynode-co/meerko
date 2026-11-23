import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, gte, isNull, memberships, ne, reviewerLinks, reviewerLinkUses, sessions, sql, users, type Db, type ReviewerLinkOutcome } from "@meerko/db";
import { createSession, normalizeEmail } from "./auth.ts";

const PREFIX = "mr_";
const TOKEN_BYTES = 32;
/** Per IP, every attempt counted, right or wrong. Several reviewers can share an office address. */
const ATTEMPTS_PER_IP = 20;
const ATTEMPT_WINDOW_MS = 10 * 60_000;
/** Past this many failed attempts an hour, across all IPs, further failures aren't logged: the log can't be flooded. */
const FAILURES_LOGGED_PER_HOUR = 1000;
export const REVIEWER_LINK_MAX_DAYS = 365;

/** Why a link couldn't be created or revoked. The message is for the maintainer running the script. */
export class ReviewerLinkError extends Error {}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const firstWorkspace = async (db: Db, userId: string) => {
  const [m] = await db.select({ workspaceId: memberships.workspaceId }).from(memberships).where(eq(memberships.userId, userId)).orderBy(asc(memberships.createdAt)).limit(1);
  return m?.workspaceId ?? null;
};

const userByEmail = async (db: Db, email: string) => {
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, normalizeEmail(email)));
  if (!user) throw new ReviewerLinkError(`No user ${normalizeEmail(email)}: sign in as the reviewer once first.`);
  return user;
};

const active = (userId: string) => and(eq(reviewerLinks.userId, userId), isNull(reviewerLinks.revokedAt), gt(reviewerLinks.expiresAt, new Date()));

/**
 * A new sign-in link for the user with this email, valid for `days`. Returns the token, which is stored only as
 * a hash and can't be shown again. Links the user already has keep working (`others` counts them).
 */
export async function createReviewerLink(db: Db, email: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > REVIEWER_LINK_MAX_DAYS) throw new ReviewerLinkError(`--days must be a whole number from 1 to ${REVIEWER_LINK_MAX_DAYS}.`);
  const user = await userByEmail(db, email);
  if (!(await firstWorkspace(db, user.id))) throw new ReviewerLinkError(`${user.email} has no workspace to sign in to.`);
  const [{ n: others } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(reviewerLinks).where(active(user.id));
  const token = PREFIX + randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60_000);
  await db.insert(reviewerLinks).values({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt, email: user.email, others };
}

/**
 * Revokes every link of the user with this email that still works. `signOut` also ends that user's dashboard
 * sessions, whichever way they were started; apps they approved keep their own access until disconnected.
 */
export async function revokeReviewerLinks(db: Db, email: string, opts: { signOut?: boolean } = {}) {
  const user = await userByEmail(db, email);
  const revoked = await db.update(reviewerLinks).set({ revokedAt: new Date() }).where(active(user.id)).returning({ id: reviewerLinks.id });
  const ended = opts.signOut ? await db.delete(sessions).where(eq(sessions.userId, user.id)).returning({ id: sessions.id }) : [];
  return { email: user.email, revoked: revoked.length, sessionsEnded: ended.length };
}

export type ReviewerLinkResult =
  | { status: "signed_in"; session: { token: string; expiresAt: Date }; userId: string; workspaceId: string; email: string }
  /** Wrong, expired or revoked: the caller must not say which. */
  | { status: "invalid" }
  | { status: "rate_limited" };

/**
 * Uses a reviewer link: a dashboard session for the link's user, like any other sign-in. The link stays good for
 * more sign-ins. Every attempt is logged with its IP and user agent, never the token.
 */
export async function redeemReviewerLink(db: Db, token: string, from: { ip: string; userAgent?: string | null }): Promise<ReviewerLinkResult> {
  const ip = from.ip.trim().slice(0, 64) || "unknown";
  const [{ n: attempts } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviewerLinkUses)
    .where(and(eq(reviewerLinkUses.ip, ip), gte(reviewerLinkUses.createdAt, new Date(Date.now() - ATTEMPT_WINDOW_MS))));
  if (attempts >= ATTEMPTS_PER_IP) return { status: "rate_limited" };

  const [link] = token.startsWith(PREFIX)
    ? await db
        .select({ id: reviewerLinks.id, userId: reviewerLinks.userId, expiresAt: reviewerLinks.expiresAt, revokedAt: reviewerLinks.revokedAt, email: users.email })
        .from(reviewerLinks)
        .innerJoin(users, eq(users.id, reviewerLinks.userId))
        .where(eq(reviewerLinks.tokenHash, hashToken(token)))
    : [];
  const workspaceId = link && !link.revokedAt && link.expiresAt > new Date() ? await firstWorkspace(db, link.userId) : null;
  const outcome: ReviewerLinkOutcome = !link ? "unknown" : link.revokedAt ? "revoked" : link.expiresAt <= new Date() ? "expired" : workspaceId ? "signed_in" : "no_workspace";

  const log = () => db.insert(reviewerLinkUses).values({ linkId: link?.id ?? null, outcome, ip, userAgent: from.userAgent?.slice(0, 500) || null });
  if (outcome !== "signed_in" || !link || !workspaceId) {
    const [{ n: failures } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reviewerLinkUses)
      .where(and(ne(reviewerLinkUses.outcome, "signed_in"), gte(reviewerLinkUses.createdAt, new Date(Date.now() - 60 * 60_000))));
    if (failures < FAILURES_LOGGED_PER_HOUR) await log();
    return { status: "invalid" };
  }
  await log();
  await db.update(reviewerLinks).set({ lastUsedAt: new Date() }).where(eq(reviewerLinks.id, link.id));
  const session = await createSession(db, link.userId, workspaceId);
  return { status: "signed_in", session, userId: link.userId, workspaceId, email: link.email };
}

/**
 * The visitor's address from an `X-Forwarded-For` header. Each proxy appends the address it heard from, so the
 * ones on the left are whatever the visitor chose to send. Behind a Google Cloud load balancer the header ends
 * `<visitor>, <load balancer>`; behind one reverse proxy, or none, the last entry is the visitor.
 */
export function clientIpFromForwarded(header: string | null | undefined) {
  const hops = (header ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return hops.at(hops.length >= 2 ? -2 : -1) ?? "unknown";
}
