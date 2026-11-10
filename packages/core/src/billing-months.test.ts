import { describe, expect, it } from "vitest";
import { addMonths } from "./billing.ts";

describe("addMonths", () => {
  it("adds calendar months, clamped to the last day", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2028-01-31T10:00:00Z"), 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 11).toISOString()).toBe("2027-02-15T00:00:00.000Z");
    expect(addMonths(new Date("2026-11-30T00:00:00Z"), 12).toISOString()).toBe("2027-11-30T00:00:00.000Z");
  });
});
