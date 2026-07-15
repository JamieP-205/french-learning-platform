"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ProgressSnapshot } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";
import { PublicLocalProgressPanel } from "@/components/demo/public-local-learning-panels";
import { LearningGarden } from "@/components/progress/learning-garden";

function evidenceLabel(score: number) {
  if (score <= 0) return "No evidence yet";
  if (score < 40) return "Early signal";
  if (score < 70) return "Some evidence";
  return "Repeated evidence";
}

function formatReviewDate(iso?: string) {
  if (!iso) return "Nothing scheduled yet";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [error, setError] = useState<string>();
  const [showCompletion] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("complete") === "1";
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
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
  }, []);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Progress</p>
        <h1 className="mt-2 text-4xl font-black">Your learning evidence.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          This is the proof layer: sessions, recall, mistakes, review timing, achievements, and the next useful action.
        </p>

        {error && <p className="status-error mt-7">{error}</p>}
        <PublicLocalProgressPanel />
        {!progress && !error && <div className="card mt-7 animate-pulse">Adding up your learning evidence...</div>}

        {progress && (
          <>
            {showCompletion && (
              <section className="card mt-7 bg-moss/10">
                <p className="eyebrow">Session complete</p>
                <h2 className="mt-2 text-3xl font-black">Nice. You made French usable, not just watched it.</h2>
                <p className="mt-3 max-w-2xl text-ink/75">
                  The app saved your attempts, captured weak points, updated progress, and set up the next review pull.
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
                  <p className="eyebrow">Mission progress</p>
                  <h2 className="mt-2 text-2xl font-black">{progress.mission.title}</h2>
                  <p className="mt-2 text-ink/70">
                    {progress.mission.completedSteps} of {progress.mission.totalSteps} mission steps have learning evidence.
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
                <h2 className="mt-2 text-2xl font-black">Satisfaction you can trust.</h2>
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
                <h2 className="mt-2 text-2xl font-black">Reward mastery, not button tapping.</h2>
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
              <h2 className="text-2xl font-black">Practice evidence</h2>
              <p className="mt-2 text-ink/70">
                These are not ability percentages. They are rough signals from the activity types you have completed so far.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {progress.skills.map((skill) => (
                  <div key={skill.label} className="rounded-2xl bg-cream p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">{skill.label}</p>
                      <span className="text-sm font-black text-coral">{skill.score}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink/70">{evidenceLabel(skill.score)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="card mt-6 bg-ink text-white">
              <p className="text-sm font-bold uppercase tracking-wide text-amber">Next best action</p>
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
              <h2 className="mt-2 text-2xl font-black">Personal path, based on evidence.</h2>
              <p className="mt-2 text-ink/70">
                These are based on your level choice, sessions, mistakes, reviews, and activity evidence—not generic streak pressure.
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
      </main>
    </AppShell>
  );
}
