import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { agentHooks, createDb, eq, memberships, messages, replyDrafts, slackConnections, users, workspaces, type Db } from "@meerko/db";
import { SecretBox } from "./provider-keys.ts";
import { draftReply } from "./replies/drafts.ts";
import { completeSlackInstall, handleSlackCommand, handleSlackInteraction, runSlackNotifyTick, setSlackWebhook, slackInstallUrl, SlackError, SLACK_DRAFT_GRACE_MS } from "./slack.ts";

// Needs Postgres: `pnpm db:up && pnpm db:migrate`, then run with DATABASE_URL set.
describe.skipIf(!process.env.DATABASE_URL)("Slack (db)", () => {
  const db: Db = process.env.DATABASE_URL ? createDb() : (undefined as never);
  const box = new SecretBox(randomBytes(32).toString("base64"));
  const config = { clientId: "1.2", clientSecret: "cs", signingSecret: "ss", redirectUri: "https://api.example/slack/oauth/callback" };
  const run = randomBytes(4).toString("hex");
  let ws: string;
  let calls: { url: string; body: any }[];
  let slackEmail: string;
  let postError: string | null;
  let lookupError: string | null;
  // Each test is its own Slack workspace, so /meerko and clicks find this test's Meerko workspace.
  let team: string;

  /** Fake Slack: the Web API methods Meerko calls, webhooks and response_url. */
  const fetch = (async (url: string, init: RequestInit) => {
    const body = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : JSON.parse(String(init.body ?? "{}"));
    calls.push({ url, body });
    if (url.endsWith("/oauth.v2.access")) {
      return Response.json({ ok: true, access_token: "xoxb-test", team: { id: team, name: "Acme" }, incoming_webhook: { channel: "#sales", channel_id: "C1" } });
    }
    if (url.endsWith("/chat.postMessage")) return Response.json(postError ? { ok: false, error: postError } : { ok: true, channel: "C1", ts: `${calls.length}.0001` });
    // Like Slack: users.info reads form arguments only, and without a user it answers user_not_found.
    if (url.endsWith("/users.info")) {
      if (!(init.body instanceof URLSearchParams) || !init.body.get("user")) return Response.json({ ok: false, error: "user_not_found" });
      return Response.json(lookupError ? { ok: false, error: lookupError } : { ok: true, user: { profile: { email: slackEmail } } });
    }
    return new Response("ok");
  }) as typeof globalThis.fetch;

  const posts = () => calls.filter((c) => c.url.endsWith("/chat.postMessage") || c.url.includes("hooks.slack.com/services"));
  const reply = async (from: string, body: string) =>
    (await db.insert(messages).values({ workspaceId: ws, direction: "in", fromEmail: from, toEmail: "me@x.example", subject: "Re: hi", body }).returning())[0]!;
  const later = (ms: number) => () => new Date(Date.now() + ms);

  beforeEach(async () => {
    calls = [];
    postError = null;
    lookupError = null;
    team = `T${randomBytes(4).toString("hex")}`;
    ws = (await db.insert(workspaces).values({ name: `slack-${run}` }).returning())[0]!.id;
    const [user] = await db.insert(users).values({ googleSub: `sub-${randomBytes(4).toString("hex")}`, email: `owner-${randomBytes(4).toString("hex")}@acme.example` }).returning();
    await db.insert(memberships).values({ userId: user!.id, workspaceId: ws, role: "owner" });
    slackEmail = user!.email.toUpperCase();
    const state = new URL(slackInstallUrl(config, box, { workspaceId: ws, userId: user!.id })).searchParams.get("state")!;
    await completeSlackInstall(db, box, config, { code: "c", state }, { fetch });
    calls = [];
  });
  afterAll(async () => {
    await db.delete(workspaces).where(eq(workspaces.name, `slack-${run}`));
  });

  it("posts each draft with buttons, then waiting replies once they're a couple of minutes old, each once", async () => {
    const a = await reply("ana@acme.es", "Pricing?");
    await reply("bo@acme.es", "Tell me more");
    const draft = await draftReply(db, ws, a.id, "Sure, here it is.");

    // Right away: the draft goes out; Bo's reply waits for the delay.
    expect(await runSlackNotifyTick(db, { box, fetch, appUrl: "https://app.example" })).toEqual({ drafts: 1, replies: 0, failed: 0 });
    expect(posts()[0]!.body).toMatchObject({ channel: "C1", text: "Draft ready: reply from ana@acme.es" });
    expect(JSON.stringify(posts()[0]!.body.blocks)).toContain("meerko_approve");
    const [saved] = await db.select().from(replyDrafts).where(eq(replyDrafts.id, draft.id));
    expect(saved).toMatchObject({ slackChannel: "C1" });

    expect(await runSlackNotifyTick(db, { box, fetch, now: later(3 * 60_000) })).toEqual({ drafts: 0, replies: 1, failed: 0 });
    expect(posts()[1]!.body.text).toBe("1 new reply in Meerko");
    expect(await runSlackNotifyTick(db, { box, fetch, now: later(10 * 60_000) })).toEqual({ drafts: 0, replies: 0, failed: 0 });
  });

  it("gives the agent time to draft when an agent hook is on", async () => {
    await db.insert(agentHooks).values({ workspaceId: ws, kind: "webhook", url: "https://x.example", encryptedSecret: box.encrypt("s"), secretLast4: "s" });
    await reply("ana@acme.es", "Pricing?");
    expect((await runSlackNotifyTick(db, { box, fetch, now: later(5 * 60_000) })).replies).toBe(0);
    expect((await runSlackNotifyTick(db, { box, fetch, now: later(SLACK_DRAFT_GRACE_MS + 60_000) })).replies).toBe(1);
  });

  it("leaves bounces, out-of-office and handled replies out", async () => {
    const r = await reply("x@acme.es", "Mailbox full");
    await db.update(messages).set({ intent: "bounce" }).where(eq(messages.id, r.id));
    expect((await runSlackNotifyTick(db, { box, fetch, now: later(5 * 60_000) })).replies).toBe(0);
  });

  it("turns itself off when the app was removed, and retries other errors", async () => {
    await reply("ana@acme.es", "Pricing?");
    postError = "ratelimited";
    expect((await runSlackNotifyTick(db, { box, fetch, now: later(5 * 60_000) })).failed).toBe(1);
    let [conn] = await db.select().from(slackConnections).where(eq(slackConnections.workspaceId, ws));
    expect(conn).toMatchObject({ enabled: true, lastError: "Slack answered ratelimited" });

    postError = "token_revoked";
    await runSlackNotifyTick(db, { box, fetch, now: later(10 * 60_000) });
    [conn] = await db.select().from(slackConnections).where(eq(slackConnections.workspaceId, ws));
    expect(conn).toMatchObject({ enabled: false, lastError: "Turned off: Slack answered token_revoked" });
  });

  it("lets only a Meerko member act on a draft from the right Slack workspace", async () => {
    const a = await reply("ana@acme.es", "Pricing?");
    const draft = await draftReply(db, ws, a.id, "Sure.");
    const click = (action_id: string, from = team) => ({
      type: "block_actions",
      team: { id: from },
      user: { id: "U1" },
      response_url: "https://hooks.slack.com/actions/x",
      actions: [{ action_id, value: draft.id }],
    });
    const deps = { box, fetch, approve: { box } };

    expect((await handleSlackInteraction(db, deps, click("meerko_discard", "TOTHER"))).outcome).toBe("unknown_draft");
    slackEmail = "stranger@else.example";
    expect((await handleSlackInteraction(db, deps, click("meerko_discard"))).outcome).toBe("not_member");
    expect(calls.at(-1)!.body).toMatchObject({ response_type: "ephemeral", replace_original: false });

    // Slack refusing the lookup is a private note, not a failed click.
    lookupError = "missing_scope";
    expect((await handleSlackInteraction(db, deps, click("meerko_discard"))).outcome).toBe("lookup_failed");
    expect(calls.at(-1)!.body).toMatchObject({ response_type: "ephemeral" });
    expect(calls.at(-1)!.body.text).toContain("missing_scope");
    lookupError = null;

    slackEmail =(await db.select({ email: users.email }).from(users).innerJoin(memberships, eq(memberships.userId, users.id)).where(eq(memberships.workspaceId, ws)))[0]!.email;
    // No mailbox received this reply, so approving fails with a note, and the draft stays pending.
    expect((await handleSlackInteraction(db, deps, click("meerko_approve"))).outcome).toBe("error");
    expect(calls.at(-1)!.body.text).toContain("mailbox");

    expect((await handleSlackInteraction(db, deps, click("meerko_discard"))).outcome).toBe("discarded");
    expect(calls.at(-1)!.body).toMatchObject({ replace_original: true, text: "Draft discarded" });
    const [saved] = await db.select().from(replyDrafts).where(eq(replyDrafts.id, draft.id));
    expect(saved!.status).toBe("discarded");
  });

  it("answers /meerko privately with what's waiting, for members only", async () => {
    await reply("ana@acme.es", "Pricing?");
    const res = await handleSlackCommand(db, { box, fetch, appUrl: "https://app.example" }, { team_id: team, channel_id: "C1", user_id: "U1", text: "" });
    expect(res.response_type).toBe("ephemeral");
    expect(res.text).toContain("1 reply waiting");
    expect(res.text).toContain("<https://app.example/app/inbox|Open the inbox>");

    slackEmail = "stranger@else.example";
    expect((await handleSlackCommand(db, { box, fetch }, { team_id: team, user_id: "U1" })).text).toContain("Only members");
  });

  it("connects a pasted webhook after a hello, and posts drafts without buttons", async () => {
    await expect(setSlackWebhook(db, box, ws, "https://evil.example/hook", { fetch })).rejects.toBeInstanceOf(SlackError);
    await setSlackWebhook(db, box, ws, "https://hooks.slack.com/services/T0/B0/xyz", { fetch });
    expect(posts()[0]!.body.text).toContain("Meerko is connected");

    const a = await reply("ana@acme.es", "Pricing?");
    await draftReply(db, ws, a.id, "Sure.");
    expect((await runSlackNotifyTick(db, { box, fetch, appUrl: "https://app.example" })).drafts).toBe(1);
    const sent = JSON.stringify(posts().at(-1)!.body.blocks);
    expect(sent).not.toContain("meerko_approve");
    expect(sent).toContain("Review in Meerko");
  });
});
