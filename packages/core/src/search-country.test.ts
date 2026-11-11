import { describe, expect, it } from "vitest";
import { expandCountryCodes } from "./search.ts";

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
});
