// Streak with earned freezes and no guilt mechanics, in the learner's chosen
// cadence.
// - Daily: one session per day advances it; extra sessions never inflate it.
// - Weekly: one session per calendar week (Monday start) advances it, so a
//   weekend-only learner is never punished by a daily clock.
// - Every 7 consecutive units earns a freeze (held, max 2).
// - A single missed unit is absorbed by a freeze automatically.
// - Longer gaps restart at 1; the comeback session handles the emotional part.

import { calendarDayKey, calendarDaysBetween } from "@/lib/time/calendar-day";

export const MAX_STREAK_FREEZES = 2;
export const FREEZE_EARN_INTERVAL = 7;

export type StreakMode = "daily" | "weekly";

export type StreakState = {
  currentStreak: number;
  streakFreezes: number;
  lastCompletedAt?: string;
  timeZone?: string;
};

export type StreakAdvance = StreakState & {
  usedFreeze: boolean;
  earnedFreeze: boolean;
};

// Monday-start week index of a local calendar day, so any number of sessions
// inside one week counts once, however often the timestamp refreshes.
function weekIndex(value: string | Date, timeZone?: string) {
  const dayKey = calendarDayKey(value, timeZone);
  const epochDays = Math.floor(new Date(`${dayKey}T00:00:00Z`).getTime() / 86_400_000);
  // 1970-01-01 was a Thursday; shifting by 3 aligns weeks to Monday.
  return Math.floor((epochDays + 3) / 7);
}

export function advanceStreak(state: StreakState, now = new Date(), mode: StreakMode = "daily"): StreakAdvance {
  const nowIso = now.toISOString();

  if (!state.lastCompletedAt) {
    return { ...state, currentStreak: 1, streakFreezes: state.streakFreezes, lastCompletedAt: nowIso, usedFreeze: false, earnedFreeze: false };
  }

  const gap = mode === "weekly"
    ? weekIndex(now, state.timeZone) - weekIndex(state.lastCompletedAt, state.timeZone)
    : calendarDaysBetween(state.lastCompletedAt, now, state.timeZone);

  if (gap <= 0) {
    // Already counted in this unit. Keep the timestamp fresh for resume logic.
    return { ...state, lastCompletedAt: nowIso, usedFreeze: false, earnedFreeze: false };
  }

  let currentStreak: number;
  let streakFreezes = state.streakFreezes;
  let usedFreeze = false;

  if (gap === 1) {
    currentStreak = state.currentStreak + 1;
  } else if (gap === 2 && streakFreezes > 0) {
    streakFreezes -= 1;
    usedFreeze = true;
    currentStreak = state.currentStreak + 1;
  } else {
    currentStreak = 1;
  }

  const earnedFreeze =
    currentStreak > 0 && currentStreak % FREEZE_EARN_INTERVAL === 0 && streakFreezes < MAX_STREAK_FREEZES;
  if (earnedFreeze) streakFreezes += 1;

  return { ...state, currentStreak, streakFreezes, lastCompletedAt: nowIso, usedFreeze, earnedFreeze };
}
