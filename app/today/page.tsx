"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProgressSnapshot, SessionPlanV1 } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { PublicLocalTodayPanel } from "@/components/demo/public-local-learning-panels";

type ErrorAction = "sign-in" | "onboarding" | "retry";

function habitToneClass(tone?: ProgressSnapshot["habit"]["tone"]) {
  if (tone === "fresh") return "bg-moss/10";
  if (tone === "comeback") return "bg-amber/20";
  return "bg-cream";
}

function formatReviewDate(iso?: string) {
  if (!iso) return "No review scheduled yet";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

export default function TodayPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<SessionPlanV1>();
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [error, setError] = useState<string>();
  const [errorAction, setErrorAction] = useState<ErrorAction>("retry");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      setLoading(true);
      setError(undefined);
      setErrorAction("retry");

      try {
        const accessToken = await getBrowserAccessToken();
        if (!accessToken && getBrowserSupabase()) {
          if (!cancelled) setLoading(false);
          return;
        }

        const headers = await getBrowserAuthHeaders();
        const [nextPlan, snapshot] = await Promise.all([
          fetch("/api/today", { headers }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) {
              const nextError = new Error(payload.error ?? "Your session could not load.");
              nextError.name = String(response.status);
              throw nextError;
            }
            setActiveSessionId(payload.activeSessionId as string | undefined);
            return payload.plan as SessionPlanV1;
          }),
          fetch("/api/progress", { headers }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) return undefined;
            return payload.progress as ProgressSnapshot;
          }),
        ]);

        if (cancelled) return;
        setPlan(nextPlan);
        setProgress(snapshot);
      } catch (caught) {
        if (cancelled) return;

        const status = caught instanceof Error ? caught.name : "";
        if (status === "401") {
          setError("Sign in to start today’s mission and save your learning progress.");
          setErrorAction("sign-in");
        } else if (status === "409") {
          setError("Finish onboarding to build your first session.");
          setErrorAction("onboarding");
        } else {
          setError(caught instanceof Error ? caught.message : "Your session could not load. Please try again.");
          setErrorAction("retry");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadToday();

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  async function start(mode?: "normal" | "short") {
    setStarting(true);
    setError(undefined);
    setErrorAction("retry");
    const accessToken = await getBrowserAccessToken();
    if (!accessToken && getBrowserSupabase()) {
      setStarting(false);
      router.push("/demo");
      return;
    }

    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: await getBrowserAuthHeaders({ json: true }),
      body: JSON.stringify({ mode }),
    });
    const payload = await response.json();
    setStarting(false);
    if (!response.ok) {
      if (response.status === 401) {
        setErrorAction("sign-in");
        return setError("Sign in to start today’s mission and save your learning progress.");
      }

      if (response.status === 409) {
        setErrorAction("onboarding");
        return setError("Finish onboarding to build your first session.");
      }

      return setError(payload.error ?? "Today’s session could not start. Please try again.");
    }
    router.push(`/lesson/${payload.session.id}`);
  }

  const completedFromProgress = progress?.habit.tone === "fresh";
  const hasCompletedToday = completedFromProgress;
  const earnedAchievements = progress?.achievements.filter((achievement) => achievement.earned) ?? [];
  const nextAchievement = progress?.achievements.find((achievement) => !achievement.earned);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Today</p>
        <h1 className="mt-2 text-4xl font-black">Your French for today.</h1>

        <PublicLocalTodayPanel />
        {loading && <div className="card mt-7 animate-pulse">Building a session around what matters today...</div>}

        {error && (
          <div className="card mt-7">
            <p className="status-error">{error}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {errorAction === "sign-in" && (
                <>
                  <button className="button-primary" onClick={() => router.push("/auth/sign-in?redirectTo=/today")}>
                    Sign in
                  </button>
                  <button className="button-secondary" onClick={() => router.push("/demo")}>
                    Try no-account demo
                  </button>
                </>
              )}
              {errorAction === "onboarding" && (
                <button className="button-primary" onClick={() => router.push("/onboarding")}>
                  Finish onboarding
                </button>
              )}
              {errorAction === "retry" && (
                <button className="button-primary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && progress && (
          <section className={`card mt-7 ${habitToneClass(progress.habit.tone)}`}>
            <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
              <div>
                <p className="eyebrow">{progress.habit.tone === "comeback" ? "Comeback path" : "Learning loop"}</p>
                <h2 className="mt-2 text-2xl font-black">{progress.habit.headline}</h2>
                <p className="mt-3 max-w-2xl text-ink/75">{progress.habit.detail}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link className="button-primary" href={progress.nextAction.href}>
                    {progress.nextAction.label}
                  </Link>
                  <Link className="button-secondary" href="/progress">
                    See evidence
                  </Link>
                </div>
              </div>

              <aside className="rounded-2xl bg-white/60 p-5">
                <p className="eyebrow">Why come back?</p>
                <h3 className="mt-2 font-black">{progress.nextAction.reason}</h3>
                <p className="mt-3 text-sm text-ink/70">
                  Next review: {progress.reviewsDue > 0 ? `${progress.reviewsDue} due now` : formatReviewDate(progress.nextReviewAt)}
                </p>
              </aside>
            </div>
          </section>
        )}

        {!loading && !error && hasCompletedToday && (
          <section className="card mt-7 bg-moss/10">
            <p className="eyebrow">Completed today</p>
            <h2 className="mt-2 text-3xl font-black">That counts. One useful session is enough.</h2>
            <p className="mt-3 max-w-2xl text-ink/75">
              You created real learning evidence today. Stop guilt-free, check the review queue, or do a tiny repair if you want another rep.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="button-primary" href="/progress?complete=1">
                View progress
              </Link>
              <Link className="button-secondary" href="/review">
                Check review
              </Link>
              <button className="button-secondary" disabled={starting} onClick={() => start("short")}>
                Repractise for 2 minutes
              </button>
            </div>
          </section>
        )}

        {!loading && !error && !hasCompletedToday && plan && (
          <div className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="card bg-ink text-white">
              <p className="text-sm font-bold text-amber">{plan.mode === "comeback" ? "WELCOME BACK" : "YOUR SESSION"}</p>
              <h2 className="mt-3 text-3xl font-black">{plan.missionTitle ?? "Your next practical French mission."}</h2>
              <p className="mt-3 max-w-xl text-white/75">{plan.weakFocus}</p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button className="button-primary bg-coral hover:bg-coral/90" disabled={starting} onClick={() => start()}>
                  {starting
                    ? "Starting..."
                    : activeSessionId
                      ? "Resume where you left off"
                      : `Start ${plan.estimatedMinutes}-minute session`}
                </button>
                <span className="text-sm text-white/70">{plan.activities.length} focused steps</span>
              </div>
            </section>

            <aside className="card">
              <p className="eyebrow">Your focus</p>
              <h2 className="mt-2 text-xl font-black">Mixed practice, not one question type.</h2>
              <ul className="mt-5 space-y-3 text-sm text-ink/75">
                {plan.activities.slice(0, 3).map((entry, index) => (
                  <li key={entry.activity.id} className="flex gap-3">
                    <span className="font-black text-coral">0{index + 1}</span>
                    {entry.rationale}
                  </li>
                ))}
              </ul>
              <button className="button-secondary mt-6 w-full" disabled={starting} onClick={() => start("short")}>
                I only have two minutes
              </button>
            </aside>
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="eyebrow">Sessions</p>
            <p className="mt-2 text-3xl font-black">{progress?.sessionsCompleted ?? 0}</p>
            <p className="mt-1 text-sm text-ink/70">Completed sessions, not fake XP.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Reviews</p>
            <p className="mt-2 text-3xl font-black">{progress?.reviewsDue ?? 0}</p>
            <p className="mt-1 text-sm text-ink/70">Due weak points come first.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Mission progress</p>
            <p className="mt-2 text-3xl font-black">{progress?.mission.completionPercent ?? 0}%</p>
            <p className="mt-1 text-sm text-ink/70">Real completed steps in this vertical slice.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Achievements</p>
            <p className="mt-2 text-3xl font-black">{earnedAchievements.length}</p>
            <p className="mt-1 text-sm text-ink/70">{nextAchievement ? `Next: ${nextAchievement.title}` : "All current MVP badges earned."}</p>
          </div>
        </section>

        {progress && (
          <section className="card mt-7">
            <p className="eyebrow">Adaptive recommendations</p>
            <h2 className="mt-2 text-2xl font-black">What the app thinks will help next.</h2>
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
        )}
      </main>
    </AppShell>
  );
}
