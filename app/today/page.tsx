"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LearnerSessionPlanV1, ProgressSnapshot } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { PublicLocalTodayPanel } from "@/components/demo/public-local-learning-panels";
import { LearningModeUnavailable } from "@/components/learning-mode-unavailable";
import { FirstRunTour } from "@/components/onboarding/first-run-tour";
import { LearningScheduleCard } from "@/components/schedule/learning-schedule-card";
import { useLearningMode } from "@/lib/auth/use-learning-mode";

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
  const learningMode = useLearningMode();
  const [plan, setPlan] = useState<LearnerSessionPlanV1>();
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [error, setError] = useState<string>();
  const [errorAction, setErrorAction] = useState<ErrorAction>("retry");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [retryStart, setRetryStart] = useState<{
    mode?: "normal" | "short";
    requestId: string;
  } | null>(null);
  const [displayName, setDisplayName] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      if (learningMode === "loading") return;
      if (learningMode === "local") {
        setLoading(false);
        setPlan(undefined);
        setProgress(undefined);
        setError(undefined);
        return;
      }
      if (learningMode === "unavailable") return;

      setLoading(true);
      setError(undefined);
      setErrorAction("retry");
      setRetryStart(null);

      try {
        const accessToken = await getBrowserAccessToken();
        if (!accessToken && getBrowserSupabase()) {
          if (!cancelled) setLoading(false);
          return;
        }

        const headers = await getBrowserAuthHeaders();
        const [nextPlan, snapshot, profile] = await Promise.all([
          fetch("/api/today", { headers }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) {
              const nextError = new Error(payload.error ?? "Your session could not load.");
              nextError.name = String(response.status);
              throw nextError;
            }
            setActiveSessionId(payload.activeSessionId as string | undefined);
            return payload.plan as LearnerSessionPlanV1;
          }),
          fetch("/api/progress", { headers }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) return undefined;
            return payload.progress as ProgressSnapshot;
          }),
          fetch("/api/profile", { headers }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok) return undefined;
            return payload.profile as { displayName?: string };
          }),
        ]);

        if (cancelled) return;
        setPlan(nextPlan);
        setProgress(snapshot);
        setDisplayName(profile?.displayName);
      } catch (caught) {
        if (cancelled) return;

        const status = caught instanceof Error ? caught.name : "";
        if (status === "401") {
          setError("Sign in to start today's session and save your progress.");
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
  }, [learningMode, loadAttempt]);

  async function start(
    mode?: "normal" | "short",
    requestId = crypto.randomUUID(),
  ) {
    setStarting(true);
    setError(undefined);
    setErrorAction("retry");
    setRetryStart(null);

    try {
      const accessToken = await getBrowserAccessToken();
      if (!accessToken && getBrowserSupabase()) {
        router.push("/demo");
        return;
      }

      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify({
          requestId,
          ...(mode
            ? { mode }
            : activeSessionId
              ? { resumeSessionId: activeSessionId }
              : {}),
        }),
      });
      const payload = (await response.json().catch(() => undefined)) as
        | { error?: string; session?: { id?: string } }
        | undefined;

      if (!response.ok) {
        if (response.status === 401) {
          setErrorAction("sign-in");
          setError("Sign in to start today's session and save your progress.");
          return;
        }

        if (response.status === 409 && payload?.error === "Finish onboarding first.") {
          setErrorAction("onboarding");
          setError("Finish onboarding to build your first session.");
          return;
        }

        if (response.status === 409 && activeSessionId && !mode) {
          setActiveSessionId(undefined);
        }
        setRetryStart({ mode, requestId });
        setError(payload?.error ?? "We couldn’t start your session. Check your connection and try again.");
        return;
      }

      if (!payload?.session?.id) {
        throw new Error("Missing session details");
      }

      router.push(`/lesson/${payload.session.id}`);
    } catch {
      setRetryStart({ mode, requestId });
      setErrorAction("retry");
      setError("We couldn’t start your session. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  const completedFromProgress = progress?.habit.tone === "fresh";
  const hasCompletedToday = completedFromProgress && !activeSessionId;
  const earnedAchievements = progress?.achievements.filter((achievement) => achievement.earned) ?? [];
  const nextAchievement = progress?.achievements.find((achievement) => !achievement.earned);
  const firstName = displayName?.trim().split(/\s+/)[0];
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Today</p>
        <h1 className="mt-2 text-4xl font-black">{firstName ? `${greeting}, ${firstName}.` : "Your French for today."}</h1>
        {firstName && <p className="mt-3 text-lg text-ink/70">Here is the smallest useful step for your French today.</p>}
        <FirstRunTour />

        {learningMode === "loading" && (
          <div className="card mt-7" role="status">Choosing the right learning path for this device...</div>
        )}
        {learningMode === "unavailable" && <LearningModeUnavailable />}
        {learningMode === "local" && <PublicLocalTodayPanel />}
        {learningMode === "account" && <>
        {loading && <div className="card mt-7 animate-pulse">Loading today&apos;s session...</div>}

        {error && (
          <div className="card mt-7">
            <p className="status-error" role="alert">{error}</p>
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
                <button
                  className="button-primary"
                  disabled={starting}
                  onClick={() => retryStart
                    ? void start(retryStart.mode, retryStart.requestId)
                    : setLoadAttempt((attempt) => attempt + 1)}
                >
                  {starting ? "Starting..." : "Try again"}
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && progress && (
          <section className={`card mt-7 ${habitToneClass(progress.habit.tone)}`}>
            <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
              <div>
                <p className="eyebrow">{progress.habit.tone === "comeback" ? "Welcome back" : "Today’s progress"}</p>
                <h2 className="mt-2 text-2xl font-black">{progress.habit.headline}</h2>
                <p className="mt-3 max-w-2xl text-ink/75">{progress.habit.detail}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link className="button-primary" href={progress.nextAction.href}>
                    {progress.nextAction.label}
                  </Link>
                  <Link className="button-secondary" href="/progress">
                    See progress
                  </Link>
                </div>
              </div>

              <aside className="rounded-2xl bg-white/60 p-5">
                <p className="eyebrow">Why this next step?</p>
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
              You did useful practice today. You can stop here, review something due, or spend two more minutes on a weak point.
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
              <h2 className="mt-3 text-3xl font-black">{plan.missionTitle ?? "Your next French lesson."}</h2>
              <p className="mt-3 max-w-xl text-white/75">{plan.weakFocus}</p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button className="button-primary bg-coral hover:bg-coral/90" disabled={starting} onClick={() => start()}>
                  {starting
                    ? "Starting..."
                    : activeSessionId
                      ? "Resume where you left off"
                      : `Start ${plan.estimatedMinutes}-minute session`}
                </button>
                <span className="text-sm text-white/70">{plan.activities.length} activities</span>
              </div>
            </section>

            <aside className="card">
              <p className="eyebrow">Your focus</p>
              <h2 className="mt-2 text-xl font-black">A useful mix for this session.</h2>
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

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="card">
            <p className="eyebrow">Sessions</p>
            <p className="mt-2 text-3xl font-black">{progress?.sessionsCompleted ?? 0}</p>
            <p className="mt-1 text-sm text-ink/70">Lessons you completed from start to finish.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Reviews</p>
            <p className="mt-2 text-3xl font-black">{progress?.reviewsDue ?? 0}</p>
            <p className="mt-1 text-sm text-ink/70">Reviews that are due come first.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Lesson progress</p>
            <p className="mt-2 text-3xl font-black">{progress?.mission.completionPercent ?? 0}%</p>
            <p className="mt-1 text-sm text-ink/70">Checked steps completed in this lesson.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Streak</p>
            <p className="mt-2 text-3xl font-black">{progress?.currentStreak ?? 0} <span className="text-lg text-coral">days</span></p>
            <p className="mt-1 text-sm text-ink/70">A thread you can protect, never a reason for guilt.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Achievements</p>
            <p className="mt-2 text-3xl font-black">{earnedAchievements.length}</p>
            <p className="mt-1 text-sm text-ink/70">{nextAchievement ? `Next: ${nextAchievement.title}` : "You have earned every available badge."}</p>
          </div>
        </section>

        {progress && (
          <section className="card mt-7">
            <p className="eyebrow">Recommended next</p>
            <h2 className="mt-2 text-2xl font-black">Practice chosen from your recent answers.</h2>
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
        </>}
        {learningMode !== "loading" && learningMode !== "unavailable" && (
          <div className="mt-7">
            <LearningScheduleCard />
          </div>
        )}
      </main>
    </AppShell>
  );
}
