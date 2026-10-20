import { describe, expect, it } from "vitest";
import { GMAIL_SCOPES, GmailClient, GoogleOAuth } from "./gmail.ts";
import { buildMime } from "./mime.ts";

const decodeBody = (raw: string) => Buffer.from(raw.split("\r\n\r\n")[1]!.replace(/\r\n/g, ""), "base64").toString("utf8");

describe("buildMime", () => {
  it("builds a threaded plain-text message with encoded headers", () => {
    const { raw, messageId } = buildMime({
      from: { email: "iker@meerko.ai", name: "Iker González" },
      to: "pia@slalom.example",
      subject: "Re: ¿Hablamos?",
      text: "Hola Pia,\nlínea dos",
      inReplyTo: "<abc@meerko.ai>",
      references: ["<abc@meerko.ai>"],
      headers: { "List-Unsubscribe": "<mailto:u@meerko.ai>" },
    });
    expect(messageId).toMatch(/^<[0-9a-f]{24}@meerko\.ai>$/);
    expect(raw).toContain(`From: =?UTF-8?B?${Buffer.from("Iker González").toString("base64")}?= <iker@meerko.ai>`);
    expect(raw).toContain(`Subject: =?UTF-8?B?${Buffer.from("Re: ¿Hablamos?").toString("base64")}?=`);
    expect(raw).toContain("In-Reply-To: <abc@meerko.ai>\r\nReferences: <abc@meerko.ai>");
    expect(raw).toContain("List-Unsubscribe: <mailto:u@meerko.ai>");
    expect(decodeBody(raw)).toBe("Hola Pia,\r\nlínea dos");
  });

  it("strips line breaks from header values to prevent header injection", () => {
    const { raw } = buildMime({ from: { email: "a@b.com" }, to: "x@y.com\r\nBcc: victim@z.com", subject: "Hi\nBcc: v@z.com", text: "" });
    expect(raw).not.toMatch(/^Bcc:/m);
  });
});

/** Fake Google that answers OAuth token and Gmail API calls. */
function fakeGoogle(token: Record<string, unknown>, status = 200) {
  const calls: { url: string; body: string }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body ?? "") });
    if (url.includes("oauth2.googleapis.com")) return Response.json(token, { status });
    if (url.endsWith("/profile")) return Response.json({ emailAddress: "Pia@slalom.example" });
    if (url.endsWith("/messages/send")) return Response.json({ id: "m1", threadId: "t1" });
    throw new Error(url);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "http://localhost:8787/oauth/google/callback" };

describe("GoogleOAuth", () => {
  it("asks for offline access to exactly the Gmail scopes", () => {
    const url = new URL(new GoogleOAuth(config).authUrl("st4te", "pia@slalom.example"));
    expect(url.searchParams.get("scope")).toBe(GMAIL_SCOPES.join(" "));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("login_hint")).toBe("pia@slalom.example");
  });

  it("rejects a consent where the user unticked a scope", async () => {
    const { fetch } = fakeGoogle({ access_token: "a", refresh_token: "r", scope: GMAIL_SCOPES[0] });
    await expect(new GoogleOAuth({ ...config, fetch }).exchangeCode("c")).rejects.toThrow(/gmail\.readonly/);
  });

  it("flags revoked tokens as needing a reconnect", async () => {
    const { fetch } = fakeGoogle({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400);
    await expect(new GoogleOAuth({ ...config, fetch }).refresh("r")).rejects.toMatchObject({ needsReconnect: true });
  });
});

describe("GmailClient", () => {
  it("refreshes once, caches the token, and sends base64url raw messages", async () => {
    const { fetch, calls } = fakeGoogle({ access_token: "tok", expires_in: 3600 });
    const gmail = new GmailClient(new GoogleOAuth({ ...config, fetch }), "refresh", fetch);
    await gmail.profile();
    await gmail.send({ raw: "Subject: hi\r\n\r\nbody" }, "t0");
    expect(calls.filter((c) => c.url.includes("oauth2")).length).toBe(1);
    const sent = JSON.parse(calls.at(-1)!.body);
    expect(Buffer.from(sent.raw, "base64url").toString()).toBe("Subject: hi\r\n\r\nbody");
    expect(sent.threadId).toBe("t0");
  });
});
