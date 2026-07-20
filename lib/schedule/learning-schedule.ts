export const learningScheduleStorageKey = "french-for-life:learning-schedule:v1";

export type LearningSchedule = {
  enabled: boolean;
  days: number[];
  time: string;
};

export const defaultLearningSchedule: LearningSchedule = {
  enabled: false,
  days: [1, 3, 5],
  time: "18:00",
};

const dayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export function normalizeLearningSchedule(value: unknown): LearningSchedule {
  if (!value || typeof value !== "object") return defaultLearningSchedule;
  const candidate = value as Partial<LearningSchedule>;
  const days = Array.isArray(candidate.days)
    ? [...new Set(candidate.days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : defaultLearningSchedule.days;
  const time = typeof candidate.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.time)
    ? candidate.time
    : defaultLearningSchedule.time;
  return {
    enabled: candidate.enabled === true,
    days: days.length > 0 ? days : defaultLearningSchedule.days,
    time,
  };
}

export function nextScheduledSession(schedule: LearningSchedule, now = new Date()) {
  if (!schedule.enabled || schedule.days.length === 0) return undefined;
  const [hours, minutes] = schedule.time.split(":").map(Number);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + dayOffset);
    candidate.setHours(hours, minutes, 0, 0);
    if (schedule.days.includes(candidate.getDay()) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  return undefined;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function calendarTimestamp(date: Date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    pad(date.getMinutes()),
    "00",
  ].join("");
}

function utcCalendarTimestamp(date: Date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

export function learningScheduleCalendar(schedule: LearningSchedule, now = new Date()) {
  const firstSession = nextScheduledSession({ ...schedule, enabled: true }, now);
  if (!firstSession) return "";
  const endsAt = new Date(firstSession.getTime() + 15 * 60 * 1000);
  const byDay = schedule.days.map((day) => dayCodes[day]).join(",");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//French for Life//Learning schedule//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:french-for-life-${calendarTimestamp(firstSession)}@french-for-life`,
    `DTSTAMP:${utcCalendarTimestamp(now)}`,
    `DTSTART:${calendarTimestamp(firstSession)}`,
    `DTEND:${calendarTimestamp(endsAt)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`,
    "SUMMARY:French for Life practice",
    "DESCRIPTION:A short practical French session. Open https://french-learning-platform-one.vercel.app/today",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your French practice starts in 10 minutes.",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
