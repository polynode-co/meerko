import { describe, expect, it } from "vitest";
import { scoreRow, type Icp } from "./icp.ts";

const icp: Icp = {
  industries: ["Retail Apparel and Fashion", "Wellness and Fitness Services"],
  countries: ["US", "ES"],
  headcount: { min: 1, max: 10 },
  titles: ["Founder", "Owner", "Propietaria"],
  keywords: ["instagram"],
  exclude: ["laundry"],
};

describe("ICP fit", () => {
  it("is blank without an ICP", () => {
    expect(scoreRow(null, { industry: "Software" }).score).toBeNull();
  });

  it("scores a perfect person at 100 and explains it", () => {
    const fit = scoreRow(icp, { title: "Founder - CEO", industry: "Wellness and Fitness Services", company_size: 2, location: "Chicago, United States", description: "Follow us on Instagram" });
    expect(fit.score).toBe(100);
    expect(fit.checks.map((c) => c.criterion)).toEqual(["industry", "title", "headcount", "country", "keywords"]);
    expect(fit.checks.every((c) => c.matched)).toBe(true);
    expect(fit.reason).toBe("Founder - CEO · Wellness and Fitness Services · 2 people · US · mentions instagram");
  });

  it("only counts what the row has: a company row isn't marked down for having no title", () => {
    const fit = scoreRow(icp, { industry: "Retail Apparel and Fashion", employees: 8, location: "Portland, OR, United States of America" });
    expect(fit.checks.map((c) => c.criterion)).toEqual(["industry", "headcount", "country"]);
    expect(fit.score).toBe(100);
  });

  it("reads country names in other languages and accents", () => {
    expect(scoreRow({ countries: ["ES"] }, { location: "Madrid, Communauté de Madrid, Espagne" }).score).toBe(100);
    expect(scoreRow({ countries: ["ES"] }, { location: "Aspe, Alicante, España" }).score).toBe(100);
    expect(scoreRow({ countries: ["GB"] }, { location: "London, United Kingdom" }).score).toBe(100);
    expect(scoreRow({ countries: ["US"] }, { location: "Berlin, Germany" }).score).toBe(0);
  });

  it("weights the misses: wrong title and size", () => {
    const fit = scoreRow(icp, { title: "Influencer Marketing", industry: "Retail Apparel and Fashion", company_size: 40, location: "Madrid, Spain" });
    // industry 30 + country 15 of industry 30, title 25, size 20, country 15 = 45/90
    expect(fit.score).toBe(50);
    expect(fit.reason).toBe('Retail Apparel and Fashion · ES · "Influencer Marketing" isn\'t a buyer title · 40 people, you want 1–10');
  });

  it("caps an excluded lead at 10, and the agent's adjustment moves it within 0-100", () => {
    const denim = { company: "Indigo Wash Laundry Inc", industry: "Retail Apparel and Fashion", employees: 2, location: "Los Angeles, CA, United States" };
    expect(scoreRow(icp, denim).score).toBe(10);
    expect(scoreRow(icp, denim).reason).toBe('Ruled out: mentions "laundry"');
    expect(scoreRow({ industries: ["Retail Apparel and Fashion"] }, denim, { adjust: -30, note: "a factory, not a brand" })).toMatchObject({ score: 70, base: 100, adjust: -30, reason: "a factory, not a brand" });
    expect(scoreRow({ industries: ["Retail Apparel and Fashion"] }, denim, { adjust: 30, note: null }).score).toBe(100);
  });
});
