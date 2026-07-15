"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProgressSnapshot, ReviewItem } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { PublicLocalReviewPanel } from "@/components/demo/public-local-learning-panels";

function formatReviewDate(iso?: string) {
  if (!iso) return "No review scheduled yet";
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

export default function ReviewPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function startFocusedReview() {
    setStarting(true);
    setError(undefined);
    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: await getBrowserAuthHeaders({ json: true }),
      body: JSON.stringify({ focus: "review" }),
    });
    const payload = await response.json();
    setStarting(false);
    if (!response.ok) return setError(payload.error ?? "The focused review could not start.");
    router.push(`/lesson/${payload.session.id}`);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
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
        else setReviews(reviewPayload.reviews);
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
  }, []);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Review</p>
        <h1 className="mt-2 text-4xl font-black">Repair weak points at the right time.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Review should feel like progress, not punishment. Mistakes become targeted practice when they are actually due.
        </p>

        <PublicLocalReviewPanel />
        {loading && <div className="card mt-7 animate-pulse">Checking your review queue...</div>}
        {error && <p className="status-error mt-7">{error}</p>}

        {!loading && !error && (
          <section className="card mt-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">{reviews.length ? `${reviews.length} due now` : "Nothing due right now"}</h2>
                <p className="mt-2 text-ink/70">
                  {reviews.length
                    ? "Start with these before adding new material."
                    : "No repair tasks are due. That is good news, not a failure to find work."}
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
                      Priority {review.priority} · {review.failureCount} previous lapse{review.failureCount === 1 ? "" : "s"}
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

            {reviews.length > 0 && (
              <button className="button-primary mt-7" disabled={starting} onClick={startFocusedReview}>
                {starting ? "Building your review…" : "Start focused review"}
              </button>
            )}
          </section>
        )}
      </main>
    </AppShell>
  );
}
