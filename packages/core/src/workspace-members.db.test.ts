import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, eq, inArray, invitations, memberships, users, workspaces, type Db } from "@meerko/db";
import { createSession, inviteToWorkspace, mayJoin, signInWithEmail, verifySession } from "./auth.ts";
import { addWorkspaceMember, removeWorkspaceMember, WorkspaceMemberError } from "./workspace-members.ts";

describe.skipIf(!process.env.DATABASE_URL)("workspace members (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const email = (name: string) => `${name}-${run}@members-test.example`;
  const names = ["owner", "new", "open", "old", "two", "gone"];
  let demo: string;

  const membershipsOf = async (address: string) =>
    db
      .select({ workspaceId: memberships.workspaceId, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(users.email, address));

  beforeAll(async () => {
    // The demo workspace and its owner, as an open sign-up leaves them.
    demo = (await signInWithEmail(db, email("owner"), "open")).workspaceId;
  });
  afterAll(async () => {
    const mine = await db
      .select({ id: memberships.workspaceId })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(inArray(users.email, names.map(email)));
    if (mine.length) await db.delete(workspaces).where(inArray(workspaces.id, mine.map((m) => m.id)));
    await db.delete(users).where(inArray(users.email, names.map(email)));
    await db.close();
  });

  it("creates a new user as an email sign-in would, and their first sign-in lands in the shared workspace", async () => {
    const r = await addWorkspaceMember(db, email("owner").toUpperCase(), ` ${email("new").toUpperCase()} `);
    expect(r).toMatchObject({ email: email("new"), userCreated: true, status: "added", role: "member", workspace: { id: demo }, signsInto: { id: demo } });
    const [user] = await db.select().from(users).where(eq(users.email, email("new")));
    expect(user).toMatchObject({ googleSub: null, name: null });

    // With signup by invitation they may ask for a link, and the link signs them into the shared workspace.
    expect(await mayJoin(db, email("new"))).toBe(true);
    const signedIn = await signInWithEmail(db, email("new"), "invite");
    expect(signedIn).toEqual({ userId: user!.id, workspaceId: demo, newUser: false });
    expect(await membershipsOf(email("new"))).toEqual([{ workspaceId: demo, role: "member" }]);
  });

  it("with signup open, the first sign-in creates no second workspace", async () => {
    await addWorkspaceMember(db, email("owner"), email("open"));
    expect(await signInWithEmail(db, email("open"), "open")).toMatchObject({ workspaceId: demo, newUser: false });
    expect((await signInWithEmail(db, email("open"), "open")).workspaceId).toBe(demo);
    // A workspace of their own would come with an owner membership.
    expect(await membershipsOf(email("open"))).toEqual([{ workspaceId: demo, role: "member" }]);
  });

  it("adds an existing user, and says where their sign-in lands", async () => {
    const old = await signInWithEmail(db, email("old"), "open");
    const r = await addWorkspaceMember(db, email("owner"), email("old"), "owner");
    expect(r).toMatchObject({ userCreated: false, status: "added", role: "owner", signsInto: { id: old.workspaceId } });
    expect(await membershipsOf(email("old"))).toHaveLength(2);
  });

  it("running it again changes nothing, and keeps the role they have", async () => {
    const again = await addWorkspaceMember(db, email("owner"), email("new"), "owner");
    expect(again).toMatchObject({ userCreated: false, status: "already_member", role: "member", signsInto: { id: demo } });
    expect(await db.select().from(users).where(eq(users.email, email("new")))).toHaveLength(1);
    expect(await membershipsOf(email("new"))).toEqual([{ workspaceId: demo, role: "member" }]);
  });

  it("refuses a member of no workspace or of several", async () => {
    await expect(addWorkspaceMember(db, email("nobody"), email("gone"))).rejects.toThrow(WorkspaceMemberError);
    // "old" is in their own workspace and the demo one.
    await expect(addWorkspaceMember(db, email("old"), email("gone"))).rejects.toThrow(/2 workspaces/);
    await expect(removeWorkspaceMember(db, email("old"), email("gone"))).rejects.toThrow(/2 workspaces/);
    expect(await db.select().from(users).where(eq(users.email, email("gone")))).toHaveLength(0);
  });

  it("--remove takes the membership, sessions and a pending invitation away, and can be repeated", async () => {
    await addWorkspaceMember(db, email("owner"), email("gone"));
    const { userId } = await signInWithEmail(db, email("gone"), "invite");
    const session = await createSession(db, userId, demo);
    expect(await verifySession(db, session.token)).not.toBeNull();

    expect(await removeWorkspaceMember(db, email("owner"), email("gone"))).toMatchObject({ status: "removed", workspacesLeft: 0, workspace: { id: demo } });
    expect(await membershipsOf(email("gone"))).toEqual([]);
    expect(await verifySession(db, session.token)).toBeNull();
    // The user stays, but with signup by invitation there is nowhere to sign in to.
    await expect(signInWithEmail(db, email("gone"), "invite")).rejects.toThrow(/hasn't been invited/);
    expect(await removeWorkspaceMember(db, email("owner"), email("gone"))).toMatchObject({ status: "not_member" });

    // An address that was only invited: the invitation goes, so signing in later doesn't let them in.
    await inviteToWorkspace(db, demo, email("two"));
    expect(await removeWorkspaceMember(db, email("owner"), email("two"))).toMatchObject({ status: "not_member" });
    expect(await db.select().from(invitations).where(eq(invitations.email, email("two")))).toHaveLength(0);

    // Added again after a removal, they are back.
    expect(await addWorkspaceMember(db, email("owner"), email("gone"))).toMatchObject({ userCreated: false, status: "added" });
    expect((await signInWithEmail(db, email("gone"), "invite")).workspaceId).toBe(demo);
  });

  it("won't remove the member named first, or the only owner", async () => {
    await expect(removeWorkspaceMember(db, email("owner"), email("owner"))).rejects.toThrow(WorkspaceMemberError);
    // "new" is in the demo workspace only, so it can name it; "old" was made a second owner above.
    expect(await removeWorkspaceMember(db, email("new"), email("old"))).toMatchObject({ status: "removed", workspacesLeft: 1 });
    await expect(removeWorkspaceMember(db, email("new"), email("owner"))).rejects.toThrow(/only owner/);
  });
});
