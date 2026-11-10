import { describe, expect, it } from "vitest";
import { CadenceError, describeCadence, dueInstants, nextDueAfter, validateCadence, zonedTimeToUtc } from "./cadence.ts";

const iso = (ms: number[]) => ms.map((m) => new Date(m).toISOString());

describe("validateCadence", () => {
  it("sorts and dedupes days", () => {
    expect(validateCadence({ days: [5, 1, 1], time: "09:30", timezone: "Europe/Madrid" })).toEqual({ days: [1, 5], time: "09:30", timezone: "Europe/Madrid" });
  });
  it.each([
    [{ days: [1], time: "9:00", timezone: "UTC" }, /HH:MM/],
    [{ days: [1], time: "24:00", timezone: "UTC" }, /HH:MM/],
    [{ days: [1], time: "09:00", timezone: "Mars/Olympus" }, /IANA/],
    [{ days: [], time: "09:00", timezone: "UTC" }, /weekdays/],
    [{ days: [0], time: "09:00", timezone: "UTC" }, /weekdays/],
    [null, /cadence/],
  ])("refuses %j", (raw, message) => expect(() => validateCadence(raw)).toThrow(message));
  it("throws CadenceError", () => expect(() => validateCadence({})).toThrow(CadenceError));
});

describe("dueInstants", () => {
  const madrid = { days: [1, 2, 3, 4, 5], time: "09:00", timezone: "Europe/Madrid" };

  it("lists weekdays at the local time, skipping the weekend", () => {
    // Fri 2026-11-06 00:00Z to Tue 2026-11-10 23:59Z; Madrid is UTC+1 in November.
    const from = Date.parse("2026-11-06T00:00:00Z");
    const until = Date.parse("2026-11-10T23:59:00Z");
    expect(iso(dueInstants(madrid, from, until))).toEqual(["2026-11-06T08:00:00.000Z", "2026-11-09T08:00:00.000Z", "2026-11-10T08:00:00.000Z"]);
  });

  it("is exclusive of `from` and inclusive of `until`", () => {
    const at = Date.parse("2026-11-09T08:00:00Z");
    expect(dueInstants(madrid, at, at + 1000)).toEqual([]);
    expect(dueInstants(madrid, at - 1000, at)).toEqual([at]);
  });

  it("keeps 09:00 local across the daylight-saving change", () => {
    // Madrid moves from UTC+2 to UTC+1 on Sunday 2026-10-25.
    const due = dueInstants(madrid, Date.parse("2026-10-22T00:00:00Z"), Date.parse("2026-10-27T00:00:00Z"));
    expect(iso(due)).toEqual(["2026-10-22T07:00:00.000Z", "2026-10-23T07:00:00.000Z", "2026-10-26T08:00:00.000Z"]);
  });

  it("handles zones east of UTC whose local day starts the previous UTC day", () => {
    const tokyo = { days: [1], time: "07:00", timezone: "Asia/Tokyo" };
    // Monday 07:00 in Tokyo is Sunday 22:00 UTC.
    expect(iso(dueInstants(tokyo, Date.parse("2026-11-08T00:00:00Z"), Date.parse("2026-11-09T00:00:00Z")))).toEqual(["2026-11-08T22:00:00.000Z"]);
  });

  it("finds the next run within a week", () => {
    expect(new Date(nextDueAfter({ days: [3], time: "18:15", timezone: "UTC" }, Date.parse("2026-11-05T00:00:00Z"))!).toISOString()).toBe("2026-11-11T18:15:00.000Z");
  });
});

describe("zonedTimeToUtc", () => {
  it("converts a wall-clock time", () => {
    expect(new Date(zonedTimeToUtc(2026, 7, 1, 9, 0, "America/New_York")).toISOString()).toBe("2026-07-01T13:00:00.000Z");
  });
});

describe("describeCadence", () => {
  it("names common day sets", () => {
    expect(describeCadence({ days: [1, 2, 3, 4, 5], time: "09:00", timezone: "Europe/Madrid" })).toBe("Weekdays at 09:00 (Europe/Madrid)");
    expect(describeCadence({ days: [1, 2, 3, 4, 5, 6, 7], time: "07:30", timezone: "UTC" })).toBe("Every day at 07:30 (UTC)");
    expect(describeCadence({ days: [1, 4], time: "07:30", timezone: "UTC" })).toBe("Mon, Thu at 07:30 (UTC)");
  });
});
