import { and, asc, eq, invitations, memberships, ne, oauthGrants, sessions, users, workspaces, type Db, type Role } from "@meerko/db";
import { normalizeEmail } from "./auth.ts";

/** The request can't be done (no such member, several workspaces, the only owner). The message is safe to print. */
export class WorkspaceMemberError extends Error {}

/** The one workspace `memberEmail` belongs to. Refuses when there are none or several, so nothing is guessed. */
async function workspaceOf(db: Db, memberEmail: string) {
  const email = normalizeEmail(memberEmail);
  const found = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(users.email, email));
  if (found.length !== 1) {
    throw new WorkspaceMemberError(
      found.length ? `${email} is in ${found.length} workspaces; pass a member who is in only the one to share.` : `No user ${email} with a workspace.`,
    );
  }
  return found[0]!;
}

/**
 * Gives `newEmail` access to the only workspace of `memberEmail`, creating the user if they have never signed in:
 * the same row a first email sign-in creates (no Google id, no name). Signing in finds that user and their
 * membership, so it creates no workspace of their own, with signup open or by invitation. Safe to run again.
 */
export async function addWorkspaceMember(db: Db, memberEmail: string, newEmail: string, role: Role = "member") {
  const workspace = await workspaceOf(db, memberEmail);
  const email = normalizeEmail(newEmail);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    const [created] = existing ? [] : await tx.insert(users).values({ email }).returning({ id: users.id });
    const userId = (existing ?? created)!.id;

    const [added] = await tx.insert(memberships).values({ userId, workspaceId: workspace.id, role }).onConflictDoNothing().returning({ role: memberships.role });
    const [current] = added
      ? [added]
      : await tx
          .select({ role: memberships.role })
          .from(memberships)
          .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspace.id)));
    // A pending invitation to this workspace is now met; left behind, it would let them back in after a removal.
    await tx.delete(invitations).where(and(eq(invitations.email, email), eq(invitations.workspaceId, workspace.id)));

    // Sign-in acts on the oldest membership, which is another workspace when they already had one.
    const [first] = await tx
      .select({ id: workspaces.id, name: workspaces.name })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    return { email, workspace, userCreated: !!created, status: added ? ("added" as const) : ("already_member" as const), role: current!.role, signsInto: first! };
  });
}

/**
 * Takes `email` out of the only workspace of `memberEmail`: the membership, a pending invitation to it, and the
 * dashboard sessions and app connections they had on it. The user stays, and so do their other workspaces. Safe to
 * run again.
 */
export async function removeWorkspaceMember(db: Db, memberEmail: string, email: string) {
  const workspace = await workspaceOf(db, memberEmail);
  const address = normalizeEmail(email);
  if (address === normalizeEmail(memberEmail)) throw new WorkspaceMemberError("The two addresses are the same: name another member of the workspace first.");
  return db.transaction(async (tx) => {
    await tx.delete(invitations).where(and(eq(invitations.email, address), eq(invitations.workspaceId, workspace.id)));
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.email, address));
    const [membership] = user
      ? await tx
          .select({ role: memberships.role })
          .from(memberships)
          .where(and(eq(memberships.userId, user.id), eq(memberships.workspaceId, workspace.id)))
      : [];
    if (!user || !membership) return { email: address, workspace, status: "not_member" as const, workspacesLeft: 0 };

    if (membership.role === "owner") {
      const [other] = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(and(eq(memberships.workspaceId, workspace.id), eq(memberships.role, "owner"), ne(memberships.userId, user.id)))
        .limit(1);
      if (!other) throw new WorkspaceMemberError(`${address} is the only owner of ${workspace.name}; removing them would leave it without one.`);
    }
    const mine = <T extends typeof memberships | typeof sessions | typeof oauthGrants>(t: T) => and(eq(t.userId, user.id), eq(t.workspaceId, workspace.id));
    await tx.delete(memberships).where(mine(memberships));
    await tx.delete(sessions).where(mine(sessions));
    await tx.delete(oauthGrants).where(mine(oauthGrants));
    const left = await tx.select({ workspaceId: memberships.workspaceId }).from(memberships).where(eq(memberships.userId, user.id));
    return { email: address, workspace, status: "removed" as const, workspacesLeft: left.length };
  });
}
