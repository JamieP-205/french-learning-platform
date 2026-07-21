"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityRenderer, type SubmissionMetadata } from "@/components/lesson/activity-renderer";
import { ActivityTaskGuide } from "@/components/lesson/activity-task-guide";
import { ActivityTeachingGate } from "@/components/lesson/activity-teaching-gate";
import { LessonStageProgress } from "@/components/lesson/lesson-stage-progress";
import { PromptLanguageText } from "@/components/lesson/prompt-language-text";
import type { ActivityDefinition, AttemptEvidenceKind, Mission, ValidationResultV1 } from "@/lib/domain/types";
import { getConceptDefinitionsForActivity } from "@/lib/content/curriculum";
import {
  emptyLocalLearningProgress,
  loadLocalLearningProgress,
  recordLocalActiveDate,
  recordLocalSkillAttempt,
  resetLocalLearningProgress,
  saveLocalLearningProgress,
  skillForLocalActivity,
  type LocalLearningProgress,
} from "@/lib/local-learning/progress";
import { validateActivityAnswer } from "@/lib/learning/answer-validation";
import { selfCorrectionPrompt } from "@/lib/learning/feedback-sequence";
import { hasSessionCompletionCredit, inferEvidenceKind } from "@/lib/learning/response-transition";
import {
  buildPublicDemoActivities,
  publicDemoMinutes,
  type PublicDemoMode,
} from "@/lib/local-learning/demo-plan";

type DemoAttempt = {
  activity: ActivityDefinition;
  result: ValidationResultV1;
  evidenceKind: AttemptEvidenceKind;
  completed: boolean;
};

export function PublicDemoLesson({ mission, mode = "full" }: { mission: Mission; mode?: PublicDemoMode }) {
  const [progress, setProgress] = useState<LocalLearningProgress>(emptyLocalLearningProgress);
  const [activities, setActivities] = useState<ActivityDefinition[]>(() =>
    buildPublicDemoActivities(mission, emptyLocalLearningProgress.weakActivityIds, mode),
  );
  const [localProgressReady, setLocalProgressReady] = useState(false);

  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<DemoAttempt[]>([]);
  const [result, setResult] = useState<ValidationResultV1>();
  const [firstMiss, setFirstMiss] = useState<ValidationResultV1>();
  const [firstMissAnswer, setFirstMissAnswer] = useState("");
  const [missCount, setMissCount] = useState(0);
  const [taughtConceptIds, setTaughtConceptIds] = useState<string[]>([]);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef<HTMLElement | null>(null);

  const currentActivity = activities[index];
  const completed = index >= activities.length;
  const sessionMistakes = [
    ...new Map(
      attempts
        .filter((attempt) => !attempt.result.isCorrect)
        .map((attempt) => [attempt.activity.id, attempt]),
    ).values(),
  ];
  const sessionCorrectCount = attempts.filter((attempt) => attempt.result.isCorrect).length;
  const checkedAttempts = attempts.filter((attempt) => attempt.evidenceKind !== "self-report");
  const earnsSessionCompletion = hasSessionCompletionCredit({
    attempts: attempts.map((attempt) => ({
      activityId: attempt.activity.id,
      completed: attempt.completed,
      evidenceKind: attempt.evidenceKind,
    })),
    totalActivities: activities.length,
  });
  const currentConcepts = useMemo(
    () => currentActivity ? getConceptDefinitionsForActivity(currentActivity.id) : [],
    [currentActivity],
  );
  const untaughtConcepts = currentConcepts.filter((concept) => !taughtConceptIds.includes(concept.id));
  const needsTeaching = currentConcepts.length === 0 || untaughtConcepts.length > 0;
  const lessonStage = needsTeaching && !result ? "learn" : result ? "feedback" : "answer";
  const activityRule = currentConcepts.at(-1)?.teachingStep.metalinguisticRule;

  useEffect(() => {
    let cancelled = false;

    async function loadSavedProgress() {
      await Promise.resolve();
      if (cancelled) return;
      const savedProgress = loadLocalLearningProgress();
      setProgress(savedProgress);
      setActivities(buildPublicDemoActivities(mission, savedProgress.weakActivityIds, mode));
      setLocalProgressReady(true);
    }

    void loadSavedProgress();
    return () => {
      cancelled = true;
    };
  }, [mission, mode]);

  function updateProgress(nextProgress: LocalLearningProgress) {
    setProgress(nextProgress);
    saveLocalLearningProgress(nextProgress);
  }

  function completeTeaching() {
    setTaughtConceptIds((current) => [
      ...current,
      ...untaughtConcepts.map((concept) => concept.id).filter((id) => !current.includes(id)),
    ]);
    window.setTimeout(() => stepRef.current?.focus(), 0);
  }

  function submit(answer: string, metadata?: SubmissionMetadata) {
    if (!currentActivity || result) return;
    const validatedResult = validateActivityAnswer(currentActivity, answer);
    if (!metadata && !validatedResult.isCorrect && missCount === 0) {
      const evidenceKind = inferEvidenceKind(currentActivity.type);
      setFirstMiss(validatedResult);
      setFirstMissAnswer(answer);
      setMissCount(1);
      setAttempts((current) => [...current, { activity: currentActivity, result: validatedResult, evidenceKind, completed: false }]);

      const nextWeakIds = [
        currentActivity.id,
        ...progress.weakActivityIds.filter((id) => id !== currentActivity.id),
      ].slice(0, 4);
      const nextMistakePrompts = [
        currentActivity.prompt,
        ...progress.mistakePrompts.filter((prompt) => prompt !== currentActivity.prompt),
      ].slice(0, 4);
      const progressWithMiss = recordLocalSkillAttempt({
        progress: {
          ...progress,
          attemptsCount: progress.attemptsCount + 1,
          mistakesCaptured: progress.mistakesCaptured + 1,
          weakActivityIds: nextWeakIds,
          mistakePrompts: nextMistakePrompts,
        },
        skill: skillForLocalActivity(currentActivity),
        correct: false,
      });
      updateProgress(progressWithMiss);
      return;
    }

    const isSpeechCheck = currentActivity.type === "speak_repeat";
    const isAnswerReveal = metadata?.evidenceKind === "self-report" && !isSpeechCheck;
    const verifiedSpeech = isSpeechCheck && metadata?.evidenceKind === "controlled" && metadata.correct === true;
    const evidenceKind: AttemptEvidenceKind = isAnswerReveal
      ? "self-report"
      : isSpeechCheck
        ? verifiedSpeech ? "controlled" : "self-report"
        : inferEvidenceKind(currentActivity.type);
    const nextResult: ValidationResultV1 = isAnswerReveal
      ? {
          ...validatedResult,
          isCorrect: false,
          isNearMiss: false,
          feedback: "Answer revealed without learning credit.",
          mistakeType: undefined,
          shouldCreateReview: false,
        }
      : isSpeechCheck
        ? {
            ...validatedResult,
            isCorrect: verifiedSpeech,
            isNearMiss: false,
            feedback: verifiedSpeech ? currentActivity.feedbackCorrect : "Speaking self-check saved without mastery credit.",
            correctAnswer: currentActivity.targetText ?? currentActivity.prompt,
            mistakeType: undefined,
            shouldCreateReview: false,
          }
        : validatedResult;

    setFirstMiss(undefined);
    setResult(nextResult);
    window.setTimeout(() => feedbackRef.current?.focus(), 0);

    if (evidenceKind === "self-report") return;

    setAttempts((current) => [...current, { activity: currentActivity, result: nextResult, evidenceKind, completed: true }]);
    const nextWeakIds = nextResult.isCorrect
      ? progress.weakActivityIds.filter((id) => id !== currentActivity.id)
      : [currentActivity.id, ...progress.weakActivityIds.filter((id) => id !== currentActivity.id)].slice(0, 4);
    const nextMistakePrompts = nextResult.isCorrect
      ? progress.mistakePrompts.filter((prompt) => prompt !== currentActivity.prompt)
      : [currentActivity.prompt, ...progress.mistakePrompts.filter((prompt) => prompt !== currentActivity.prompt)].slice(0, 4);
    const progressWithAttempt = recordLocalSkillAttempt({
      progress: {
        ...progress,
        attemptsCount: progress.attemptsCount + 1,
        correctCount: progress.correctCount + (nextResult.isCorrect ? 1 : 0),
        mistakesCaptured: progress.mistakesCaptured + (nextResult.isCorrect ? 0 : 1),
        repairsCompleted: progress.repairsCompleted + (
          nextResult.isCorrect && progress.weakActivityIds.includes(currentActivity.id) ? 1 : 0
        ),
        weakActivityIds: nextWeakIds,
        mistakePrompts: nextMistakePrompts,
      },
      skill: skillForLocalActivity(currentActivity),
      correct: nextResult.isCorrect,
    });

    updateProgress({ ...progressWithAttempt, weakActivityIds: nextWeakIds, mistakePrompts: nextMistakePrompts });
  }

  function continueDemo() {
    setResult(undefined);
    setFirstMiss(undefined);
    setFirstMissAnswer("");
    setMissCount(0);
    setIndex((current) => current + 1);
    window.setTimeout(() => stepRef.current?.focus(), 0);

    if (index === activities.length - 1 && earnsSessionCompletion) {
      updateProgress({
        ...recordLocalActiveDate(loadLocalLearningProgress()),
        sessionsCompleted: progress.sessionsCompleted + 1,
        lastCompletedAt: new Date().toISOString(),
      });
    }
  }

  function restartDemo() {
    setActivities(buildPublicDemoActivities(mission, loadLocalLearningProgress().weakActivityIds, mode));
    setIndex(0);
    setAttempts([]);
    setResult(undefined);
    setFirstMiss(undefined);
    setFirstMissAnswer("");
    setMissCount(0);
  }

  function resetLocalProgress() {
    resetLocalLearningProgress();
    setProgress(emptyLocalLearningProgress);
    setTaughtConceptIds([]);
    setConfirmingReset(false);
    restartDemo();
  }

  if (!localProgressReady) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card animate-pulse" role="status">Loading this device’s lesson progress…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <div className="flex items-center justify-between gap-4 text-sm font-bold">
          <Link className="text-ink/75 underline decoration-2 underline-offset-4 hover:text-coral" href="/">
            ← French for Life
          </Link>
          <span className="text-ink/75">
            About {publicDemoMinutes(mission, mode)} minutes · {activities.length} steps
          </span>
        </div>
        <p className="eyebrow mt-8">{mode === "short" ? "Quick practice" : "Lesson 1"}</p>
        <h1 className="mt-3 text-4xl font-black leading-tight">Introduce yourself</h1>
        <p className="mt-3 max-w-xl text-lg leading-7 text-ink/75">
          Learn one useful phrase, then try it straight away.
        </p>
        <p className="mt-2 text-sm font-bold text-ink/75">No account needed. Your progress stays on this device.</p>
      </header>

      {progress.weakActivityIds.length > 0 && !completed && (
        <p className="mt-6 rounded-2xl bg-amber/20 p-4 text-sm font-bold text-ink">
          Welcome back. We moved a question you found difficult nearer the start.
        </p>
      )}

      {!completed && currentActivity && (
        <section ref={stepRef} data-testid="lesson-step" tabIndex={-1} className="card focus-target mt-7">
          <LessonStageProgress current={index + 1} total={activities.length} stage={lessonStage} />

          {needsTeaching && !result ? (
            <div className="mt-7">
              <ActivityTeachingGate concepts={untaughtConcepts} onComplete={completeTeaching} headingLevel={2} />
            </div>
          ) : (
            <>
              <p className="eyebrow mt-7">{progress.weakActivityIds.includes(currentActivity.id) ? "Try this again" : "Your turn"}</p>
              <h2 className="mt-3 text-3xl font-black leading-tight">
                <PromptLanguageText
                  text={currentActivity.prompt}
                  frenchSegments={currentActivity.promptFrenchSegments}
                />
              </h2>
              {currentActivity.helperText && <p className="mt-3 text-ink/75">{currentActivity.helperText}</p>}
              {!result && <ActivityTaskGuide type={currentActivity.type} />}

              {!result && <ActivityRenderer activity={currentActivity} disabled={false} onSubmit={submit} />}

              {firstMiss && !result && (
                <div className="status-coaching mt-5" aria-live="polite">
                  <p className="font-black">Try once more</p>
                  <p className="mt-2">{selfCorrectionPrompt(currentActivity, firstMiss)}</p>
                  <button
                    className="mt-4 text-sm font-black text-coral underline decoration-2 underline-offset-4"
                    type="button"
                    onClick={() => submit(firstMissAnswer, { completed: true, correct: false, evidenceKind: "self-report" })}
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
                      : currentActivity.type === "speak_repeat" ? "Practice saved" : "Here’s the answer"}
                  </p>
                  {result.isCorrect && <p className="mt-2">{result.feedback}</p>}
                  {!result.isCorrect && currentActivity.type !== "speak_repeat" && (
                    <p lang="fr" className="mt-3 text-lg font-black">{result.correctAnswer}</p>
                  )}
                  {!result.isCorrect && activityRule && currentActivity.type !== "speak_repeat" && (
                    <p className="mt-3 text-sm leading-6 text-ink/75">{activityRule}</p>
                  )}
                  {!result.isCorrect && currentActivity.type === "speak_repeat" && (
                    <p className="mt-2 text-sm text-ink/75">This self-check does not affect your progress.</p>
                  )}
                </div>
              )}

              {result && (
                <button className="button-primary mt-7 w-full" onClick={continueDemo}>
                  {index === activities.length - 1 ? "Finish lesson" : "Continue"}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {completed && (
        <section ref={stepRef} data-testid="lesson-step" tabIndex={-1} className="card focus-target mt-7 bg-moss/10">
          <p className="eyebrow">Lesson complete</p>
          <h2 className="mt-2 text-3xl font-black">Lesson finished</h2>
          <p className="mt-3 text-ink/75">
            {earnsSessionCompletion
              ? `You made ${checkedAttempts.length} checked attempt${checkedAttempts.length === 1 ? "" : "s"} and got ${sessionCorrectCount} right. Checked mistakes are saved on this device and move nearer the start when you practise again.`
              : "You reached the end, but too many answers were shown for this to count as a completed practice session. Try it again when you are ready."}
          </p>
          {sessionMistakes.length > 0 && (
            <div className="mt-5 rounded-2xl bg-surface p-4">
              <p className="font-black">Practise these next time</p>
              <ul className="mt-3 space-y-2 text-sm text-ink/75">
                {sessionMistakes.map((attempt) => (
                  <li lang="fr" key={attempt.activity.id}>{attempt.result.correctAnswer}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="button-primary" onClick={restartDemo}>Practise again</button>
            <Link className="button-secondary" href="/learn">Choose another lesson</Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {confirmingReset ? (
              <>
                <p className="status-coaching w-full" role="alert">
                  This clears every lesson attempt, review reminder, and preference saved in this browser. It cannot be undone.
                </p>
                <button className="button-secondary border-coral/60" type="button" onClick={resetLocalProgress}>
                  Yes, reset browser progress
                </button>
                <button className="button-secondary" type="button" onClick={() => setConfirmingReset(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="text-sm font-bold text-ink/75 underline" type="button" onClick={() => setConfirmingReset(true)}>
                Reset progress on this device
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
