"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  emptyLocalLearningProgress,
  loadLocalLearningProgress,
  localLearningAccuracy,
  localLearningStorageKey,
  localLearningNextAction,
  localLearnerPreferenceSummary,
  localProgressUpdatedEvent,
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

function parseSnapshot(snapshot: string): LocalLearningProgress {
  if (!snapshot) return emptyLocalLearningProgress;
  try {
    return loadLocalLearningProgress();
  } catch {
    return emptyLocalLearningProgress;
  }
}

export function PublicResumeCta() {
  const snapshot = useSyncExternalStore(subscribeToLocalProgress, getLocalSnapshot, getServerSnapshot);
  const progress = useMemo(() => parseSnapshot(snapshot), [snapshot]);

  const nextAction = localLearningNextAction(progress);
  const accuracy = localLearningAccuracy(progress);
  const preferenceSummary = localLearnerPreferenceSummary(progress);

  return (
    <section className="mt-8 rounded-3xl bg-cream p-5">
      <p className="text-sm font-black uppercase tracking-wide text-coral">
        {progress.sessionsCompleted > 0 ? "Welcome back" : "Public learner path"}
      </p>
      <h2 className="mt-2 text-2xl font-black">{nextAction.title}</h2>
      <p className="mt-2 text-sm text-ink/75">{nextAction.reason}</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <p className="rounded-2xl bg-white p-3 font-bold">{progress.sessionsCompleted} session{progress.sessionsCompleted === 1 ? "" : "s"}</p>
        <p className="rounded-2xl bg-white p-3 font-bold">{accuracy}% accuracy</p>
        <p className="rounded-2xl bg-white p-3 font-bold">{preferenceSummary.headline}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="button-primary" href={nextAction.href}>
          {nextAction.label}
        </Link>
        <Link className="button-secondary" href="/progress">
          View my path
        </Link>
      </div>
    </section>
  );
}
