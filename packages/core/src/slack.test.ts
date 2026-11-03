import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecretBox } from "./provider-keys.ts";
import { draftBlocks, repliesBlocks, slackInstallUrl, verifySlackSignature } from "./slack.ts";

const sign = (secret: string, ts: string, body: string) => "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex");

describe("verifySlackSignature", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const ts = String(now.getTime() / 1000);

  it("accepts Slack's signature and refuses a wrong, missing or stale one", () => {
    const body = "payload=%7B%7D";
    expect(verifySlackSignature("s3cret", { timestamp: ts, signature: sign("s3cret", ts, body), body }, now)).toBe(true);
    expect(verifySlackSignature("s3cret", { timestamp: ts, signature: sign("other", ts, body), body }, now)).toBe(false);
    expect(verifySlackSignature("s3cret", { timestamp: ts, signature: sign("s3cret", ts, body), body: body + "x" }, now)).toBe(false);
    expect(verifySlackSignature("s3cret", { timestamp: ts, signature: null, body }, now)).toBe(false);
    const old = String(now.getTime() / 1000 - 600);
    expect(verifySlackSignature("s3cret", { timestamp: old, signature: sign("s3cret", old, body), body }, now)).toBe(false);
  });
});

describe("Slack messages", () => {
  const draft = { id: "d1", body: "Happy to share pricing <!channel>", to: "ana@acme.es", replySubject: "Re: <hi>", replyBody: "Pricing?\nOn Mon, Iker wrote:\n> old stuff", intent: "question" };

  it("shows stranger and agent text as plain text and escapes our own lines", () => {
    const blocks = draftBlocks(draft, { appUrl: "https://meerko.ai", interactive: true });
    const json = JSON.stringify(blocks);
    expect(json).toContain('"type":"plain_text","text":"Happy to share pricing <!channel>"');
    expect(json).toContain("Re: &lt;hi&gt;");
    // The quoted thread under the reply is left out.
    expect(json).toContain('"text":"Pricing?"');
    const actions = blocks.find((b) => b.type === "actions") as { elements: { action_id: string; value?: string; url?: string }[] };
    expect(actions.elements.map((e) => e.action_id)).toEqual(["meerko_approve", "meerko_discard", "meerko_open"]);
    expect(actions.elements[0]!.value).toBe("d1");
    expect(actions.elements[2]!.url).toBe("https://meerko.ai/app/inbox");
  });

  it("has no buttons to act on through a webhook, only the inbox link", () => {
    const actions = draftBlocks(draft, { appUrl: "https://meerko.ai", interactive: false }).find((b) => b.type === "actions") as { elements: { action_id: string }[] };
    expect(actions.elements.map((e) => e.action_id)).toEqual(["meerko_open"]);
  });

  it("lists replies and says how many more there are", () => {
    const json = JSON.stringify(repliesBlocks([{ from: "a@b.c", subject: null, body: "Hi", intent: null }], { total: 3 }));
    expect(json).toContain("*3 new replies* in Meerko");
    expect(json).toContain("…and 2 more");
  });
});

describe("slackInstallUrl", () => {
  it("asks for the app's scopes and carries an encrypted state", () => {
    const box = new SecretBox(randomBytes(32).toString("base64"));
    const url = new URL(slackInstallUrl({ clientId: "123.456", clientSecret: "x", signingSecret: "y", redirectUri: "https://api.meerko.ai/slack/oauth/callback" }, box, { workspaceId: "w1", userId: "u1" }));
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("scope")).toContain("incoming-webhook");
    expect(JSON.parse(box.decrypt(url.searchParams.get("state")!))).toMatchObject({ w: "w1", u: "u1" });
  });
});
