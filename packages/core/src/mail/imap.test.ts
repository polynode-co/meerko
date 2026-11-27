import { describe, expect, it } from "vitest";
import { fakeImap } from "./fake-imap.ts";
import { ImapClient, resolveMailServer } from "./imap.ts";
import { bodyText, header } from "./parse.ts";

const servers = { imap: { host: "imappro.zoho.eu", port: 993 }, smtp: { host: "smtppro.zoho.eu", port: 465 } };
const account = { email: "ana@acme.eu", login: "ana@acme.eu", password: "secret", servers };
const email = (n: number, extra = "") => ({
  raw: `From: Ana <ana@acme.eu>\r\nTo: pia@slalom.example\r\nSubject: Quick question\r\nMessage-ID: <m${n}@acme.eu>\r\n${extra}\r\nHi Pia`,
  messageId: `<m${n}@acme.eu>`,
  from: "ana@acme.eu",
  to: "pia@slalom.example",
});
const since = new Date("2027-06-07T08:00:00Z");

describe("ImapClient", () => {
  it("sends over SMTP to the resolved address, and its Message-ID is its id and thread", async () => {
    const f = fakeImap();
    const client = new ImapClient(account, f.connectors);
    expect(await client.send(email(1))).toEqual({ id: "<m1@acme.eu>", threadId: "<m1@acme.eu>" });
    expect(await client.send(email(2), "<m1@acme.eu>")).toEqual({ id: "<m2@acme.eu>", threadId: "<m1@acme.eu>" });
    expect(f.outbox[0]!.envelope).toEqual({ from: "ana@acme.eu", to: ["pia@slalom.example"] });
    expect(f.connectedTo.find((c) => c.kind === "smtp")).toMatchObject({ host: "smtppro.zoho.eu", port: 465, address: "203.0.113.10" });
    await client.close();
  });

  it("saves a copy in Sent only when the provider doesn't", async () => {
    const files = fakeImap({ filesSent: true });
    await new ImapClient(account, files.connectors).send(email(1));
    expect(files.appended).toEqual([]);
    expect(files.folders.Sent).toHaveLength(1);

    const leaves = fakeImap();
    await new ImapClient(account, leaves.connectors).send(email(1));
    expect(leaves.appended).toEqual([{ path: "Sent", flags: ["\\Seen"] }]);
    expect(leaves.folders.Sent![0]!.source).toContain("Message-ID: <m1@acme.eu>");

    // No Sent folder: the email still counts as sent.
    expect((await new ImapClient(account, fakeImap({ noSentFolder: true }).connectors).send(email(1))).id).toBe("<m1@acme.eu>");
  });

  it("lists inbound mail since a time with the Message-IDs it answers, and reads it in the Gmail API's shape", async () => {
    const f = fakeImap();
    f.deliver("From: Old <old@x.com>\r\nMessage-ID: <old@x.com>\r\n\r\nolder", new Date("2027-06-06T09:00:00Z"));
    f.deliver("From: Ana <ana@acme.eu>\r\nMessage-ID: <self@acme.eu>\r\n\r\nmine");
    f.deliver(
      [
        "From: =?UTF-8?Q?Pia_M=C3=BCller?= <Pia@slalom.example>",
        "Subject: Re: Quick question",
        "Message-ID: <r1@slalom.example>",
        "In-Reply-To: <m2@acme.eu>",
        "References: <m1@acme.eu>",
        " <m2@acme.eu>",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Yes, Tuesday works.",
      ].join("\r\n"),
    );
    const client = new ImapClient(account, f.connectors);
    const inbound = await client.listInbound(since);
    // The sender comes with the listing, so the reply tick needn't fetch each message's headers.
    expect(inbound).toEqual([{ id: "<r1@slalom.example>", threadId: "<m1@acme.eu>", refs: ["<m1@acme.eu>", "<m2@acme.eu>"], from: "pia@slalom.example" }]);

    const meta = await client.getMessage("<r1@slalom.example>", "metadata", ["From"]);
    expect(header(meta, "From")).toBe("Pia Müller <Pia@slalom.example>");
    const full = await client.getMessage("<r1@slalom.example>");
    expect(full).toMatchObject({ threadId: "<m1@acme.eu>", internalDate: String(Date.parse("2027-06-07T09:00:00Z")) });
    expect(bodyText(full)).toBe("Yes, Tuesday works.");
  });

  it("matches a bounce to the email it quotes", async () => {
    const f = fakeImap();
    f.deliver(
      [
        "From: Mail Delivery System <MAILER-DAEMON@mx.zoho.eu>",
        "Subject: Undelivered Mail Returned to Sender",
        "Message-ID: <bounce1@mx.zoho.eu>",
        'Content-Type: multipart/report; report-type=delivery-status; boundary="b"',
        "",
        "--b",
        "Content-Type: text/plain",
        "",
        "Your message to <pia@slalom.example> could not be delivered.",
        "--b",
        "Content-Type: text/rfc822-headers",
        "",
        "From: Ana <ana@acme.eu>",
        "Message-ID: <m1@acme.eu>",
        "--b--",
      ].join("\r\n"),
    );
    expect(await new ImapClient(account, f.connectors).listInbound(since)).toEqual([
      { id: "<bounce1@mx.zoho.eu>", threadId: "<m1@acme.eu>", refs: ["<m1@acme.eu>"], from: "mailer-daemon@mx.zoho.eu" },
    ]);
  });

  it("asks for a reconnect when the server rejects the password", async () => {
    const client = new ImapClient(account, fakeImap({ authFails: true }).connectors);
    await expect(client.send(email(1))).rejects.toMatchObject({ needsReconnect: true });
    await expect(client.listInbound(since)).rejects.toMatchObject({ needsReconnect: true, message: expect.stringContaining("didn't accept the password") });
  });

  it("refuses private addresses and non-TLS ports, so it can't be pointed at internal services", async () => {
    await expect(new ImapClient(account, fakeImap({ address: "10.0.0.5" }).connectors).listInbound(since)).rejects.toMatchObject({
      message: expect.stringContaining("isn't a public internet address"),
    });
    const resolve = async () => ["203.0.113.10"];
    await expect(resolveMailServer({ host: "mail.acme.eu", port: 143 }, "imap", resolve)).rejects.toThrow(/use 993/);
    await expect(resolveMailServer({ host: "mail.acme.eu", port: 25 }, "smtp", resolve)).rejects.toThrow(/use 465 or 587/);
    await expect(resolveMailServer({ host: "169.254.169.254", port: 993 }, "imap", resolve)).rejects.toThrow(/public/);
    await expect(resolveMailServer({ host: "mail acme", port: 993 }, "imap", resolve)).rejects.toThrow(/server name/);
    expect(await resolveMailServer({ host: "Mail.Acme.eu", port: 587 }, "smtp", resolve)).toEqual({ host: "mail.acme.eu", port: 587, address: "203.0.113.10" });
  });
});
