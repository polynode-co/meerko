/** A new mailbox's ramp: it starts at a few emails a day and reaches its daily limit after RAMP_DAYS. */
export const RAMP_DAYS = 21;
export const RAMP_START = 10;
const DAY_MS = 24 * 60 * 60_000;

export interface RampState {
  /** Emails this mailbox may send in the next 24 hours. */
  effectiveLimit: number;
  /** Day of the ramp (1-based), or null once ramped up (or when it never ramped). */
  rampDay: number | null;
}

/** The limit a mailbox sends at today: linear from RAMP_START to its daily limit over RAMP_DAYS. */
export function rampState(mailbox: { dailyLimit: number; rampStartedAt: Date | string | null }, now = new Date()): RampState {
  if (!mailbox.rampStartedAt) return { effectiveLimit: mailbox.dailyLimit, rampDay: null };
  const day = Math.floor((now.getTime() - new Date(mailbox.rampStartedAt).getTime()) / DAY_MS);
  if (day >= RAMP_DAYS || mailbox.dailyLimit <= RAMP_START) return { effectiveLimit: mailbox.dailyLimit, rampDay: null };
  const limit = Math.round(RAMP_START + ((mailbox.dailyLimit - RAMP_START) * Math.max(day, 0)) / RAMP_DAYS);
  return { effectiveLimit: Math.min(limit, mailbox.dailyLimit), rampDay: Math.max(day, 0) + 1 };
}
