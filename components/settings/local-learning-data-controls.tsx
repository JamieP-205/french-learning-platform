"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  emptyLocalLearningProgress,
  loadLocalLearningProgress,
  localLearningStorageKey,
  localProgressUpdatedEvent,
  resetLocalLearningProgress,
  type LocalLearningProgress,
} from "@/lib/local-learning/progress";

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
        ...emptyLocalLearningProgress.preferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return emptyLocalLearningProgress;
  }
}

export function LocalLearningDataControls() {
  const snapshot = useSyncExternalStore(subscribeToLocalProgress, getLocalSnapshot, getServerSnapshot);
  const progress = useMemo(() => parseProgress(snapshot), [snapshot]);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [message, setMessage] = useState<string>();

  function exportProgress() {
    const latestProgress = loadLocalLearningProgress();
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        product: "bonjour-public-browser-learning",
        progress: latestProgress,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "bonjour-browser-progress.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Browser progress export prepared.");
  }

  function resetProgress() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setMessage("This clears every lesson attempt, review reminder, and preference saved in this browser. It cannot be undone.");
      return;
    }

    resetLocalLearningProgress();
    window.dispatchEvent(new Event(localProgressUpdatedEvent));
    setConfirmingReset(false);
    setMessage("Data saved only on this device has been reset.");
  }

  return (
    <section className="card">
      <p className="eyebrow">Data on this device</p>
      <h2 className="mt-2 text-2xl font-black">Export or reset browser-only progress.</h2>
      <p className="mt-3 text-ink/75">
        Lessons used without an account can leave progress in this browser. It stays separate from your account and is
        never merged into it. Export a copy or clear it from this device whenever you want.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-cream p-4">
          <p className="eyebrow">Sessions</p>
          <p className="mt-1 text-3xl font-black">{progress.sessionsCompleted}</p>
        </div>
        <div className="rounded-2xl bg-cream p-4">
          <p className="eyebrow">Attempts</p>
          <p className="mt-1 text-3xl font-black">{progress.attemptsCount}</p>
        </div>
        <div className="rounded-2xl bg-cream p-4">
          <p className="eyebrow">Review items</p>
          <p className="mt-1 text-3xl font-black">
            {progress.mistakePrompts.length +
              Object.values(progress.topicPreviewStats).reduce((total, topic) => total + topic.needsReviewPrompts.length, 0)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="button-primary" type="button" onClick={exportProgress}>
          Export data on this device
        </button>
        <button className="button-secondary" type="button" onClick={resetProgress}>
          {confirmingReset ? "Confirm reset device data" : "Reset data on this device"}
        </button>
        {confirmingReset && (
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setConfirmingReset(false);
              setMessage(undefined);
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {message && (
        <p
          className={`${confirmingReset ? "status-coaching" : "status-success"} mt-4`}
          role={confirmingReset ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
