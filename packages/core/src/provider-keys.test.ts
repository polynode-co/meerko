import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecretBox } from "./provider-keys.ts";

describe("SecretBox", () => {
  const box = new SecretBox(randomBytes(32).toString("base64"));

  it("round-trips and uses a fresh IV each time", () => {
    const a = box.encrypt("icy_secret_key");
    expect(box.decrypt(a)).toBe("icy_secret_key");
    expect(box.encrypt("icy_secret_key")).not.toBe(a);
  });

  it("rejects tampered ciphertext and wrong keys", () => {
    const stored = Buffer.from(box.encrypt("icy_secret_key"), "base64");
    stored[stored.length - 1]! ^= 1;
    expect(() => box.decrypt(stored.toString("base64"))).toThrow();
    expect(() => new SecretBox(randomBytes(32).toString("base64")).decrypt(box.encrypt("x"))).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => new SecretBox(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
