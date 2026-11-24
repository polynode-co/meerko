import { describe, expect, it } from "vitest";
import { tickBudget } from "./tick-budget.ts";

function fakeClock() {
  let t = 1_000;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

describe("tickBudget", () => {
  it("records each step's duration", async () => {
    const clock = fakeClock();
    const b = tickBudget(120_000, clock.now);
    await b.step("replies", async () => clock.advance(40_000));
    await b.step("send", async () => clock.advance(2_000));
    expect(b.durations).toEqual({ replies: 40_000, send: 2_000 });
    expect(b.elapsed()).toBe(42_000);
    expect(b.skipped).toEqual([]);
  });

  it("skips a step once its share of the budget has passed, and still times the ones that run", async () => {
    const clock = fakeClock();
    const b = tickBudget(120_000, clock.now);
    await b.step("replies", async () => clock.advance(95_000));
    expect(await b.step("digest", async () => "ran", { skipAfter: 90_000 })).toBeUndefined();
    expect(await b.step("send", async () => "sent")).toBe("sent");
    expect(b.skipped).toEqual(["digest"]);
    expect(Object.keys(b.durations)).toEqual(["replies", "send"]);
  });

  it("stopAt turns true at its mark, never without a budget", () => {
    const clock = fakeClock();
    const b = tickBudget(120_000, clock.now);
    const stop = b.stopAt(60_000);
    expect(stop()).toBe(false);
    clock.advance(60_000);
    expect(stop()).toBe(true);
    const none = tickBudget(undefined, clock.now);
    clock.advance(10 ** 9);
    expect(none.stopAt(1)()).toBe(false);
  });

  it("records a failed step's duration and rethrows", async () => {
    const clock = fakeClock();
    const b = tickBudget(120_000, clock.now);
    await expect(
      b.step("crm", async () => {
        clock.advance(5_000);
        throw new Error("down");
      }),
    ).rejects.toThrow("down");
    expect(b.durations).toEqual({ crm: 5_000 });
  });
});
