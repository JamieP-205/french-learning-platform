import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_ZONE,
  calendarDayKey,
  calendarDaysBetween,
  isSameCalendarDay,
  isValidIanaTimeZone,
  normalizeIanaTimeZone,
} from "../lib/time/calendar-day";

describe("calendar-day time zones", () => {
  it("normalizes supported IANA zones and safely falls back to UTC", () => {
    expect(isValidIanaTimeZone("Europe/London")).toBe(true);
    expect(normalizeIanaTimeZone(" Europe/London ")).toBe("Europe/London");
    expect(isValidIanaTimeZone("Not/A_Time_Zone")).toBe(false);
    expect(normalizeIanaTimeZone("Not/A_Time_Zone")).toBe(DEFAULT_TIME_ZONE);
    expect(normalizeIanaTimeZone()).toBe(DEFAULT_TIME_ZONE);
  });

  it("treats a UTC date change as the same summer day in London", () => {
    const beforeMidnightUtc = "2026-07-18T23:30:00.000Z";
    const afterMidnightUtc = "2026-07-19T00:30:00.000Z";

    expect(calendarDayKey(beforeMidnightUtc, "Europe/London")).toBe("2026-07-19");
    expect(isSameCalendarDay(beforeMidnightUtc, afterMidnightUtc, "Europe/London")).toBe(true);
    expect(calendarDaysBetween(beforeMidnightUtc, afterMidnightUtc, "Europe/London")).toBe(0);
    expect(calendarDaysBetween(beforeMidnightUtc, afterMidnightUtc, "UTC")).toBe(1);
  });

  it("counts local dates across the New York spring DST change", () => {
    const lateSaturday = "2026-03-08T04:30:00.000Z";
    const earlySunday = "2026-03-08T07:30:00.000Z";

    expect(calendarDayKey(lateSaturday, "America/New_York")).toBe("2026-03-07");
    expect(calendarDayKey(earlySunday, "America/New_York")).toBe("2026-03-08");
    expect(calendarDaysBetween(lateSaturday, earlySunday, "America/New_York")).toBe(1);
  });

  it("keeps both repeated fall-back hours on the same local day", () => {
    const firstOneThirty = "2026-11-01T05:30:00.000Z";
    const secondOneThirty = "2026-11-01T06:30:00.000Z";

    expect(isSameCalendarDay(firstOneThirty, secondOneThirty, "America/New_York")).toBe(true);
    expect(calendarDaysBetween(firstOneThirty, secondOneThirty, "America/New_York")).toBe(0);
  });
});
