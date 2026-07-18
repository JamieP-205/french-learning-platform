export const DEFAULT_TIME_ZONE = "UTC";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function isValidIanaTimeZone(value: string) {
  const candidate = value.trim();
  if (!candidate || candidate.length > 100) return false;

  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
}

export function normalizeIanaTimeZone(value?: string | null) {
  const candidate = value?.trim();
  if (!candidate || !isValidIanaTimeZone(candidate)) return DEFAULT_TIME_ZONE;

  return new Intl.DateTimeFormat("en", { timeZone: candidate }).resolvedOptions().timeZone;
}

export function detectRuntimeTimeZone() {
  try {
    return normalizeIanaTimeZone(new Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function validDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("A valid date is required.");
  return date;
}

function formatterFor(timeZone?: string) {
  const normalizedTimeZone = normalizeIanaTimeZone(timeZone);
  const existing = formatterCache.get(normalizedTimeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("en-CA-u-ca-iso8601-nu-latn", {
    timeZone: normalizedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterCache.set(normalizedTimeZone, formatter);
  return formatter;
}

export function calendarDayKey(value: Date | string, timeZone?: string) {
  const parts = formatterFor(timeZone).formatToParts(validDate(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new RangeError("The calendar day could not be resolved.");
  return `${year}-${month}-${day}`;
}

function calendarDayNumber(value: Date | string, timeZone?: string) {
  const [year, month, day] = calendarDayKey(value, timeZone).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function calendarDaysBetween(
  from: Date | string,
  to: Date | string,
  timeZone?: string,
) {
  return calendarDayNumber(to, timeZone) - calendarDayNumber(from, timeZone);
}

export function calendarDaysSince(
  value?: Date | string,
  now = new Date(),
  timeZone?: string,
) {
  if (!value) return undefined;
  return Math.max(0, calendarDaysBetween(value, now, timeZone));
}

export function isSameCalendarDay(
  left: Date | string,
  right: Date | string,
  timeZone?: string,
) {
  return calendarDayKey(left, timeZone) === calendarDayKey(right, timeZone);
}
