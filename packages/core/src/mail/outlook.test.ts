import { describe, expect, it } from "vitest";
import { fakeGraph } from "./fake-graph.ts";
import { MicrosoftOAuth, OutlookClient } from "./outlook.ts";
import { bodyText, header } from "./parse.ts";

const oauthFor = (fetch: typeof globalThis.fetch) => new MicrosoftOAuth({ clientId: "c", clientSecret: "s", redirectUri: "https://api.x/oauth/microsoft/callback", fetch });
const noWait = async () => {};
const email = (n: number, extra = "") => ({
  raw: `From: Ana <ana@acme.com>\r\nTo: pia@slalom.example\r\nSubject: Quick question\r\nMessage-ID: <m${n}@acme.com>\r\n${extra}\r\nHi Pia`,
  messageId: `<m${n}@acme.com>`,
  from: "ana@acme.com",
  to: "pia@slalom.example",
});
const since = new Date(Date.now() - 60 * 60_000);

describe("MicrosoftOAuth", () => {
  it("asks for the mail permissions and checks they were granted", async () => {
    const g = fakeGraph();
    const oauth = oauthFor(g.fetch);
    const url = new URL(oauth.authUrl("state-1", "ana@acme.com"));
    expect(url.host).toBe("login.microsoftonline.com");
    expect(url.pathname).toBe("/common/oauth2/v2.0/authorize");
    expect(url.searchParams.get("scope")).toBe("openid email offline_access User.Read Mail.Send Mail.Read");
    expect(url.searchParams.get("login_hint")).toBe("ana@acme.com");
    expect(await oauth.exchangeCode("code")).toMatchObject({ refreshToken: "rt-1" });
  });
});

describe("OutlookClient", () => {
  it("reads the account's address", async () => {
    const g = fakeGraph();
    expect(await new OutlookClient(oauthFor(g.fetch), "rt-1", { fetch: g.fetch }).profile()).toEqual({ emailAddress: "ana@acme.com" });
  });

  it("sends the MIME message as built, keeping its Message-ID as id and thread", async () => {
    const g = fakeGraph();
    const client = new OutlookClient(oauthFor(g.fetch), "rt-1", { fetch: g.fetch, sleep: noWait });
    expect(await client.send(email(1))).toEqual({ id: "<m1@acme.com>", threadId: "<m1@acme.com>" });
    expect(await client.send(email(2), "<m1@acme.com>")).toEqual({ id: "<m2@acme.com>", threadId: "<m1@acme.com>" });
    expect(g.store[0]!.mime).toContain("Subject: Quick question");
    expect(g.calls.filter((c) => c.url.endsWith("/sendMail"))).toHaveLength(2);
  });

  it("reports the Message-ID Exchange used when it replaced Meerko's", async () => {
    const g = fakeGraph({ rewriteMessageId: true });
    expect(await new OutlookClient(oauthFor(g.fetch), "rt-1", { fetch: g.fetch, sleep: noWait }).send(email(1))).toEqual({
      id: "<exch-0@outlook.com>",
      threadId: "<exch-0@outlook.com>",
      rfcMessageId: "<exch-0@outlook.com>",
    });
  });

  it("stores each new refresh token Microsoft issues", async () => {
    const g = fakeGraph({ rotate: true });
    const saved: string[] = [];
    await new OutlookClient(oauthFor(g.fetch), "rt-1", { fetch: g.fetch, onRefreshToken: async (t) => void saved.push(t) }).profile();
    expect(saved).toEqual(["rt-new-1"]);
  });

  it("lists inbound mail with the Message-IDs it answers, skips its own, and reads it in the Gmail API's shape", async () => {
    const g = fakeGraph();
    const client = new OutlookClient(oauthFor(g.fetch), "rt-1", { email: "ana@acme.com", fetch: g.fetch, sleep: noWait });
    await client.send(email(1));
    g.deliver(
      "From: =?UTF-8?Q?Pia_M=C3=BCller?= <pia@slalom.example>\r\nSubject: Re: Quick question\r\nMessage-ID: <r1@slalom.example>\r\nIn-Reply-To: <m1@acme.com>\r\nReferences: <m1@acme.com>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nYes, Tuesday works.",
    );
    g.deliver("From: Ana <ana@acme.com>\r\nMessage-ID: <self@acme.com>\r\n\r\nnote to self");
    const inbound = await client.listInbound(since);
    // The sender comes with the listing, so the reply tick needn't fetch each message's headers.
    expect(inbound).toEqual([{ id: "<r1@slalom.example>", threadId: "<m1@acme.com>", refs: ["<m1@acme.com>"], from: "pia@slalom.example" }]);
    expect(header(await client.getMessage("<r1@slalom.example>", "metadata"), "From")).toBe("Pia Müller <pia@slalom.example>");
    const full = await client.getMessage("<r1@slalom.example>");
    expect(full.threadId).toBe("<m1@acme.com>");
    expect(bodyText(full)).toBe("Yes, Tuesday works.");
  });

  it("follows pages, and matches a bounce to the email it quotes", async () => {
    const g = fakeGraph();
    for (let i = 0; i < 60; i++) g.deliver(`From: x${i}@y.com\r\nMessage-ID: <n${i}@y.com>\r\n\r\nnews`);
    g.deliver(
      'From: postmaster@outlook.com\r\nSubject: Undeliverable: Quick question\r\nMessage-ID: <ndr1@outlook.com>\r\nContent-Type: multipart/report; report-type=delivery-status; boundary="b"\r\n\r\n--b\r\nContent-Type: text/rfc822-headers\r\n\r\nMessage-ID: <m1@acme.com>\r\n--b--',
    );
    const inbound = await new OutlookClient(oauthFor(g.fetch), "rt-1", { email: "ana@acme.com", fetch: g.fetch }).listInbound(since);
    expect(inbound).toHaveLength(61);
    expect(inbound.find((m) => m.id === "<ndr1@outlook.com>")).toEqual({
      id: "<ndr1@outlook.com>",
      threadId: "<m1@acme.com>",
      refs: ["<m1@acme.com>"],
      from: "postmaster@outlook.com",
    });
  });

  it("says an account has no mailbox when Graph refuses mail calls but the profile loads", async () => {
    const g = fakeGraph({ unlicensed: true });
    const client = new OutlookClient(oauthFor(g.fetch), "rt-1", { fetch: g.fetch });
    await expect(client.send(email(1))).rejects.toMatchObject({ needsReconnect: true, message: expect.stringContaining("no Outlook mailbox") });
    await expect(client.assertMailbox()).rejects.toThrow(/Microsoft 365 license/);
  });

  it("asks for a reconnect when access is revoked or the account has no mailbox", async () => {
    const revoked = fakeGraph({ revoked: true });
    await expect(new OutlookClient(oauthFor(revoked.fetch), "rt-1", { fetch: revoked.fetch }).listInbound(since)).rejects.toMatchObject({ needsReconnect: true });
    const none = fakeGraph({ noMailbox: true });
    await expect(new OutlookClient(oauthFor(none.fetch), "rt-1", { fetch: none.fetch }).send(email(1))).rejects.toMatchObject({
      needsReconnect: true,
      message: expect.stringContaining("no Outlook mailbox"),
    });
  });
});
