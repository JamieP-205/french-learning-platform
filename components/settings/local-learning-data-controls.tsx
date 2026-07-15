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
      setMessage("Click reset once more to clear browser-only progress.");
      return;
    }

    resetLocalLearningProgress();
    window.dispatchEvent(new Event(localProgressUpdatedEvent));
    setConfirmingReset(false);
    setMessage("Browser-only progress has been reset.");
  }

  return (
    <section className="card">
      <p className="eyebrow">Browser progress</p>
      <h2 className="mt-2 text-2xl font-black">Export or reset this device.</h2>
      <p className="mt-3 text-ink/75">
        Public learning progress is stored only in this browser. Export a copy for yourself or reset this device when
        you want a fresh start.
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
          Export browser progress
        </button>
        <button className="button-secondary" type="button" onClick={resetProgress}>
          {confirmingReset ? "Confirm reset browser progress" : "Reset browser progress"}
        </button>
      </div>

      {message && (
        <p className="status-success mt-4" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
