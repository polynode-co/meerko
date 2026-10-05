export interface SendWindow {
  /** IANA timezone, e.g. "Europe/Madrid". */
  timezone: string;
  /** Local hours [start, end) on weekdays. */
  startHour: number;
  endHour: number;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const STEP_MS = 15 * 60_000;

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function localParts(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: WEEKDAY[get("weekday")] ?? 0, hour: Number(get("hour")) };
}

export function inWindow(at: Date, w: SendWindow) {
  const { weekday, hour } = localParts(at, w.timezone);
  return weekday >= 1 && weekday <= 5 && hour >= w.startHour && hour < w.endHour;
}

/**
 * The first moment at or after `from` inside the window. Walks forward in 15-minute steps, which
 * stays correct across DST changes without date math; a week is at most ~670 steps.
 */
export function nextWindowStart(from: Date, w: SendWindow): Date {
  if (inWindow(from, w)) return from;
  // Align to the quarter hour so windows open at e.g. 09:00, not 09:07.
  let t = Math.ceil(from.getTime() / STEP_MS) * STEP_MS;
  for (let i = 0; i < 8 * 24 * 4; i++, t += STEP_MS) {
    if (inWindow(new Date(t), w)) return new Date(t);
  }
  throw new Error(`Send window ${w.startHour}-${w.endHour} in ${w.timezone} never opens`);
}
