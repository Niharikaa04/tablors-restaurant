/**
 * Calendar-day helpers for date-wise record pages. Days are YYYY-MM-DD in the
 * restaurant's time zone (India, UTC+5:30), so "today" doesn't flip at 5:30 am
 * for a server running in UTC.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function istDay(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayIst(): string {
  return istDay(Date.now());
}

export function yesterdayIst(): string {
  return istDay(Date.now() - DAY_MS);
}

/** A valid, non-future day from a ?date= param, else today. */
export function resolveDay(param: string | undefined): string {
  const today = todayIst();
  if (typeof param !== "string" || !DAY_PATTERN.test(param)) return today;
  if (Number.isNaN(Date.parse(`${param}T00:00:00Z`))) return today;
  return param > today ? today : param;
}

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
