"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme/theme-constants";

// The learner's theme choice: an explicit light or dark, or follow the
// device. The applied theme lives on <html data-theme> so CSS variables can
// switch; a tiny inline script in the root layout applies it before first
// paint, and this store keeps it correct afterwards.

export type ThemePreference = "light" | "dark" | "system";
export type AppliedTheme = "light" | "dark";

const UPDATED_EVENT = "french-for-life:theme-updated";

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): AppliedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveAppliedTheme(preference: ThemePreference): AppliedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyThemeToDocument(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveAppliedTheme(preference);
}

export function setStoredThemePreference(preference: ThemePreference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private browsing can refuse storage; the page still switches live.
  }
  applyThemeToDocument(preference);
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

// For code paths that receive the profile on load: adopt the account's saved
// preference without firing update events when nothing changed.
export function syncStoredThemePreference(preference: ThemePreference | undefined) {
  if (!preference || preference === getStoredThemePreference()) return;
  setStoredThemePreference(preference);
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;
  const onMediaChange = () => {
    if (getStoredThemePreference() === "system") applyThemeToDocument("system");
    onStoreChange();
  };
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(UPDATED_EVENT, onStoreChange);
  media?.addEventListener("change", onMediaChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(UPDATED_EVENT, onStoreChange);
    media?.removeEventListener("change", onMediaChange);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getStoredThemePreference, () => "system");
}

export function useAppliedTheme(): AppliedTheme {
  return useSyncExternalStore(
    subscribe,
    () => resolveAppliedTheme(getStoredThemePreference()),
    () => "light",
  );
}
