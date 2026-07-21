"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import {
  defaultLocalLearnerPreferences,
  emptyLocalLearningProgress,
  localLearningStorageKey,
  localLearnerPreferenceSummary,
  localProgressUpdatedEvent,
  saveLocalLearningProgress,
  updateLocalLearnerPreferences,
  type LocalLearnerPreferences,
  type LocalLearningProgress,
} from "@/lib/local-learning/progress";
import { setStoredCompanionQuiet } from "@/lib/companion/quiet-preference";
import { setStoredSpeechSpeed } from "@/lib/speech/speed-preference";
import { setStoredThemePreference, type ThemePreference } from "@/lib/theme/theme-preference";

const levels: LocalLearnerPreferences["currentLevel"][] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const goals: LocalLearnerPreferences["primaryGoal"][] = ["travel", "work", "relationships", "hobby", "food"];

function subscribeToLocalProgress(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localProgressUpdatedEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localProgressUpdatedEvent, onStoreChange);
  };
}

function getLocalSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(localLearningStorageKey) ?? "";
}

function getServerSnapshot() {
  return "";
}

function parseProgress(snapshot: string): LocalLearningProgress {
  if (!snapshot) return emptyLocalLearningProgress;

  try {
    const parsed = JSON.parse(snapshot);
    return {
      ...emptyLocalLearningProgress,
      ...parsed,
      topicPreviewStats: parsed.topicPreviewStats ?? {},
      skillSignals: parsed.skillSignals ?? {},
      activeDates: parsed.activeDates ?? [],
      preferences: {
        ...defaultLocalLearnerPreferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return emptyLocalLearningProgress;
  }
}

export function LocalLearningPreferences() {
  const snapshot = useSyncExternalStore(subscribeToLocalProgress, getLocalSnapshot, getServerSnapshot);
  const progress = useMemo(() => parseProgress(snapshot), [snapshot]);
  const [saved, setSaved] = useState(false);
  const summary = localLearnerPreferenceSummary(progress);
  const formKey = JSON.stringify(progress.preferences);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const speechSpeed = formData.get("speechSpeed") === "slow" ? "slow" : "normal";
    const themeRaw = String(formData.get("themePreference") ?? "system");
    const themePreference: ThemePreference =
      themeRaw === "light" || themeRaw === "dark" ? themeRaw : "system";
    const companionQuiet = formData.get("companionQuiet") === "on";
    const nextProgress = updateLocalLearnerPreferences(progress, {
      displayName:
        String(formData.get("displayName") ?? "").trim() || defaultLocalLearnerPreferences.displayName,
      currentLevel: String(formData.get("currentLevel") ?? "A1") as LocalLearnerPreferences["currentLevel"],
      primaryGoal: String(formData.get("primaryGoal") ?? "travel") as LocalLearnerPreferences["primaryGoal"],
      dailyMinutes: Number(formData.get("dailyMinutes") ?? defaultLocalLearnerPreferences.dailyMinutes),
      sessionEnergy: String(formData.get("sessionEnergy") ?? "normal") as LocalLearnerPreferences["sessionEnergy"],
      speechSpeed,
      themePreference,
      companionQuiet,
    });

    saveLocalLearningProgress(nextProgress);
    setStoredSpeechSpeed(speechSpeed);
    setStoredThemePreference(themePreference);
    setStoredCompanionQuiet(companionQuiet);
    setSaved(true);
  }

  return (
    <section className="card">
      <p className="eyebrow">Learning on this device</p>
      <h2 className="mt-2 text-2xl font-black">Personalise your learning plan.</h2>
      <p className="mt-3 text-ink/75">
        These settings stay in this browser. They help Today and Progress explain the next useful step without saving an account profile.
      </p>

      <form key={formKey} onSubmit={submit} className="mt-6 space-y-5">
        <label className="block font-bold">
          Name
          <input
            className="field"
            name="displayName"
            defaultValue={progress.preferences.displayName}
            maxLength={40}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-bold">
            Current level
            <select className="field" name="currentLevel" defaultValue={progress.preferences.currentLevel}>
              {levels.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="block font-bold">
            Main goal
            <select className="field" name="primaryGoal" defaultValue={progress.preferences.primaryGoal}>
              {goals.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-bold">
            Daily minutes
            <input
              className="field"
              name="dailyMinutes"
              type="number"
              min={2}
              max={60}
              defaultValue={progress.preferences.dailyMinutes}
            />
          </label>

          <label className="block font-bold">
            Session feel
            <select className="field" name="sessionEnergy" defaultValue={progress.preferences.sessionEnergy}>
              <option value="low">Gentle / low energy</option>
              <option value="normal">Balanced</option>
              <option value="challenge">Challenge me</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-bold">
            Audio speed
            <select className="field" name="speechSpeed" defaultValue={progress.preferences.speechSpeed}>
              <option value="normal">Normal, tuned for learners</option>
              <option value="slow">Slower, more time to hear each sound</option>
            </select>
          </label>

          <label className="block font-bold">
            Theme
            <select className="field" name="themePreference" defaultValue={progress.preferences.themePreference}>
              <option value="system">Match my device</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>

        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input
            className="h-5 w-5 accent-moss"
            defaultChecked={progress.preferences.companionQuiet}
            name="companionQuiet"
            type="checkbox"
          />
          Keep Remy quiet during lessons
        </label>

        <div className="rounded-2xl bg-cream p-4 text-sm text-ink/75" aria-live="polite">
          <p className="font-black">{summary.headline}</p>
          <p className="mt-1">{summary.detail}</p>
        </div>

        <button className="button-primary w-full" type="submit">
          Save settings
        </button>

        {saved && (
          <p className="status-success" role="status">
            Saved. Today and Progress now use these settings.
          </p>
        )}
      </form>
    </section>
  );
}
