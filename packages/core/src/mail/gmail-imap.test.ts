import { describe, expect, it } from "vitest";
import { bodyText, header } from "./parse.ts";
import { fakeGmail } from "./fake-gmail-imap.ts";
import { GmailImapClient } from "./gmail-imap.ts";
import { decodeWords, parseHeaders } from "./imap-common.ts";

const account = { email: "iker@meerko.ai", login: "iker@polynode.co", password: "abcdabcdabcdabcd" };
const email = (n: number, extra = "") => ({
  raw: `From: Iker <iker@meerko.ai>\r\nTo: pia@slalom.example\r\nSubject: Quick question\r\nMessage-ID: <m${n}@meerko.ai>\r\n${extra}\r\nHi Pia`,
  messageId: `<m${n}@meerko.ai>`,
  from: "iker@meerko.ai",
  to: "pia@slalom.example",
});

describe("GmailImapClient", () => {
  it("sends over SMTP from the address with the envelope set, and returns the sent copy's ids in hex", async () => {
    const g = fakeGmail();
    const client = new GmailImapClient(account, g.connectors);
    const sent = await client.send(email(1));
    expect(g.outbox[0]!.envelope).toEqual({ from: "iker@meerko.ai", to: ["pia@slalom.example"] });
    expect(sent).toEqual({ id: BigInt("1879569508915794710").toString(16), threadId: BigInt("1879569508915794710").toString(16) });
    expect(g.openedReadOnly).toBe(true);
    await client.close();
    expect(g.loggedOut).toBe(true);
  });

  it("keeps a follow-up in the first email's thread", async () => {
    const g = fakeGmail();
    const client = new GmailImapClient(account, g.connectors);
    const first = await client.send(email(1));
    const second = await client.send(email(2, "In-Reply-To: <m1@meerko.ai>\r\n"));
    expect(second.threadId).toBe(first.threadId);
    expect(second.id).not.toBe(first.id);
  });

  it("retries the lookup while Gmail indexes the sent copy, then gives up without failing the send", async () => {
    const waits: number[] = [];
    const sleep = async (ms: number) => void waits.push(ms);
    const slow = fakeGmail({ indexAfterLookups: 2 });
    expect((await new GmailImapClient(account, { ...slow.connectors, sleep }).send(email(1))).id).toBeTruthy();
    expect(waits).toEqual([1000, 2000]);

    const never = fakeGmail({ indexAfterLookups: 99 });
    expect(await new GmailImapClient(account, never.connectors).send(email(1))).toEqual({ id: null, threadId: null });
    expect(never.outbox).toHaveLength(1);
  });

  it("lists matches newest first and reads them in the Gmail API's shape", async () => {
    const g = fakeGmail();
    const client = new GmailImapClient(account, g.connectors);
    const sent = await client.send(email(1));
    g.store(
      [
        "From: =?UTF-8?Q?Pia_M=C3=BCller?= <Pia@slalom.example>",
        "Subject: =?UTF-8?B?UmU6IFF1aWNr?=",
        " question",
        "Message-ID: <r1@slalom.example>",
        "In-Reply-To: <m1@meerko.ai>",
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        "S=C3=AD, hablamos el martes.",
      ].join("\r\n"),
      BigInt(`0x${sent.threadId}`).toString(),
    );
    g.store("From: Bob <bob@x.com>\r\nMessage-ID: <b@x.com>\r\n\r\nunrelated");

    const ids = await client.listMessageIds("after:1 -from:me");
    expect(ids.map((i) => i.threadId)).toEqual([BigInt("1879569508915794712").toString(16), sent.threadId]);
    // The sender comes with the listing, so the reply tick needn't fetch each message's headers.
    expect(ids.map((i) => i.from)).toEqual(["bob@x.com", "pia@slalom.example"]);
    expect(g.searches).toContainEqual({ gmraw: "after:1 -from:me" });

    const meta = await client.getMessage(ids[1]!.id, "metadata", ["From"]);
    expect(header(meta, "From")).toBe("Pia Müller <Pia@slalom.example>");

    const full = await client.getMessage(ids[1]!.id, "full");
    expect(full.threadId).toBe(sent.threadId);
    expect(header(full, "Subject")).toBe("Re: Quick question");
    expect(header(full, "In-Reply-To")).toBe("<m1@meerko.ai>");
    expect(bodyText(full)).toBe("Sí, hablamos el martes.");
    expect(full.internalDate).toBe(String(Date.parse("2026-10-05T09:00:00Z")));
  });

  it("finds a message it hasn't listed by its id", async () => {
    const g = fakeGmail();
    const stored = g.store("From: Pia <pia@slalom.example>\r\nMessage-ID: <r1@slalom.example>\r\n\r\nhola");
    const msg = await new GmailImapClient(account, g.connectors).getMessage(BigInt(stored.emailId).toString(16));
    expect(bodyText(msg)).toBe("hola");
  });

  it("asks for a reconnect when Gmail rejects the app password", async () => {
    const g = fakeGmail({ authFails: true });
    const client = new GmailImapClient(account, g.connectors);
    await expect(client.send(email(1))).rejects.toMatchObject({ needsReconnect: true, status: 535 });
    await expect(client.listMessageIds("x")).rejects.toMatchObject({ needsReconnect: true });
    await expect(client.verify()).rejects.toMatchObject({ needsReconnect: true });
  });

  it("refuses an account that isn't Gmail", async () => {
    const g = fakeGmail({ gmail: false });
    await expect(new GmailImapClient(account, g.connectors).listMessageIds("x")).rejects.toMatchObject({
      message: expect.stringContaining("isn't a Gmail"),
      needsReconnect: true,
    });
  });
});

describe("header parsing", () => {
  it("unfolds lines and decodes encoded words", () => {
    expect(parseHeaders("Subject: =?UTF-8?B?w4lsw6g=?=\r\n =?UTF-8?Q?_y_m=C3=A1s?=\r\nX-A: b")).toEqual([
      { name: "Subject", value: "Élè y más" },
      { name: "X-A", value: "b" },
    ]);
    expect(decodeWords("=?ISO-8859-1?Q?Jos=E9?= <jose@x.com>")).toBe("José <jose@x.com>");
    expect(decodeWords("=?unknown-charset?B?eA==?=")).toBe("=?unknown-charset?B?eA==?=");
  });
});
