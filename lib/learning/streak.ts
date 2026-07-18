// Day-based streak with earned freezes and no guilt mechanics.
// - One session per day advances the streak; extra sessions never inflate it.
// - Every 7 consecutive days earns a freeze (held, max 2).
// - A single missed day is absorbed by a freeze automatically.
// - Longer gaps restart at 1 — the comeback session handles the emotional part.

import { calendarDaysBetween } from "@/lib/time/calendar-day";

export const MAX_STREAK_FREEZES = 2;
export const FREEZE_EARN_INTERVAL = 7;

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

export function advanceStreak(state: StreakState, now = new Date()): StreakAdvance {
  const nowIso = now.toISOString();

  if (!state.lastCompletedAt) {
    return { ...state, currentStreak: 1, streakFreezes: state.streakFreezes, lastCompletedAt: nowIso, usedFreeze: false, earnedFreeze: false };
  }

  const gap = calendarDaysBetween(state.lastCompletedAt, now, state.timeZone);

  if (gap <= 0) {
    // Already counted today. Keep the timestamp fresh for resume logic.
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
