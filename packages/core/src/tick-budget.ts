/**
 * The time budget of one worker tick. Cloud Scheduler gives `/internal/tick` 180s before it records the call as
 * failed, so the tick stops starting new work once its budget is spent and leaves the rest to the next tick (a minute
 * later). Every step's duration is recorded, so a slow step shows in the tick's log line.
 */
export interface TickBudget {
  /** A `stop()` for a step's loop: true once `ms` have passed since the tick started (never with no budget). */
  stopAt(ms: number): () => boolean;
  /** Runs one step and records how long it took, unless `skipAfter` ms have already passed (then: undefined). */
  step<T>(name: string, fn: () => Promise<T>, opts?: { skipAfter?: number }): Promise<T | undefined>;
  /** Milliseconds per step that ran, in the order they ran. */
  readonly durations: Record<string, number>;
  /** Steps left for the next tick because the budget was spent. */
  readonly skipped: string[];
  elapsed(): number;
}

/** The tick's budget on Meerko Cloud: well inside Cloud Scheduler's 180s attempt deadline. */
export const TICK_BUDGET_MS = 120_000;

export function tickBudget(budgetMs: number | undefined, clock: () => number = Date.now): TickBudget {
  const start = clock();
  const elapsed = () => clock() - start;
  const over = (ms: number | undefined) => budgetMs !== undefined && ms !== undefined && elapsed() >= ms;
  const durations: Record<string, number> = {};
  const skipped: string[] = [];
  return {
    durations,
    skipped,
    elapsed,
    stopAt: (ms) => () => over(ms),
    async step(name, fn, opts) {
      if (over(opts?.skipAfter)) {
        skipped.push(name);
        return undefined;
      }
      const began = clock();
      try {
        return await fn();
      } finally {
        durations[name] = clock() - began;
      }
    },
  };
}
