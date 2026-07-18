"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProgressSnapshot } from "@/lib/domain/types";
import type { LearnerReviewSummary } from "@/lib/learning/presentation";
import { AppShell } from "@/components/app-shell";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { PublicLocalReviewPanel } from "@/components/demo/public-local-learning-panels";
import { LearningModeUnavailable } from "@/components/learning-mode-unavailable";
import { useLearningMode } from "@/lib/auth/use-learning-mode";

function formatReviewDate(iso?: string) {
  if (!iso) return "No review scheduled yet";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

export default function ReviewPage() {
  const router = useRouter();
  const learningMode = useLearningMode();
  const [reviews, setReviews] = useState<LearnerReviewSummary[]>([]);
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [error, setError] = useState<string>();
  const [startError, setStartError] = useState<string>();
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const startRequestId = useRef<string | undefined>(undefined);

  async function startFocusedReview() {
    setStarting(true);
    setStartError(undefined);
    startRequestId.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify({
          requestId: startRequestId.current,
          focus: "review",
          ...(activeSessionId ? { resumeSessionId: activeSessionId } : {}),
        }),
      });
      const payload = (await response.json().catch(() => undefined)) as
        | { error?: string; session?: { id?: string } }
        | undefined;

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth/sign-in?redirectTo=/review");
          return;
        }

        if (response.status === 409 && payload?.error === "Finish onboarding first.") {
          router.push("/onboarding");
          return;
        }

        if (response.status === 409 && activeSessionId) {
          setActiveSessionId(undefined);
          setStartError("That focused review is no longer open. Start a new one when you are ready.");
          return;
        }

        setStartError(payload?.error ?? "We couldn’t start your review. Check your connection and try again.");
        return;
      }

      if (!payload?.session?.id) {
        throw new Error("Missing session details");
      }

      router.push(`/lesson/${payload.session.id}`);
    } catch {
      setStartError("We couldn’t start your review. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      if (learningMode === "loading") return;
      if (learningMode === "local") {
        setLoading(false);
        setReviews([]);
        setProgress(undefined);
        setError(undefined);
        return;
      }
      if (learningMode === "unavailable") return;

      try {
        const accessToken = await getBrowserAccessToken();
        if (!accessToken && getBrowserSupabase()) {
          if (!cancelled) setLoading(false);
          return;
        }

        const headers = await getBrowserAuthHeaders();
        const [reviewResponse, progressResponse] = await Promise.all([
          fetch("/api/review/due", { headers }),
          fetch("/api/progress", { headers }),
        ]);
        const reviewPayload = await reviewResponse.json();
        const progressPayload = await progressResponse.json();

        if (cancelled) return;
        if (!reviewResponse.ok) setError(reviewPayload.error);
        else {
          setReviews(reviewPayload.reviews);
          setActiveSessionId(reviewPayload.activeSessionId as string | undefined);
        }
        if (progressResponse.ok) setProgress(progressPayload.progress);
      } catch {
        if (!cancelled) setError("Reviews could not load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [learningMode]);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Review</p>
        <h1 className="mt-2 text-4xl font-black">Review mistakes at the right time.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Mistakes return as short, focused practice when they are due.
        </p>

        {learningMode === "loading" && (
          <div className="card mt-7" role="status">Loading your reviews...</div>
        )}
        {learningMode === "unavailable" && <LearningModeUnavailable />}
        {learningMode === "local" && <PublicLocalReviewPanel />}
        {learningMode === "account" && <>
        {loading && <div className="card mt-7 animate-pulse">Loading your reviews...</div>}
        {error && <p className="status-error mt-7" role="alert">{error}</p>}

        {!loading && !error && (
          <section className="card mt-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">
                  {activeSessionId
                    ? "Your focused review is ready to continue"
                    : reviews.length
                      ? `${reviews.length} due now`
                      : "Nothing due right now"}
                </h2>
                <p className="mt-2 text-ink/70">
                  {activeSessionId
                    ? "Pick up at the exact review item where you stopped."
                    : reviews.length
                      ? "Start with these before adding new material."
                      : "Nothing is due right now. Start a new lesson or come back after your next review date."}
                </p>
              </div>
              <div className="rounded-2xl bg-cream p-4 text-sm font-bold text-ink/70">
                Next review: {reviews.length ? "now" : formatReviewDate(progress?.nextReviewAt)}
              </div>
            </div>

            {reviews.length ? (
              <ul className="mt-6 space-y-3">
                {reviews.map((review) => (
                  <li className="rounded-2xl bg-cream p-4" key={review.id}>
                    <p className="font-bold">{review.prompt}</p>
                    <p className="mt-1 text-sm text-ink/70">
                      Due now · missed {review.failureCount} time{review.failureCount === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link href="/today" className="rounded-2xl bg-moss/10 p-4 font-bold hover:bg-moss/20">
                  Start today’s mixed session
                </Link>
                <Link href="/progress" className="rounded-2xl bg-cream p-4 font-bold hover:bg-ink/10">
                  See achievements and progress
                </Link>
              </div>
            )}

            {(reviews.length > 0 || activeSessionId) && (
              <div className="mt-7">
                {startError && (
                  <p className="status-error mb-3" role="alert">
                    {startError}
                  </p>
                )}
                <button className="button-primary" disabled={starting} onClick={startFocusedReview}>
                  {starting
                    ? activeSessionId ? "Resuming focused review..." : "Getting your review ready..."
                    : startError
                      ? "Try focused review again"
                      : activeSessionId
                        ? "Resume focused review"
                        : "Start focused review"}
                </button>
              </div>
            )}
          </section>
        )}
        </>}
      </main>
    </AppShell>
  );
}
