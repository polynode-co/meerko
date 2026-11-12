import { describe, expect, it } from "vitest";
import { mailboxLimitText } from "./billing.ts";

describe("mailboxLimitText", () => {
  it("names the mailbox when it is in this workspace", () => {
    const text = mailboxLimitText(1, [{ email: "a@x.com", workspaceId: "w1", workspaceName: "Acme" }], "w1");
    expect(text).toContain("a@x.com already uses it");
    expect(text).toContain("Disconnect it to connect another; the Pro plan");
  });

  it("names only the other workspace, not its mailbox", () => {
    const text = mailboxLimitText(1, [{ email: "a@x.com", workspaceId: "w1", workspaceName: "Acme" }], "w2");
    expect(text).not.toContain("a@x.com");
    expect(text).toContain('your "Acme" workspace');
    expect(text).toContain("Disconnect it there");
  });
});
