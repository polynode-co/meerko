import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AgentHookError, assertSafeHookUrl, isPrivateAddress, signWebhook } from "./agent-hooks.ts";

const resolveTo = (...addresses: string[]) => async () => addresses;

describe("isPrivateAddress", () => {
  it.each(["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "142.250.184.14", "2a00:1450:4003:80e::200e"])("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("assertSafeHookUrl", () => {
  it("accepts a public https URL", async () => {
    await expect(assertSafeHookUrl("https://hooks.example.com/meerko", { resolve: resolveTo("93.184.216.34") })).resolves.toBeInstanceOf(URL);
  });

  it("rejects http, private targets, cloud metadata and credentials in the URL", async () => {
    await expect(assertSafeHookUrl("http://hooks.example.com", { resolve: resolveTo("93.184.216.34") })).rejects.toThrow(/https/);
    await expect(assertSafeHookUrl("https://intranet.example.com", { resolve: resolveTo("10.1.2.3") })).rejects.toThrow(AgentHookError);
    await expect(assertSafeHookUrl("https://169.254.169.254/computeMetadata/v1/")).rejects.toThrow(/public/);
    await expect(assertSafeHookUrl("https://[::1]:8080/")).rejects.toThrow(/public/);
    // One private address among several is enough to refuse (DNS could hand out either).
    await expect(assertSafeHookUrl("https://mixed.example.com", { resolve: resolveTo("93.184.216.34", "192.168.0.5") })).rejects.toThrow(/public/);
    await expect(assertSafeHookUrl("https://user:pass@hooks.example.com", { resolve: resolveTo("93.184.216.34") })).rejects.toThrow(/credentials/);
    await expect(assertSafeHookUrl("not a url")).rejects.toThrow(/full URL/);
  });

  it("allows private and http targets when the install opts in", async () => {
    await expect(assertSafeHookUrl("http://localhost:5678/webhook/meerko", { allowPrivate: true })).resolves.toBeInstanceOf(URL);
    await expect(assertSafeHookUrl("ftp://localhost/x", { allowPrivate: true })).rejects.toThrow(AgentHookError);
  });
});

describe("signWebhook", () => {
  it("signs <t>.<body> with HMAC-SHA256, like Stripe", () => {
    const body = '{"type":"test"}';
    const header = signWebhook("whsec_abc", body, 1760000000);
    const expected = createHmac("sha256", "whsec_abc").update(`1760000000.${body}`).digest("hex");
    expect(header).toBe(`t=1760000000,v1=${expected}`);
  });
});
