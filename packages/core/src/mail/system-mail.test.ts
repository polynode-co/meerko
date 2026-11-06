import { describe, expect, it } from "vitest";
import { heloName } from "./system-mail.ts";

describe("heloName", () => {
  it("takes the sender's domain", () => {
    expect(heloName("Meerko <noreply@meerko.ai>")).toBe("meerko.ai");
    expect(heloName("noreply@Mail.Example.com")).toBe("mail.example.com");
    expect(heloName("no address")).toBeUndefined();
  });
});
