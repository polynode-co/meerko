import { describe, expect, it } from "vitest";
import { inWindow, isValidTimezone, nextWindowStart } from "./window.ts";

const madrid = { timezone: "Europe/Madrid", startHour: 9, endHour: 17 };

describe("send window", () => {
  it("uses the recipient's local time, weekdays only", () => {
    expect(inWindow(new Date("2026-10-05T08:30:00Z"), madrid)).toBe(true); // Mon 10:30 CEST
    expect(inWindow(new Date("2026-10-05T06:30:00Z"), madrid)).toBe(false); // Mon 08:30
    expect(inWindow(new Date("2026-10-05T15:00:00Z"), madrid)).toBe(false); // Mon 17:00, end is exclusive
    expect(inWindow(new Date("2026-10-10T10:00:00Z"), madrid)).toBe(false); // Saturday
  });

  it("finds the next opening, skipping the weekend", () => {
    expect(nextWindowStart(new Date("2026-10-05T20:00:00Z"), madrid).toISOString()).toBe("2026-10-06T07:00:00.000Z"); // Tue 09:00
    expect(nextWindowStart(new Date("2026-10-09T16:00:00Z"), madrid).toISOString()).toBe("2026-10-12T07:00:00.000Z"); // Fri evening -> Mon
    const inside = new Date("2026-10-05T08:30:00Z");
    expect(nextWindowStart(inside, madrid)).toBe(inside);
  });

  it("handles the DST change (Madrid goes to UTC+1 on 2026-10-25)", () => {
    expect(nextWindowStart(new Date("2026-10-24T20:00:00Z"), madrid).toISOString()).toBe("2026-10-26T08:00:00.000Z"); // Mon 09:00 CET
  });

  it("validates timezones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });
});
