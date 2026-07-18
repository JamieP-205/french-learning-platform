"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { ProgressSnapshot } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";
import { PublicLocalProgressPanel } from "@/components/demo/public-local-learning-panels";
import { LearningModeUnavailable } from "@/components/learning-mode-unavailable";
import { LearningGarden } from "@/components/progress/learning-garden";
import { useLearningMode } from "@/lib/auth/use-learning-mode";

function evidenceLabel(score: number | null, practiceAttempts: number) {
  if (score === null) {
    return practiceAttempts === 0
      ? "Not started"
      : `Practised ${practiceAttempts === 1 ? "once" : `${practiceAttempts} times`} · not scored`;
  }
  if (score <= 0) return "Not started";
  if (score < 40) return "Just started";
  if (score < 70) return "Developing";
  return "Practised often";
}

function formatReviewDate(iso?: string) {
  if (!iso) return "Nothing scheduled yet";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

function subscribeToCompletionLocation(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getCompletionLocationSnapshot() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("complete") === "1";
}

function getServerCompletionLocationSnapshot() {
  return false;
}

export default function ProgressPage() {
  const learningMode = useLearningMode();
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [error, setError] = useState<string>();
  const showCompletion = useSyncExternalStore(
    subscribeToCompletionLocation,
    getCompletionLocationSnapshot,
    getServerCompletionLocationSnapshot,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      if (learningMode === "loading") return;
      if (learningMode === "local") {
        setProgress(undefined);
        setError(undefined);
        return;
      }
      if (learningMode === "unavailable") return;

      try {
        const response = await fetch("/api/progress", { headers: await getBrowserAuthHeaders() });
        const payload = await response.json();

        if (cancelled) return;
        if (!response.ok) setError(payload.error);
        else setProgress(payload.progress);
      } catch {
        if (!cancelled) setError("Progress could not load.");
      }
    }

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, [learningMode]);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Progress</p>
        <h1 className="mt-2 text-4xl font-black">Your progress.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          See the sessions you have finished, phrases recalled from memory, mistakes repaired, reviews due, and the most useful next step.
        </p>

        {learningMode === "loading" && (
          <div className="card mt-7" role="status">Loading your progress...</div>
        )}
        {learningMode === "unavailable" && <LearningModeUnavailable />}
        {learningMode === "local" && <PublicLocalProgressPanel />}
        {learningMode === "account" && <>
        {error && <p className="status-error mt-7" role="alert">{error}</p>}
        {!progress && !error && <div className="card mt-7 animate-pulse">Adding up your progress...</div>}

        {progress && (
          <>
            {showCompletion && (
              <section className="card mt-7 bg-moss/10">
                <p className="eyebrow">Session complete</p>
                <h2 className="mt-2 text-3xl font-black">You finished today&apos;s French practice.</h2>
                <p className="mt-3 max-w-2xl text-ink/75">
                  Your answers, progress, and next review are saved.
                </p>
              </section>
            )}

            <section className="card mt-7">
              <p className="eyebrow">Your learning garden</p>
              <h2 className="mt-2 text-2xl font-black">It only grows when your French does.</h2>
              <div className="mt-5">
                <LearningGarden progress={progress} />
              </div>
            </section>

            <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Sessions", progress.sessionsCompleted],
                ["Streak", progress.currentStreak],
                ["Recalled", progress.phrasesLearned],
                ["Reviews due", progress.reviewsDue],
                ["Accuracy", `${progress.accuracyPercent}%`],
              ].map(([label, value]) => (
                <div className="card" key={String(label)}>
                  <p className="eyebrow">{label}</p>
                  <p className="mt-2 text-4xl font-black">{value}</p>
                </div>
              ))}
            </section>

            <section className="card mt-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Lesson progress</p>
                  <h2 className="mt-2 text-2xl font-black">{progress.mission.title}</h2>
                  <p className="mt-2 text-ink/70">
                    {progress.mission.completedSteps} of {progress.mission.totalSteps} lesson steps completed.
                  </p>
                </div>
                <p className="text-4xl font-black text-coral">{progress.mission.completionPercent}%</p>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full bg-coral" style={{ width: `${progress.mission.completionPercent}%` }} />
              </div>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="card">
                <p className="eyebrow">Recent wins</p>
                <h2 className="mt-2 text-2xl font-black">What is going well.</h2>
                <ul className="mt-5 space-y-3 text-sm text-ink/75">
                  {progress.recentWins.map((win) => (
                    <li key={win} className="rounded-2xl bg-cream p-4 font-bold">
                      {win}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <p className="eyebrow">Achievements</p>
                <h2 className="mt-2 text-2xl font-black">Milestones from completed practice.</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {progress.achievements.map((achievement) => (
                    <article
                      key={achievement.id}
                      className={achievement.earned ? "rounded-2xl bg-moss/10 p-4" : "rounded-2xl bg-cream p-4 opacity-75"}
                    >
                      <p className="text-xs font-black uppercase tracking-wide text-coral">
                        {achievement.earned ? "Earned" : "Next"}
                      </p>
                      <h3 className="mt-2 font-black">{achievement.title}</h3>
                      <p className="mt-1 text-sm text-ink/70">{achievement.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="card mt-6">
              <h2 className="text-2xl font-black">Skills practised</h2>
              <p className="mt-2 text-ink/70">
                These scores combine your accuracy and number of checked attempts in this course. They are not CEFR levels or overall proficiency grades.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {progress.skills.map((skill) => (
                  <div key={skill.label} className="rounded-2xl bg-cream p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">{skill.label}</p>
                      <span className="text-sm font-black text-coral">
                        {skill.score === null ? "Not scored" : skill.score}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink/70">
                      {evidenceLabel(skill.score, skill.practiceAttempts)}
                    </p>
                    {skill.score === null && skill.practiceAttempts > 0 && (
                      <p className="mt-2 text-xs text-ink/60">
                        Speaking self-checks record participation, not pronunciation mastery.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="card mt-6 bg-ink text-white">
              <p className="text-sm font-bold uppercase tracking-wide text-amber">Next up</p>
              <h2 className="mt-2 text-2xl font-black">{progress.nextAction.label}</h2>
              <p className="mt-2 text-white/75">{progress.nextAction.reason}</p>
              <p className="mt-3 text-sm text-white/60">
                Next scheduled review: {progress.reviewsDue > 0 ? `${progress.reviewsDue} due now` : formatReviewDate(progress.nextReviewAt)}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={progress.nextAction.href} className="button-primary bg-coral hover:bg-coral/90">
                  Continue
                </Link>
                <Link href="/learn" className="button-secondary border-white/20 bg-white/10 text-white hover:bg-white/20">
                  Browse topics
                </Link>
              </div>
            </section>

            <section className="card mt-6">
              <p className="eyebrow">Recommendations</p>
              <h2 className="mt-2 text-2xl font-black">Practice chosen from your recent work.</h2>
              <p className="mt-2 text-ink/70">
                Recommendations use your level, completed sessions, mistakes, and reviews to keep the next step useful.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {progress.recommendations.map((recommendation) => (
                  <Link
                    key={recommendation.id}
                    href={recommendation.href}
                    className="rounded-2xl bg-cream p-4 transition hover:bg-ink/10"
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-coral">{recommendation.priority}</p>
                    <h3 className="mt-2 font-black">{recommendation.title}</h3>
                    <p className="mt-1 text-sm text-ink/70">{recommendation.description}</p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
        </>}
      </main>
    </AppShell>
  );
}
