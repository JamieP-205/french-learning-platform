import { describe, expect, it } from "vitest";
import { advanceStreak } from "../lib/learning/streak";

describe("streak advancement", () => {
  it("starts a streak on the first completed session", () => {
    expect(advanceStreak({ currentStreak: 0, streakFreezes: 0 }, new Date("2026-07-01T18:00:00Z"))).toMatchObject({
      currentStreak: 1,
      streakFreezes: 0,
      usedFreeze: false,
      earnedFreeze: false,
    });
  });

  it("does not inflate the streak for extra sessions on the same day", () => {
    expect(
      advanceStreak(
        { currentStreak: 3, streakFreezes: 0, lastCompletedAt: "2026-07-01T08:00:00.000Z" },
        new Date("2026-07-01T18:00:00Z"),
      ),
    ).toMatchObject({ currentStreak: 3, streakFreezes: 0, usedFreeze: false });
  });

  it("does not inflate a London streak when UTC crosses midnight first", () => {
    expect(
      advanceStreak(
        {
          currentStreak: 3,
          streakFreezes: 0,
          lastCompletedAt: "2026-07-18T23:30:00.000Z",
          timeZone: "Europe/London",
        },
        new Date("2026-07-19T00:30:00.000Z"),
      ),
    ).toMatchObject({ currentStreak: 3, streakFreezes: 0, usedFreeze: false });
  });

  it("advances on the next New York day across the spring DST change", () => {
    expect(
      advanceStreak(
        {
          currentStreak: 3,
          streakFreezes: 0,
          lastCompletedAt: "2026-03-08T04:30:00.000Z",
          timeZone: "America/New_York",
        },
        new Date("2026-03-08T07:30:00.000Z"),
      ),
    ).toMatchObject({ currentStreak: 4, streakFreezes: 0, usedFreeze: false });
  });

  it("earns a freeze every seven-day run up to the cap", () => {
    expect(
      advanceStreak(
        { currentStreak: 6, streakFreezes: 0, lastCompletedAt: "2026-07-06T08:00:00.000Z" },
        new Date("2026-07-07T08:00:00Z"),
      ),
    ).toMatchObject({ currentStreak: 7, streakFreezes: 1, earnedFreeze: true });
  });

  it("spends one freeze to absorb a single missed day", () => {
    expect(
      advanceStreak(
        { currentStreak: 7, streakFreezes: 1, lastCompletedAt: "2026-07-01T08:00:00.000Z" },
        new Date("2026-07-03T08:00:00Z"),
      ),
    ).toMatchObject({ currentStreak: 8, streakFreezes: 0, usedFreeze: true });
  });

  it("restarts after a longer gap without available freezes", () => {
    expect(
      advanceStreak(
        { currentStreak: 7, streakFreezes: 0, lastCompletedAt: "2026-07-01T08:00:00.000Z" },
        new Date("2026-07-04T08:00:00Z"),
      ),
    ).toMatchObject({ currentStreak: 1, streakFreezes: 0, usedFreeze: false });
  });
});
