import { describe, expect, it } from "vitest";
import { attioClient, CrmError, hubspotClient, rowToPerson } from "./crm.ts";

const person = (over: Partial<ReturnType<typeof rowToPerson> & object> = {}) => ({
  email: "ana@acme.example",
  firstName: "Ana",
  lastName: "Ruiz",
  title: "Founder",
  company: "Acme",
  domain: "acme.example",
  linkedin: "https://linkedin.com/in/ana",
  stage: "contacted" as const,
  ...over,
});

describe("rowToPerson", () => {
  it("reads the columns search writes, and needs an email", () => {
    expect(rowToPerson({ email: " Ana@Acme.Example ", first_name: "Ana", last_name: "Ruiz", title: "Founder", company: "Acme", domain: "https://www.acme.example/about", linkedin_url: "u" }, "new")).toEqual({
      email: "ana@acme.example",
      firstName: "Ana",
      lastName: "Ruiz",
      title: "Founder",
      company: "Acme",
      domain: "acme.example",
      linkedin: "u",
      stage: "new",
    });
    expect(rowToPerson({ first_name: "Ana" }, "new")).toBeNull();
    expect(rowToPerson({ email: "not an email" }, "new")).toBeNull();
  });

  it("splits a full name when there are no name columns", () => {
    const p = rowToPerson({ email: "a@b.co", name: "Ana María Ruiz" }, "new")!;
    expect([p.firstName, p.lastName]).toEqual(["Ana", "María Ruiz"]);
  });
});

describe("hubspotClient", () => {
  it("upserts by email with Lead status matched by label, and leaves empty fields out", async () => {
    const calls: { url: string; body: any }[] = [];
    const fetch = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.endsWith("/hs_lead_status")) return Response.json({ options: [{ label: "Attempted to Contact", value: "ATTEMPTED_TO_CONTACT" }] });
      return Response.json({ results: [{ id: "101", properties: { email: "ana@acme.example" } }] });
    }) as typeof globalThis.fetch;
    const res = await hubspotClient("pat", fetch).upsert([person({ title: null })]);
    expect(res.ids.get("ana@acme.example")).toBe("101");
    const upsert = calls.find((c) => c.url.endsWith("/batch/upsert"))!;
    expect(upsert.body.inputs[0]).toEqual({
      idProperty: "email",
      id: "ana@acme.example",
      properties: { email: "ana@acme.example", firstname: "Ana", lastname: "Ruiz", company: "Acme", website: "acme.example", hs_lead_status: "ATTEMPTED_TO_CONTACT" },
    });
  });

  it("still syncs without Lead status when the schema scope is missing", async () => {
    let body: any;
    const fetch = (async (url: string, init: RequestInit = {}) => {
      if (url.endsWith("/hs_lead_status")) return new Response("forbidden", { status: 403 });
      body = JSON.parse(String(init.body));
      return Response.json({ results: [] });
    }) as typeof globalThis.fetch;
    await hubspotClient("pat", fetch).upsert([person()]);
    expect(body.inputs[0].properties.hs_lead_status).toBeUndefined();
  });

  it("calls a refused token an auth error", async () => {
    const fetch = (async () => new Response("no", { status: 401 })) as unknown as typeof globalThis.fetch;
    await expect(hubspotClient("bad", fetch).identify()).rejects.toMatchObject({ code: "auth" });
    await expect(hubspotClient("bad", fetch).identify()).rejects.toBeInstanceOf(CrmError);
  });
});

describe("attioClient", () => {
  it("asserts the person by email with a company matched by domain, retrying without it on a 400", async () => {
    const bodies: any[] = [];
    const fetch = (async (_url: string, init: RequestInit = {}) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      if (body.data.values.company) return new Response(JSON.stringify({ message: "bad company" }), { status: 400 });
      return Response.json({ data: { id: { record_id: "rec_1" } } });
    }) as typeof globalThis.fetch;
    const res = await attioClient("key", fetch).upsert([person()]);
    expect(res.ids.get("ana@acme.example")).toBe("rec_1");
    expect(bodies).toHaveLength(2);
    expect(bodies[0].data.values.company[0].target_record_reference.match).toEqual({ domains: [{ domain: "acme.example" }] });
    expect(bodies[1].data.values).toEqual({
      email_addresses: ["ana@acme.example"],
      name: [{ first_name: "Ana", last_name: "Ruiz", full_name: "Ana Ruiz" }],
      job_title: "Founder",
      linkedin: "https://linkedin.com/in/ana",
    });
  });

  it("names the workspace from /self and rejects an inactive key", async () => {
    const ok = (async () => Response.json({ active: true, workspace_name: "Acme" })) as unknown as typeof globalThis.fetch;
    expect(await attioClient("key", ok).identify()).toEqual({ accountName: "Attio · Acme" });
    const off = (async () => Response.json({ active: false })) as unknown as typeof globalThis.fetch;
    await expect(attioClient("key", off).identify()).rejects.toMatchObject({ code: "auth" });
  });
});
