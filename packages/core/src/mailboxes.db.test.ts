import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, dataTables, eq, mailboxes, sequenceMailboxes, sequences, workspaces, type Db } from "@meerko/db";
import { GMAIL_SCOPES, GoogleOAuth } from "./mail/gmail.ts";
import { connectGmail, createOAuthState, deleteMailbox, listMailboxes, MailboxInUseError, OAuthStateError, readOAuthReturnTo, readOAuthState, sendTestEmail } from "./mailboxes.ts";
import { SecretBox } from "./provider-keys.ts";

describe.skipIf(!process.env.DATABASE_URL)("mailboxes (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, "mailbox-test"));
  });

  let refreshFails = false;
  const fetch = (async (url: string) => {
    if (url.includes("oauth2.googleapis.com")) {
      if (refreshFails) return Response.json({ error: "invalid_grant" }, { status: 400 });
      return Response.json({ access_token: "a", refresh_token: "refresh-secret", scope: GMAIL_SCOPES.join(" "), expires_in: 3600 });
    }
    if (url.endsWith("/profile")) return Response.json({ emailAddress: "Pia@slalom.example" });
    if (url.endsWith("/messages/send")) return Response.json({ id: "m1", threadId: "t1" });
    throw new Error(url);
  }) as typeof globalThis.fetch;
  const oauth = new GoogleOAuth({ clientId: "c", clientSecret: "s", redirectUri: "http://x/cb", fetch });

  it("connects via the callback, stores the token encrypted, and reconnects in place", async () => {
    const [ws] = await db.insert(workspaces).values({ name: "mailbox-test" }).returning();
    const state = createOAuthState(box, ws!.id);
    expect(readOAuthState(box, state)).toBe(ws!.id);

    const mb = await connectGmail(db, box, oauth, state, "code", fetch);
    expect(mb.email).toBe("pia@slalom.example");
    const [row] = await db.select().from(mailboxes).where(eq(mailboxes.id, mb.id));
    expect(row!.encryptedRefreshToken).not.toContain("refresh-secret");
    expect(box.decrypt(row!.encryptedRefreshToken!)).toBe("refresh-secret");

    expect(await sendTestEmail(db, ws!.id, mb.id, "me@x.com", { box, oauth, fetch })).toMatchObject({ id: "m1" });

    // A revoked token marks the mailbox as needing a reconnect...
    refreshFails = true;
    await expect(sendTestEmail(db, ws!.id, mb.id, "me@x.com", { box, oauth, fetch })).rejects.toMatchObject({ needsReconnect: true });
    expect((await listMailboxes(db, ws!.id))[0]).toMatchObject({ status: "error" });

    // ...and connecting the same address again heals the same mailbox.
    refreshFails = false;
    const again = await connectGmail(db, box, oauth, createOAuthState(box, ws!.id), "code2", fetch);
    expect(again.id).toBe(mb.id);
    expect((await listMailboxes(db, ws!.id))[0]).toMatchObject({ status: "active", lastError: null });
  });

  it("disconnects a mailbox only from its own workspace, and never a sequence's last sender", async () => {
    const [a, b] = await db.insert(workspaces).values([{ name: "mailbox-test" }, { name: "mailbox-test" }]).returning();
    const [m1, m2] = await db
      .insert(mailboxes)
      .values([
        { workspaceId: a!.id, provider: "gmail_imap", email: "one@a.test", encryptedPassword: "x" },
        { workspaceId: a!.id, provider: "gmail_imap", email: "two@a.test", encryptedPassword: "x" },
      ])
      .returning();
    const [table] = await db.insert(dataTables).values({ workspaceId: a!.id, name: "t" }).returning();
    const [seq] = await db.insert(sequences).values({ workspaceId: a!.id, tableId: table!.id, name: "Pool" }).returning();
    await db.insert(sequenceMailboxes).values([{ sequenceId: seq!.id, mailboxId: m1!.id }, { sequenceId: seq!.id, mailboxId: m2!.id }]);
    const pool = () => db.select().from(sequenceMailboxes).where(eq(sequenceMailboxes.sequenceId, seq!.id));

    // Another workspace can't remove it, nor take it out of this workspace's pools.
    expect(await deleteMailbox(db, b!.id, m1!.id)).toBe(false);
    expect(await pool()).toHaveLength(2);

    expect(await deleteMailbox(db, a!.id, m1!.id)).toBe(true);
    expect((await pool()).map((p) => p.mailboxId)).toEqual([m2!.id]);
    await expect(deleteMailbox(db, a!.id, m2!.id)).rejects.toBeInstanceOf(MailboxInUseError);
    expect(await pool()).toHaveLength(1);
  });

  it("rejects forged and other-key states", async () => {
    expect(() => readOAuthState(box, "not-a-state")).toThrow(OAuthStateError);
    const other = new SecretBox(randomBytes(32).toString("base64"));
    expect(() => readOAuthState(box, createOAuthState(other, "00000000-0000-0000-0000-000000000000"))).toThrow(OAuthStateError);
  });

  it("carries the return URL only in genuine states", () => {
    const id = "00000000-0000-0000-0000-000000000000";
    expect(readOAuthReturnTo(box, createOAuthState(box, id, "https://app.example/app/settings"))).toBe("https://app.example/app/settings");
    expect(readOAuthReturnTo(box, createOAuthState(box, id))).toBeUndefined();
    expect(readOAuthReturnTo(box, "not-a-state")).toBeUndefined();
    const other = new SecretBox(randomBytes(32).toString("base64"));
    expect(readOAuthReturnTo(box, createOAuthState(other, id, "https://evil.example"))).toBeUndefined();
  });
});
