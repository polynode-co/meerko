import type { RoutineCadence } from "@meerko/db";

/**
 * When a scheduled routine is due. Pure, with no clock of its own, so the API, the tick and the tests agree on
 * every instant. Times are wall-clock in the routine's IANA zone, so 09:00 stays 09:00 across a daylight-saving
 * change.
 */

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;
const WEEKDAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export class CadenceError extends Error {}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateCadence(raw: unknown): RoutineCadence {
  if (!raw || typeof raw !== "object") throw new CadenceError("A scheduled routine needs `cadence`: {days, time, timezone}");
  const c = raw as Record<string, unknown>;
  if (typeof c.time !== "string" || !TIME.test(c.time)) throw new CadenceError("`cadence.time` must be HH:MM, 24-hour");
  if (typeof c.timezone !== "string" || !isValidTimeZone(c.timezone)) throw new CadenceError("`cadence.timezone` must be an IANA zone, e.g. Europe/Madrid");
  const days = Array.isArray(c.days) ? [...new Set(c.days)] : [];
  if (!days.length || !days.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7)) {
    throw new CadenceError("`cadence.days` must list ISO weekdays, 1 (Monday) to 7 (Sunday)");
  }
  return { days: (days as number[]).sort((a, b) => a - b), time: c.time, timezone: c.timezone };
}

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

export function zonedParts(ms: number, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: +get("year"), month: +get("month"), day: +get("day"), hour: +get("hour"), minute: +get("minute"), weekday: WEEKDAY[get("weekday")] ?? 0 };
}

/** The instant a wall-clock time in `timeZone` names. A time skipped by a DST jump lands just after the jump. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(guess, timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (shown === wanted) return guess;
    guess += wanted - shown;
  }
  return guess;
}

/** Due instants in `(from, until]`, oldest first. */
export function dueInstants(cadence: RoutineCadence, from: number, until: number): number[] {
  if (until <= from) return [];
  const [h, m] = cadence.time.split(":").map(Number) as [number, number];
  const out: number[] = [];
  // Walk local calendar days, from the day before `from` to the day after `until` (zones are up to ±14h).
  const start = zonedParts(from - DAY_MS, cadence.timezone);
  let cursor = Date.UTC(start.year, start.month - 1, start.day, 12);
  const end = until + 2 * DAY_MS;
  for (let guard = 0; cursor <= end && guard < 4000; guard++, cursor += DAY_MS) {
    const d = new Date(cursor);
    const weekday = ((d.getUTCDay() + 6) % 7) + 1;
    if (!cadence.days.includes(weekday)) continue;
    const at = zonedTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), h, m, cadence.timezone);
    if (at > from && at <= until) out.push(at);
  }
  return out;
}

export function nextDueAfter(cadence: RoutineCadence, now: number): number | null {
  return dueInstants(cadence, now, now + 8 * DAY_MS)[0] ?? null;
}

/** "Weekdays at 09:00 (Europe/Madrid)", for lists and the AI. */
export function describeCadence(cadence: RoutineCadence): string {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const key = cadence.days.join(",");
  const days = key === "1,2,3,4,5,6,7" ? "Every day" : key === "1,2,3,4,5" ? "Weekdays" : cadence.days.map((d) => names[d - 1]).join(", ");
  return `${days} at ${cadence.time} (${cadence.timezone})`;
}
