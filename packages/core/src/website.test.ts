import { describe, expect, it } from "vitest";
import { extractWebsite, normalizeWebsite, readWebsite, WebsiteError } from "./website.ts";

const page = `<!doctype html><html><head><title>Acme &amp; Co — Payroll for agencies</title>
<meta name="description" content="Payroll software for creative agencies in Spain.">
<script>var x = "<h1>not me</h1>";</script><style>h1{}</style></head>
<body><h1>Payroll that agencies love</h1><h2>Built for teams of 10 to 200</h2><p>Trusted by 300&nbsp;agencies.</p></body></html>`;

const publicDns = async () => ["93.184.216.34"];
const html = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { "content-type": "text/html" }, ...init });

describe("website reading", () => {
  it("normalizes what people type", () => {
    expect(normalizeWebsite("acme.com").toString()).toBe("https://acme.com/");
    expect(normalizeWebsite(" http://www.acme.com/about#x ").toString()).toBe("https://www.acme.com/about");
    expect(() => normalizeWebsite("")).toThrow(WebsiteError);
    expect(() => normalizeWebsite("localhost")).toThrow(WebsiteError);
    expect(() => normalizeWebsite("ftp://acme.com")).toThrow(WebsiteError);
  });

  it("extracts title, description, headings and visible text", () => {
    const site = extractWebsite("https://acme.com/", page);
    expect(site.title).toBe("Acme & Co — Payroll for agencies");
    expect(site.description).toBe("Payroll software for creative agencies in Spain.");
    expect(site.headings).toEqual(["Payroll that agencies love", "Built for teams of 10 to 200"]);
    expect(site.text).toContain("Trusted by 300 agencies.");
    expect(site.text).not.toContain("not me");
    expect(site.truncated).toBe(false);
  });

  it("follows redirects and refuses private addresses", async () => {
    const fetch = (async (url: URL) =>
      url.hostname === "acme.com" ? new Response(null, { status: 301, headers: { location: "https://www.acme.com/" } }) : html(page)) as unknown as typeof globalThis.fetch;
    const site = await readWebsite("acme.com", { fetch, resolve: publicDns });
    expect(site.url).toBe("https://www.acme.com/");

    await expect(readWebsite("intranet.example", { fetch, resolve: async () => ["10.0.0.5"] })).rejects.toThrow(/public websites/);
    const toMetadata = (async () => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/" } })) as unknown as typeof globalThis.fetch;
    await expect(readWebsite("acme.com", { fetch: toMetadata, resolve: publicDns })).rejects.toThrow(/public websites/);
  });

  it("explains pages it can't read", async () => {
    const notFound = (async () => new Response("no", { status: 404 })) as unknown as typeof globalThis.fetch;
    await expect(readWebsite("acme.com", { fetch: notFound, resolve: publicDns })).rejects.toThrow(/answered 404/);
    const pdf = (async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } })) as unknown as typeof globalThis.fetch;
    await expect(readWebsite("acme.com", { fetch: pdf, resolve: publicDns })).rejects.toThrow(/isn't a web page/);
  });
});
