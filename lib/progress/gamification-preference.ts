"use client";

import { useSyncExternalStore } from "react";

// How loudly progress celebrates: full (confetti and growth animations),
// quiet (text notes instead of motion), or off (streak counters, badges, and
// celebrations hidden; the garden stays, because it is a record, not a
// pressure device). Learning and streak accrual never change.

export type GamificationLevel = "full" | "quiet" | "off";

const STORAGE_KEY = "french-for-life:gamification:v1";
const UPDATED_EVENT = "french-for-life:gamification-updated";

export function getStoredGamification(): GamificationLevel {
  if (typeof window === "undefined") return "full";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "quiet" || stored === "off" ? stored : "full";
  } catch {
    return "full";
  }
}

export function setStoredGamification(level: GamificationLevel) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Storage can be unavailable; the in-page event still updates open views.
  }
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function syncStoredGamification(level: GamificationLevel | undefined) {
  if (!level || level === getStoredGamification()) return;
  setStoredGamification(level);
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(UPDATED_EVENT, onStoreChange);
  };
}

export function useGamification(): GamificationLevel {
  return useSyncExternalStore(subscribe, getStoredGamification, () => "full");
}
