import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, eq, mailboxes, memberships, users, workspaces, type Db } from "@meerko/db";
import { claimMailboxDisconnects, markMailboxError } from "./mailboxes.ts";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("mailbox disconnects (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const run = randomBytes(4).toString("hex");
  let ws: string;
  let owner: string;
  let mailboxId: string;
  const created: string[] = [];
  const mine = async () => (await claimMailboxDisconnects(db)).filter((d) => d.workspaceId === ws);

  beforeEach(async () => {
    ws = (await db.insert(workspaces).values({ name: `disc-${run}` }).returning())[0]!.id;
    created.push(ws);
    owner = (await db.insert(users).values({ email: `owner-${randomBytes(4).toString("hex")}@acme.example` }).returning())[0]!.id;
    const member = (await db.insert(users).values({ email: `member-${randomBytes(4).toString("hex")}@acme.example` }).returning())[0]!.id;
    await db.insert(memberships).values([
      { userId: owner, workspaceId: ws, role: "owner" },
      { userId: member, workspaceId: ws, role: "member" },
    ]);
    mailboxId = (await db.insert(mailboxes).values({ workspaceId: ws, provider: "gmail_imap", email: `box-${run}@acme.example`, encryptedPassword: "x" }).returning())[0]!.id;
  });
  afterAll(async () => {
    for (const id of created) await db.delete(workspaces).where(eq(workspaces.id, id));
  });

  it("reports a disconnect once, to the workspace's owners", async () => {
    await markMailboxError(db, mailboxId, "invalid credentials");
    expect(await mine()).toEqual([{ mailboxId, workspaceId: ws, email: `box-${run}@acme.example`, provider: "gmail_imap", ownerIds: [owner] }]);
    expect(await mine()).toEqual([]);
  });

  it("doesn't report again while the mailbox stays disconnected", async () => {
    await markMailboxError(db, mailboxId, "invalid credentials");
    await mine();
    await markMailboxError(db, mailboxId, "still invalid");
    expect(await mine()).toEqual([]);
  });

  it("reports the next disconnect after a reconnect", async () => {
    await markMailboxError(db, mailboxId, "invalid credentials");
    await mine();
    await db.update(mailboxes).set({ status: "active", lastError: null }).where(eq(mailboxes.id, mailboxId));
    await markMailboxError(db, mailboxId, "revoked");
    expect((await mine()).map((d) => d.mailboxId)).toEqual([mailboxId]);
  });

  it("leaves working mailboxes alone", async () => {
    expect(await mine()).toEqual([]);
  });
});
