import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { authCodes, createDb, eq, memberships, sessions, users, workspaces, type Db } from "@meerko/db";
import { createApiKey, listApiKeys, revokeApiKey } from "./api-keys.ts";
import { getBalance } from "./credits.ts";
import { createAuthCode, deleteSession, exchangeAuthCode, inviteToWorkspace, SignInError, signInWithGoogle, verifySession } from "./auth.ts";
import { NotFoundError } from "./tables.ts";

describe.skipIf(!process.env.DATABASE_URL)("auth (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  const email = (name: string) => `${name}-${run}@auth-test.example`;
  const profile = (name: string, over: Partial<{ sub: string; emailVerified: boolean }> = {}) => ({
    sub: over.sub ?? `sub-${name}-${run}`,
    email: email(name),
    emailVerified: over.emailVerified ?? true,
    name: `${name[0]!.toUpperCase()}${name.slice(1)} Test`,
  });
  const workspaceIds: string[] = [];
  afterAll(async () => {
    for (const id of workspaceIds) await db.delete(workspaces).where(eq(workspaces.id, id));
    for (const name of ["ana", "bo", "cy", "di", "ed"]) await db.delete(users).where(eq(users.email, email(name)));
  });

  it("open signup creates a user, workspace and owner membership once", async () => {
    const first = await signInWithGoogle(db, profile("ana"), "open");
    workspaceIds.push(first.workspaceId);
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, first.workspaceId));
    expect(ws!.name).toBe("Ana's workspace");
    const [m] = await db.select().from(memberships).where(eq(memberships.userId, first.userId));
    expect(m!.role).toBe("owner");
    expect(await getBalance(db, first.workspaceId)).toBe(1000);

    // Signing in again reuses both, even if the Google account was recreated (new sub, same email).
    expect(await signInWithGoogle(db, profile("ana"), "open")).toEqual(first);
    expect(await signInWithGoogle(db, profile("ana", { sub: `new-${run}` }), "open")).toEqual(first);
  });

  it("invite mode refuses strangers without leaving a user behind, and lets invited emails in", async () => {
    await expect(signInWithGoogle(db, profile("bo"), "invite")).rejects.toThrow(SignInError);
    expect(await db.select().from(users).where(eq(users.email, email("bo")))).toHaveLength(0);

    const [ws] = await db.insert(workspaces).values({ name: `invite-${run}` }).returning();
    workspaceIds.push(ws!.id);
    expect(await inviteToWorkspace(db, ws!.id, email("bo").toUpperCase(), "member")).toMatchObject({ status: "invited" });
    const bo = await signInWithGoogle(db, profile("bo"), "invite");
    expect(bo.workspaceId).toBe(ws!.id);

    // Inviting someone who already signed in adds them straight away.
    const ana = await signInWithGoogle(db, profile("ana"), "invite");
    expect(await inviteToWorkspace(db, ws!.id, email("ana"))).toMatchObject({ status: "added" });
    expect(ana.workspaceId).not.toBe(ws!.id);
  });

  it("an unverified email can't sign in or claim an invitation", async () => {
    const [ws] = await db.insert(workspaces).values({ name: `unverified-${run}` }).returning();
    workspaceIds.push(ws!.id);
    await inviteToWorkspace(db, ws!.id, email("cy"));
    await expect(signInWithGoogle(db, profile("cy", { emailVerified: false }), "open")).rejects.toThrow(SignInError);
  });

  it("an auth code becomes a session once, and the session resolves to its user and workspace", async () => {
    const { userId, workspaceId } = await signInWithGoogle(db, profile("di"), "open");
    workspaceIds.push(workspaceId);
    const code = await createAuthCode(db, userId, workspaceId);
    const session = await exchangeAuthCode(db, code);
    expect(session!.token).toMatch(/^ms_/);
    expect(await exchangeAuthCode(db, code)).toBeNull();

    expect(await verifySession(db, session!.token)).toMatchObject({ userId, workspaceId, email: email("di"), role: "owner" });
    expect(await verifySession(db, "ms_unknown")).toBeNull();
    expect(await verifySession(db, "mk_an-api-key")).toBeNull();

    await deleteSession(db, session!.token);
    expect(await verifySession(db, session!.token)).toBeNull();
  });

  it("expired codes and sessions don't work, and leaving the workspace ends the session", async () => {
    const { userId, workspaceId } = await signInWithGoogle(db, profile("ed"), "open");
    workspaceIds.push(workspaceId);
    const code = await createAuthCode(db, userId, workspaceId);
    await db.update(authCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(authCodes.userId, userId));
    expect(await exchangeAuthCode(db, code)).toBeNull();

    const session = await exchangeAuthCode(db, await createAuthCode(db, userId, workspaceId));
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, userId));
    expect(await verifySession(db, session!.token)).toBeNull();

    const fresh = await exchangeAuthCode(db, await createAuthCode(db, userId, workspaceId));
    await db.delete(memberships).where(eq(memberships.userId, userId));
    expect(await verifySession(db, fresh!.token)).toBeNull();
  });

  it("lists and revokes API keys within a workspace only", async () => {
    const [ws] = await db.insert(workspaces).values({ name: `keys-${run}` }).returning();
    workspaceIds.push(ws!.id);
    const { id, key } = await createApiKey(db, ws!.id, "cli");
    const [listed] = await listApiKeys(db, ws!.id);
    expect(listed).toMatchObject({ id, name: "cli", prefix: key.slice(0, 8) });
    expect(listed).not.toHaveProperty("keyHash");

    await expect(revokeApiKey(db, workspaceIds[0]!, id)).rejects.toThrow(NotFoundError);
    await revokeApiKey(db, ws!.id, id);
    expect(await listApiKeys(db, ws!.id)).toHaveLength(0);
  });
});
