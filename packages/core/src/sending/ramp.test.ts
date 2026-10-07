import { describe, expect, it } from "vitest";
import { RAMP_DAYS, rampState } from "./ramp.ts";

const DAY = 24 * 60 * 60_000;
const start = new Date("2026-10-01T09:00:00Z");
const at = (days: number) => new Date(start.getTime() + days * DAY);

describe("rampState", () => {
  it("uses the full limit when the mailbox isn't ramping", () => {
    expect(rampState({ dailyLimit: 50, rampStartedAt: null })).toEqual({ effectiveLimit: 50, rampDay: null });
  });

  it("grows from 10 a day to the limit over the ramp", () => {
    expect(rampState({ dailyLimit: 50, rampStartedAt: start }, at(0))).toEqual({ effectiveLimit: 10, rampDay: 1 });
    expect(rampState({ dailyLimit: 50, rampStartedAt: start }, at(5.5))).toEqual({ effectiveLimit: 20, rampDay: 6 });
    expect(rampState({ dailyLimit: 50, rampStartedAt: start }, at(RAMP_DAYS))).toEqual({ effectiveLimit: 50, rampDay: null });
  });

  it("never ramps above a low limit", () => {
    expect(rampState({ dailyLimit: 8, rampStartedAt: start }, at(1))).toEqual({ effectiveLimit: 8, rampDay: null });
  });
});
