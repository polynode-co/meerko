import { describe, expect, it } from "vitest";
import type { GmailMessage } from "../mail/gmail.ts";
import { addressOf, bodyText, stripQuoted } from "../mail/parse.ts";
import { classifyByRules } from "./classify.ts";

const msg = (headers: Record<string, string>, text = ""): GmailMessage => ({
  id: "m",
  threadId: "t",
  payload: {
    mimeType: "multipart/alternative",
    headers: Object.entries(headers).map(([name, value]) => ({ name, value })),
    parts: [
      { mimeType: "text/plain", body: { data: Buffer.from(text).toString("base64url") } },
      { mimeType: "text/html", body: { data: Buffer.from(`<p>${text}</p>`).toString("base64url") } },
    ],
  },
});

describe("parsing", () => {
  it("extracts addresses and plain-text bodies", () => {
    expect(addressOf("Pia Moll <Pia@slalom.example>")).toBe("pia@slalom.example");
    expect(addressOf("bo@x.io")).toBe("bo@x.io");
    expect(bodyText(msg({}, "Hola!"))).toBe("Hola!");
    const htmlOnly: GmailMessage = { id: "m", threadId: "t", payload: { mimeType: "text/html", body: { data: Buffer.from("Hi<br>there &amp; you").toString("base64url") } } };
    expect(bodyText(htmlOnly)).toBe("Hi\nthere & you");
  });

  it("strips quoted history in several languages", () => {
    expect(stripQuoted("Sounds good, Tuesday?\n\nOn Mon, 5 Oct 2026 at 10:30, Iker <i@x.com> wrote:\n> Hi Pia")).toBe("Sounds good, Tuesday?");
    expect(stripQuoted("Me interesa.\n\nEl lun, 5 oct 2026 a las 10:30, Iker (<i@x.com>) escribió:\n> Hola")).toBe("Me interesa.");
    expect(stripQuoted("Call me\n\n-----Original Message-----\nFrom: Iker")).toBe("Call me");
    expect(stripQuoted("Yes\n> quoted line\nThanks")).toBe("Yes\nThanks");
  });
});

describe("classifyByRules", () => {
  it("detects bounces from the sender or headers", () => {
    expect(classifyByRules(msg({ From: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>", Subject: "Delivery Status Notification (Failure)" }), "")).toBe("bounce");
    expect(classifyByRules(msg({ From: "postmaster@outlook.com", Subject: "Undeliverable: Hi" }), "")).toBe("bounce");
    expect(classifyByRules(msg({ From: "a@b.com", "X-Failed-Recipients": "x@y.com" }), "")).toBe("bounce");
  });

  it("detects auto-replies from headers and subjects in several languages", () => {
    expect(classifyByRules(msg({ From: "pia@slalom.example", "Auto-Submitted": "auto-replied" }), "I'm away")).toBe("out_of_office");
    expect(classifyByRules(msg({ From: "pia@slalom.example", Subject: "Respuesta automática: Re: Hola" }), "")).toBe("out_of_office");
    expect(classifyByRules(msg({ From: "pia@slalom.example", Subject: "Automatic reply: Quick question" }), "")).toBe("out_of_office");
    expect(classifyByRules(msg({ From: "pia@slalom.example", "Auto-Submitted": "no" }), "Sure!")).toBeNull();
  });

  it("doesn't mistake our own subject's wording for an auto-reply", () => {
    const reply = msg({ From: "pia@slalom.example", Subject: "Re: Vacation rentals for Slalom" });
    expect(classifyByRules(reply, "Tell me more", "Vacation rentals for Slalom")).toBeNull();
    expect(classifyByRules(reply, "Tell me more")).toBe("out_of_office");
  });

  it("detects short unsubscribe requests but not long conversations", () => {
    expect(classifyByRules(msg({ From: "a@b.com" }), "Please remove me from your list")).toBe("unsubscribe");
    expect(classifyByRules(msg({ From: "a@b.com" }), "Por favor, darme de baja.")).toBe("unsubscribe");
    expect(classifyByRules(msg({ From: "a@b.com" }), "Interesting! Let's talk Tuesday.")).toBeNull();
    const long = `Thanks for reaching out. ${"We already use a tool for this and we're happy with it. ".repeat(5)} If that changes I'll unsubscribe from them and call you.`;
    expect(classifyByRules(msg({ From: "a@b.com" }), long)).toBeNull();
  });
});
