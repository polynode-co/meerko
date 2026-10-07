import { describe, expect, it } from "vitest";
import { checkDomainHealth } from "./domain-health.ts";

const dns = (records: Record<string, string[]>) => async (name: string) => {
  if (!records[name]) throw Object.assign(new Error("ENODATA"), { code: "ENODATA" });
  return records[name].map((r) => [r]);
};

describe("checkDomainHealth", () => {
  it("passes a fully set up Google Workspace domain", async () => {
    const resolve = dns({
      "acme.com": ["v=spf1 include:_spf.google.com ~all", "google-site-verification=x"],
      "google._domainkey.acme.com": ["v=DKIM1; k=rsa; p=MIIBIjANBg"],
      "_dmarc.acme.com": ["v=DMARC1; p=none; rua=mailto:d@acme.com"],
    });
    expect(await checkDomainHealth("Acme.com", resolve)).toEqual({ domain: "acme.com", spf: "pass", dkim: "pass", dmarc: "pass" });
  });

  it("reports what's missing", async () => {
    const resolve = dns({ "getacme.io": ["v=spf1 include:_spf.google.com ~all"] });
    expect(await checkDomainHealth("getacme.io", resolve)).toMatchObject({ spf: "pass", dkim: "missing", dmarc: "missing" });
  });

  it("treats a revoked DKIM key (empty p=) as missing", async () => {
    const resolve = dns({ "google._domainkey.x.io": ["v=DKIM1; p="] });
    expect((await checkDomainHealth("x.io", resolve)).dkim).toBe("missing");
  });

  it("leaves consumer Gmail to Google", async () => {
    expect(await checkDomainHealth("gmail.com", dns({}))).toEqual({ domain: "gmail.com", spf: "managed", dkim: "managed", dmarc: "managed" });
  });
});
