"use client";

import { setStoredThemePreference, useAppliedTheme } from "@/lib/theme/theme-preference";

// One tap flips between light and dark. The three-way control, including
// following the device, lives in settings; tapping here simply pins the
// theme you asked for.
export function ThemeToggle() {
  const applied = useAppliedTheme();
  const next = applied === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={next === "dark" ? "Switch to dark theme" : "Switch to light theme"}
      className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-ink/20 text-lg hover:border-coral"
      onClick={() => setStoredThemePreference(next)}
      title={next === "dark" ? "Switch to dark theme" : "Switch to light theme"}
      type="button"
    >
      <span aria-hidden="true">{applied === "dark" ? "☀︎" : "☾"}</span>
    </button>
  );
}
