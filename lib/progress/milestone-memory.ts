"use client";

// Remembers which garden pieces this browser has already watched grow, so
// the entrance animation plays once per unlock instead of on every visit.
// A new device replays the growth once; that is a feature, not a bug.

const STORAGE_KEY = "french-for-life:garden-seen:v1";

export function readSeenMilestones(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberSeenMilestones(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const merged = [...new Set([...readSeenMilestones(), ...ids])];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Storage can be unavailable; the animation simply replays next visit.
  }
}

export function freshMilestones(earnedIds: string[], seenIds: string[]): string[] {
  const seen = new Set(seenIds);
  return earnedIds.filter((id) => !seen.has(id));
}
