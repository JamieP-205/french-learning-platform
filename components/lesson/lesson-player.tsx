"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActivityDefinition, AttemptEvidenceKind, ProgressSnapshot, SessionRecord, TutorFeedbackV1, ValidationResultV1 } from "@/lib/domain/types";
import { ActivityRenderer } from "@/components/lesson/activity-renderer";
import { ActivityTaskGuide } from "@/components/lesson/activity-task-guide";
import { ActivityTeachingGate } from "@/components/lesson/activity-teaching-gate";
import { LessonStageProgress } from "@/components/lesson/lesson-stage-progress";
import { PromptLanguageText } from "@/components/lesson/prompt-language-text";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";
import { getConceptDefinitionsForActivity } from "@/lib/content/curriculum";
import { validateActivityAnswer } from "@/lib/learning/answer-validation";
import { inferEvidenceKind } from "@/lib/learning/response-transition";

export function LessonPlayer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionRecord>();
  const [result, setResult] = useState<ValidationResultV1>();
  const [firstMiss, setFirstMiss] = useState<ValidationResultV1>();
  const [firstMissAnswer, setFirstMissAnswer] = useState("");
  const [missCount, setMissCount] = useState(0);
  const [taughtConceptIds, setTaughtConceptIds] = useState<string[]>([]);
  const [resultEvidenceKind, setResultEvidenceKind] = useState<AttemptEvidenceKind>();
  const [answeredActivity, setAnsweredActivity] = useState<ActivityDefinition>();
  const [tutor, setTutor] = useState<TutorFeedbackV1>();
  const [explaining, setExplaining] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0, fastestMs: Number.POSITIVE_INFINITY });
  const [completedProgress, setCompletedProgress] = useState<ProgressSnapshot>();
  const startedAt = useRef<number | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    startedAt.current = Date.now();

    async function loadSession() {
      try {
        const response = await fetch(`/api/session/${sessionId}`, { headers: await getBrowserAuthHeaders() });
        const payload = await response.json();

        if (cancelled) return;
        if (!response.ok) setError(payload.error);
        else setSession(payload.session);
      } catch {
        if (!cancelled) setError("This session could not load.");
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const planned = session?.plan.activities[session.currentIndex];
  const displayActivity = answeredActivity ?? planned?.activity;
  const currentConcepts = useMemo(
    () => displayActivity ? getConceptDefinitionsForActivity(displayActivity.id) : [],
    [displayActivity],
  );
  const untaughtConcepts = currentConcepts.filter((concept) => !taughtConceptIds.includes(concept.id));
  const needsTeaching = currentConcepts.length === 0 || untaughtConcepts.length > 0;

  const activityRule = displayActivity
    ? currentConcepts.at(-1)?.teachingStep.metalinguisticRule
    : undefined;

  function completeTeaching() {
    setTaughtConceptIds((current) => [
      ...current,
      ...untaughtConcepts.map((concept) => concept.id).filter((id) => !current.includes(id)),
    ]);
    window.setTimeout(() => stepRef.current?.focus(), 0);
  }

  async function submit(answer: string, metadata?: { completed: boolean; correct: boolean; evidenceKind: AttemptEvidenceKind }) {
    if (!planned) return;
    const preview = validateActivityAnswer(planned.activity, answer);
    const isFirstWrongAttempt = !metadata && !preview.isCorrect && missCount === 0;
    const submissionMetadata = metadata ?? (isFirstWrongAttempt
      ? {
          completed: false,
          correct: false,
          evidenceKind: inferEvidenceKind(planned.activity.type),
        }
      : undefined);
    const answerStartedAt = startedAt.current ?? Date.now();
    const latencyMs = Date.now() - answerStartedAt;
    setSubmitting(true);
    setError(undefined);
    setTutor(undefined);
    let submission;
    try {
      const response = await fetch("/api/activity/submit", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify({
          sessionId,
          activityId: planned.activity.id,
          submittedAnswer: answer,
          latencyMs,
          ...submissionMetadata,
        }),
      });
      submission = { response, payload: await response.json() };
    } catch {
      setError("We couldn’t save that answer. Your response is still here, so you can try again.");
      return;
    } finally {
      setSubmitting(false);
    }
    const { response, payload } = submission;
    if (!response.ok) return setError(payload.error ?? "Your answer could not be saved.");
    const nextSession = payload.session as SessionRecord;
    const nextResult = payload.attempt.result as ValidationResultV1;
    const attemptEvidenceKind = payload.attempt.evidenceKind as AttemptEvidenceKind | undefined;
    const attemptCompleted = payload.attempt.completed ?? true;
    if (!attemptCompleted && !nextResult.isCorrect) {
      setFirstMiss(nextResult);
      setFirstMissAnswer(answer);
      setMissCount(1);
      return;
    }
    setAnsweredActivity(planned.activity);
    setFirstMiss(undefined);
    setResult(nextResult);
    setResultEvidenceKind(attemptEvidenceKind);
    setSession(nextSession);
    if (attemptCompleted && attemptEvidenceKind !== "self-report") {
      setSessionStats((stats) => ({
        correct: stats.correct + (nextResult.isCorrect ? 1 : 0),
        total: stats.total + 1,
        fastestMs: Math.min(stats.fastestMs, latencyMs),
      }));
    }
    if (nextSession.completedAt) {
      try {
        const progressResponse = await fetch("/api/progress", { headers: await getBrowserAuthHeaders() });
        const progressPayload = await progressResponse.json();
        if (progressResponse.ok) setCompletedProgress(progressPayload.progress as ProgressSnapshot);
      } catch {
        // Completion still works without the reward snapshot; /progress will load it next.
      }
    }
    startedAt.current = Date.now();
    // Move keyboard and screen-reader focus to the feedback so the result is announced.
    window.setTimeout(() => feedbackRef.current?.focus(), 0);
  }

  async function explain() {
    if (!displayActivity || !result || explaining) return;
    setExplaining(true);
    try {
      const response = await fetch("/api/tutor/message", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify({
          sessionId,
          activityId: displayActivity.id,
          submittedAnswer: result.normalizedAnswer,
        }),
      });
      const payload = await response.json();
      if (!response.ok) setError(payload.error);
      else setTutor(payload.feedback);
    } finally {
      setExplaining(false);
    }
  }

  function continueSession() {
    setResult(undefined);
    setFirstMiss(undefined);
    setFirstMissAnswer("");
    setMissCount(0);
    setResultEvidenceKind(undefined);
    setTutor(undefined);
    setAnsweredActivity(undefined);
    startedAt.current = Date.now();
    if (session?.completedAt) {
      router.push("/progress?complete=1");
    } else {
      window.setTimeout(() => stepRef.current?.focus(), 0);
    }
  }

  if (error && !session) return <main className="page-shell py-10"><p className="status-error" role="alert">{error}</p></main>;
  if (!session || !displayActivity || (!planned && !result)) {
    return <main className="page-shell py-10"><div className="card animate-pulse">Loading your focused session…</div></main>;
  }

  const displayEntry = result
    ? session.plan.activities.find((entry) => entry.activity.id === displayActivity.id) ?? session.plan.activities.at(-1)!
    : planned!;
  const step = Math.min(session.currentIndex + (result ? 0 : 1), session.plan.activities.length);
  const lessonStage = needsTeaching && !result ? "learn" : result ? "feedback" : "answer";
  const completionAccuracy = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
  const fastestAnswer = Number.isFinite(sessionStats.fastestMs)
    ? `${Math.max(1, Math.round(sessionStats.fastestMs / 1000))}s`
    : "Saved";

  return (
    <main className="page-shell py-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <span>{session.plan.mode === "comeback" ? "A gentle restart" : session.plan.missionTitle}</span>
          <Link className="min-h-11 content-center text-ink/75 underline underline-offset-4 hover:text-coral" href="/today">
            Save &amp; exit
          </Link>
        </div>

        <section ref={stepRef} data-testid="lesson-step" tabIndex={-1} className="card focus-target mt-7">
          <LessonStageProgress current={step} total={session.plan.activities.length} stage={lessonStage} />
          {needsTeaching && !result ? (
            <div className="mt-7">
              <ActivityTeachingGate concepts={untaughtConcepts} onComplete={completeTeaching} />
            </div>
          ) : <>
            <p className="eyebrow mt-7">
              {displayEntry.kind === "repair" ? "Try this again" : displayEntry.kind === "review" ? "Quick review" : "Your turn"}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight">
              <PromptLanguageText
                text={displayActivity.prompt}
                frenchSegments={displayActivity.promptFrenchSegments}
              />
            </h1>
            {displayActivity.helperText && <p className="mt-3 text-ink/70">{displayActivity.helperText}</p>}
            {!result && <ActivityTaskGuide type={displayActivity.type} />}

          {!result && (
            <ActivityRenderer activity={displayActivity} disabled={submitting} onSubmit={submit} />
          )}

          {firstMiss && !result && (
            <div className="status-coaching mt-5" aria-live="polite">
              <p className="font-black">Try once more</p>
              <p className="mt-2">{firstMiss.feedback}</p>
              <button
                className="mt-4 text-sm font-black text-coral underline decoration-2 underline-offset-4 disabled:opacity-60"
                type="button"
                disabled={submitting}
                onClick={() => void submit(firstMissAnswer, { completed: true, correct: false, evidenceKind: "self-report" })}
              >
                Show me the answer
              </button>
            </div>
          )}

          {result && (
            <div
              ref={feedbackRef}
              tabIndex={-1}
              className={`${result.isCorrect ? "status-success" : "status-coaching"} focus-target mt-8`}
              aria-live="polite"
            >
              <p className="font-black">
                {result.isCorrect
                  ? "Correct"
                  : displayActivity.type === "speak_repeat_placeholder" ? "Practice saved" : "Here’s the answer"}
              </p>
              {result.isCorrect && <p className="mt-2">{result.feedback}</p>}
              {!result.isCorrect && displayActivity.type !== "speak_repeat_placeholder" && (
                <p lang="fr" className="mt-3 text-lg font-black">{result.correctAnswer}</p>
              )}
              {!result.isCorrect && activityRule && displayActivity.type !== "speak_repeat_placeholder" && (
                <p className="mt-3 text-sm leading-6 text-ink/75">{activityRule}</p>
              )}
              {!result.isCorrect && displayActivity.type !== "speak_repeat_placeholder" && !tutor && (
                <button className="mt-4 text-sm font-bold text-coral underline disabled:opacity-60" disabled={explaining} onClick={explain}>
                  {explaining ? "Getting the explanation…" : "More explanation"}
                </button>
              )}
              {!result.isCorrect && resultEvidenceKind === "self-report" && displayActivity.type === "speak_repeat_placeholder" && (
                <p className="mt-2 text-sm text-ink/75">This self-check does not affect your progress.</p>
              )}
            </div>
          )}

          {tutor && (
            <aside className="mt-5 rounded-2xl border border-moss/25 bg-moss/10 p-5">
              <p className="eyebrow text-moss">Tutor note</p>
              <h2 className="mt-2 font-black">{tutor.headline}</h2>
              <p className="mt-2 text-sm leading-6">{tutor.explanation}</p>
              <p className="mt-3 text-sm font-bold">Try next: {tutor.followUp}</p>
            </aside>
          )}

          {result && session.completedAt && (
            <aside className="mt-5 rounded-2xl bg-moss/10 p-5">
              <p className="eyebrow text-moss">Lesson finished</p>
              <h2 className="mt-2 font-black">Your practice is saved</h2>
              <p className="mt-2 text-sm leading-6 text-ink/75">
                Progress records what you answered here; it does not claim a level or ability from completion alone.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs font-black uppercase text-ink/70">This session</p>
                  <p className="mt-1 text-xl font-black">
                    {sessionStats.correct}/{sessionStats.total}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs font-black uppercase text-ink/70">Accuracy</p>
                  <p className="mt-1 text-xl font-black">{completionAccuracy}%</p>
                </div>
                <div className="rounded-2xl bg-white/70 p-3">
                  <p className="text-xs font-black uppercase text-ink/70">Fastest answer</p>
                  <p className="mt-1 text-xl font-black">{fastestAnswer}</p>
                </div>
              </div>
              {completedProgress && (
                <p className="mt-4 text-sm font-bold text-ink/75">
                  Streak: {completedProgress.currentStreak} day{completedProgress.currentStreak === 1 ? "" : "s"}.
                  {" "}
                  {completedProgress.streakFreezes > 0
                    ? `${completedProgress.streakFreezes} freeze${completedProgress.streakFreezes === 1 ? "" : "s"} banked.`
                    : "Seven steady days banks a freeze."}
                </p>
              )}
            </aside>
          )}

          {result && <button className="button-primary mt-7 w-full" onClick={continueSession}>{session.completedAt ? "See your progress" : "Continue"}</button>}
          {error && <p className="status-error mt-5" role="alert">{error}</p>}
          </>}
        </section>
        <details className="mx-auto mt-5 w-fit text-sm text-ink/75">
          <summary className="cursor-pointer font-bold">Why this question?</summary>
          <p className="mt-2 max-w-xl text-center">{displayEntry.rationale}</p>
        </details>
      </div>
    </main>
  );
}

