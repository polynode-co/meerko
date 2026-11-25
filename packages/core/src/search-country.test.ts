import { describe, expect, it } from "vitest";
import { checkLocation, closestCountry, countryCode } from "./countries.ts";
import type { IcypeasClient } from "./enrichment/icypeas.ts";
import { countLeads, expandCountryCodes, locationChecks } from "./search.ts";

describe("expandCountryCodes", () => {
  it("swaps alpha-2 codes in location filters for country names", () => {
    const q = expandCountryCodes({
      location: { include: ["ES"], exclude: ["Madrid"] },
      "currentCompany.location": { include: ["us"] },
      currentJobTitle: { include: ["CTO"] },
    });
    expect(q.location).toMatchObject({ exclude: ["Madrid"] });
    expect((q.location as { include: string[] }).include).toEqual(expect.arrayContaining(["Spain", "España"]));
    expect((q.location as { include: string[] }).include).not.toContain("ES");
    expect((q["currentCompany.location"] as { include: string[] }).include).toContain("United States");
    expect(q.currentJobTitle).toEqual({ include: ["CTO"] });
  });

  it("searches a country typed as a name the same as its code", () => {
    const byCode = expandCountryCodes({ location: { include: ["ES"] } });
    for (const name of ["Spain", "spain", "España", "espana", " Spain "]) expect(expandCountryCodes({ location: { include: [name] } })).toEqual(byCode);
    expect(expandCountryCodes({ location: { include: ["UK"] } })).toEqual(expandCountryCodes({ location: { include: ["GB"] } }));
  });

  it("leaves cities, regions and typos as text", () => {
    expect(expandCountryCodes({ location: { include: ["Madrid", "Spian", "England"] } })).toEqual({ location: { include: ["Madrid", "Spian", "England"] } });
  });
});

describe("countryCode", () => {
  it.each([
    ["ES", "ES"],
    ["es", "ES"],
    ["Spain", "ES"],
    ["España", "ES"],
    ["Espagne", "ES"],
    ["United States", "US"],
    ["USA", "US"],
    ["UK", "GB"],
    ["United Kingdom", "GB"],
    ["Great Britain", "GB"],
    ["Deutschland", "DE"],
    ["Turkey", "TR"],
    ["Türkiye", "TR"],
    ["Czech Republic", "CZ"],
  ])("%s → %s", (value, code) => expect(countryCode(value)).toBe(code));

  it.each(["Madrid", "Spian", "England", "ZZ", "EU", "QQ", ""])("%s isn't a country", (value) => expect(countryCode(value)).toBeNull());
});

describe("closestCountry", () => {
  it("catches one-typo country names", () => {
    expect(closestCountry("Spian")).toBe("ES");
    expect(closestCountry("Germnay")).toBe("DE");
    expect(closestCountry("Untied States")).toBe("US");
  });

  it("doesn't take cities for countries", () => {
    for (const city of ["Berlin", "Madrid", "London", "Paris", "Lisbon", "Barcelona"]) expect(closestCountry(city)).toBeNull();
  });
});

describe("countLeads", () => {
  it("counts a country typed as a name like its code, and says how each location was read", async () => {
    const seen: unknown[] = [];
    const icypeas = { countPeople: async (q: unknown) => (seen.push(q), 479) } as unknown as IcypeasClient;
    const res = await countLeads(icypeas, "people", { location: { include: ["Spain", "Spian"] } });
    expect(res).toEqual({ total: 479, locations: [{ value: "Spain", country: "ES" }, { value: "Spian", country: null, suggestion: "ES" }] });
    expect((seen[0] as { location: { include: string[] } }).location.include).toEqual(expect.arrayContaining(["Spain", "España", "Spian"]));
  });
});

describe("locationChecks", () => {
  it("reports each location value once, with what it resolved to", () => {
    expect(
      locationChecks({
        location: { include: ["Spain", "Spian", "Madrid"], exclude: ["spain"] },
        "currentCompany.location": { include: ["Spain"] },
        currentJobTitle: { include: ["CTO"] },
      }),
    ).toEqual([
      { value: "Spain", country: "ES" },
      { value: "Spian", country: null, suggestion: "ES" },
      { value: "Madrid", country: null },
      { value: "spain", country: "ES" },
    ]);
    expect(checkLocation("ES")).toEqual({ value: "ES", country: "ES" });
  });
});
