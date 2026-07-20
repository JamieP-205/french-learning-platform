"use client";

import { useSyncExternalStore } from "react";

// Whether Remy should stay quiet during lessons. Settings screens write it
// and persist it (profile column for accounts, local preferences otherwise);
// the lesson companion only reads it.

const STORAGE_KEY = "french-for-life:companion-quiet:v1";
const UPDATED_EVENT = "french-for-life:companion-quiet-updated";

export function getStoredCompanionQuiet(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setStoredCompanionQuiet(quiet: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, quiet ? "true" : "false");
  } catch {
    // Storage can be unavailable; the in-page event still updates open views.
  }
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

export function syncStoredCompanionQuiet(quiet: boolean | undefined) {
  if (quiet === undefined || quiet === getStoredCompanionQuiet()) return;
  setStoredCompanionQuiet(quiet);
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

export function useCompanionQuiet(): boolean {
  return useSyncExternalStore(subscribe, getStoredCompanionQuiet, () => false);
}
