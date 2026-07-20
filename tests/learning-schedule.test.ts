import { describe, expect, it } from "vitest";
import {
  learningScheduleCalendar,
  nextScheduledSession,
  normalizeLearningSchedule,
} from "../lib/schedule/learning-schedule";

describe("learning schedule", () => {
  it("finds the next selected local practice time", () => {
    const next = nextScheduledSession(
      { enabled: true, days: [1, 3, 5], time: "18:00" },
      new Date("2026-07-20T19:00:00"),
    );
    expect(next?.getDay()).toBe(3);
    expect(next?.getHours()).toBe(18);
  });

  it("normalizes invalid saved values", () => {
    expect(normalizeLearningSchedule({ enabled: true, days: [-1, 1, 1, 9], time: "99:99" })).toEqual({
      enabled: true,
      days: [1],
      time: "18:00",
    });
  });

  it("builds a weekly calendar reminder with an alarm", () => {
    const calendar = learningScheduleCalendar(
      { enabled: true, days: [1, 3], time: "18:00" },
      new Date("2026-07-20T09:00:00"),
    );
    expect(calendar).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE");
    expect(calendar).toContain("BEGIN:VALARM");
    expect(calendar).toContain("TRIGGER:-PT10M");
  });
});
