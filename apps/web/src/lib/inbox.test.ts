import { describe, expect, it } from "vitest";
import type { Reply } from "@meerko/sdk";
import { conversations, needYouCount, preview, splitQuoted } from "./inbox";

describe("preview", () => {
  it("shows what the person wrote, without quoted history or signature", () => {
    expect(preview("Sounds good, Tuesday?\n\nOn Mon, 5 Oct 2026 at 10:30, Iker <i@x.com> wrote:\n> Hi Pia")).toBe("Sounds good, Tuesday?");
    expect(preview("Happy to talk.\n-- \nPia Moll, Head of Sales\nlinkedin.com/in/pia")).toBe("Happy to talk.");
    // The delimiter and the name on one line.
    expect(preview("Happy to talk.\n-- Pia Moll, Head of Sales, LinkedIn")).toBe("Happy to talk.");
    expect(preview("Yes please\n\nSent from my iPhone")).toBe("Yes please");
  });

  it("never shows a signature: the delimiter ends the message", () => {
    // Seen on prd: a fresh email whose words are its subject, and whose body is only a signature.
    const sig = "-- \nPia Moll, (she/her)\n\nHead of Sales\n\nLinkedIn: linkedin.com/in/pia\nGitHub: github.com/pia";
    expect(preview(sig, "test")).toBe("test");
    expect(preview(sig.replace("-- \n", "--\n"), "test")).toBe("test");
    expect(preview(`test\n--\n${sig.slice(4)}`)).toBe("test");
    expect(preview("\n-- Pia Moll, Head of Sales, LinkedIn")).toBeNull();
    // Our own subject in a "Re:" isn't what they wrote.
    expect(preview(sig, "Re: Quick question, Pia")).toBeNull();
    // Text written under ">" lines still counts; a signature after the quote doesn't.
    expect(preview("> Worth a call?\n\nYes, Tuesday.")).toBe("Yes, Tuesday.");
    expect(preview("> Worth a call?\n\n-- \nPia")).toBeNull();
  });

  it("never shows the quoted earlier email as what they wrote", () => {
    expect(preview("On Mon, 5 Oct 2026 at 10:30, Iker <i@x.com> wrote:\nHi Pia, worth a call?")).toBeNull();
    expect(preview("> Hi Pia\n> Worth a call?")).toBeNull();
  });

  it("is null for an empty body, so the list never shows an empty quote", () => {
    expect(preview("")).toBeNull();
    expect(preview("  \n\n ")).toBeNull();
  });
});

describe("splitQuoted", () => {
  it("folds a one-line signature away", () => {
    expect(splitQuoted("Happy to talk.\n-- Pia Moll, LinkedIn")).toEqual({ text: "Happy to talk.", quoted: "-- Pia Moll, LinkedIn" });
  });

  it("gives a signature-only body no text of its own, the signature folded", () => {
    expect(splitQuoted("-- \nPia Moll\nHead of Sales")).toEqual({ text: "", quoted: "-- \nPia Moll\nHead of Sales" });
    // A cut that isn't a signature still never hides everything.
    expect(splitQuoted("> Hi Pia")).toEqual({ text: "> Hi Pia", quoted: "" });
  });
});

const reply = (id: string, thread: string, o: Partial<Reply> = {}): Reply =>
  ({
    id,
    from: `${thread}@a.example`,
    subject: "Re: hi",
    body: "Tell me more",
    intent: null,
    receivedAt: `2026-11-25T10:0${id.length}:00.000Z`,
    handledAt: null,
    enrollmentId: null,
    sequenceId: null,
    sequenceName: null,
    row: null,
    thread: [{ id: `${thread}-first`, direction: "out", step: 0, subject: "hi", body: "hi", sentAt: "2026-11-24T10:00:00.000Z" }],
    ...o,
  }) as Reply;

describe("needYouCount", () => {
  it("counts conversations, not replies: two replies in one thread are one", () => {
    const replies = [reply("a", "pia"), reply("bb", "pia"), reply("c", "jon"), reply("d", "eva")];
    expect(needYouCount(replies)).toBe(3);
    expect(needYouCount(replies)).toBe(conversations(replies, []).length);
  });

  it("does not count a conversation nobody has to answer", () => {
    expect(needYouCount([reply("a", "pia"), reply("b", "jon", { handledAt: "2026-11-25T11:00:00.000Z" })])).toBe(1);
  });
});
