"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { ActivityTeachingGate } from "@/components/lesson/activity-teaching-gate";
import { getConceptDefinitionsForActivity } from "@/lib/content/curriculum";
import type { TopicSelfCheck } from "@/lib/content/topic-previews";
import {
  emptyLocalLearningProgress,
  loadLocalLearningProgress,
  localLearningStorageKey,
  localProgressUpdatedEvent,
  localTopicPreviewSummary,
  recordLocalTopicPreviewCheck,
  saveLocalLearningProgress,
} from "@/lib/local-learning/progress";
import { normalizeFrenchAnswer } from "@/lib/learning/answer-validation";

function subscribeToLocalProgress(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localProgressUpdatedEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localProgressUpdatedEvent, onStoreChange);
  };
}

function getLocalProgressSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(localLearningStorageKey) ?? "";
}

function getServerProgressSnapshot() {
  return "";
}

export function TopicPreviewPractice({
  topicSlug,
  selfChecks,
  onScoredStateChange,
}: {
  topicSlug: string;
  selfChecks: TopicSelfCheck[];
  onScoredStateChange?: (active: boolean) => void;
}) {
  const progressSnapshot = useSyncExternalStore(
    subscribeToLocalProgress,
    getLocalProgressSnapshot,
    getServerProgressSnapshot,
  );
  const progress = useMemo(
    () => (progressSnapshot ? loadLocalLearningProgress() : emptyLocalLearningProgress),
    [progressSnapshot],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [taughtCheckKey, setTaughtCheckKey] = useState<string>();
  const [missCount, setMissCount] = useState(0);
  const [firstMiss, setFirstMiss] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [checked, setChecked] = useState<{ correct: boolean; message: string; selfReport?: boolean }>();
  const activeCheck = selfChecks[activeIndex];
  const checkKey = `preview:${topicSlug}:${activeIndex}`;
  const teachingConcepts = getConceptDefinitionsForActivity(checkKey);
  const summary = localTopicPreviewSummary(progress, topicSlug);

  if (!activeCheck) return null;

  function acceptedAnswers(check: TopicSelfCheck) {
    return check.acceptedAnswers?.length ? check.acceptedAnswers : [check.answer];
  }

  function answerMatches(check: TopicSelfCheck, answer: string) {
    return acceptedAnswers(check).some(
      (accepted) =>
        normalizeFrenchAnswer(accepted) === normalizeFrenchAnswer(answer) ||
        normalizeFrenchAnswer(accepted, true) === normalizeFrenchAnswer(answer, true),
    );
  }

  function saveCheck(confident: boolean) {
    const nextProgress = recordLocalTopicPreviewCheck({
      progress,
      topicSlug,
      prompt: activeCheck.prompt,
      confident,
    });
    saveLocalLearningProgress(nextProgress);
  }

  function checkTypedAnswer(event: FormEvent) {
    event.preventDefault();
    const correct = answerMatches(activeCheck, typedAnswer);
    if (!correct && missCount === 0) {
      setMissCount(1);
      setFirstMiss(true);
      return;
    }
    saveCheck(correct);
    onScoredStateChange?.(false);
    setRevealed(true);
    setChecked({
      correct,
      message: correct
        ? "Correct. Saved for future practice."
        : "Not quite. Saved to Review so it comes back later.",
    });
  }

  function nextSelfCheck() {
    setRevealed(false);
    setTypedAnswer("");
    setChecked(undefined);
    setFirstMiss(false);
    setMissCount(0);
    setTaughtCheckKey(undefined);
    onScoredStateChange?.(false);
    setActiveIndex((current) => (current + 1) % selfChecks.length);
  }

  function revealWithoutCredit() {
    setFirstMiss(false);
    setRevealed(true);
    setChecked({ correct: false, selfReport: true, message: "Here is the answer. Showing it does not mark the item correct or add it to Review." });
    onScoredStateChange?.(false);
  }

  return (
    <section className="card">
      <p className="eyebrow">Preview practice</p>
      <h2 className="mt-2 text-2xl font-black">Try the phrase from memory.</h2>
      <p className="mt-3 text-sm text-ink/70">
        A missed answer can be saved to Review. Preview practice does not count as a completed lesson.
      </p>

      <div className="mt-5 rounded-2xl bg-cream p-5">
        {taughtCheckKey !== checkKey ? (
          teachingConcepts.length > 0 ? (
            <ActivityTeachingGate
              concepts={teachingConcepts}
              actionLabel="Start preview check"
              headingLevel={3}
              onComplete={() => {
                setTaughtCheckKey(checkKey);
                onScoredStateChange?.(true);
              }}
            />
          ) : (
            <p className="status-error">This practice item is not available yet. Choose another one.</p>
          )
        ) : <>
        <p className="text-xs font-black uppercase tracking-wide text-coral">
          Self-check {activeIndex + 1} of {selfChecks.length}
        </p>
        <h3 className="mt-2 text-xl font-black">{activeCheck.prompt}</h3>

        {!firstMiss && !revealed && <form onSubmit={checkTypedAnswer} className="mt-5 space-y-3">
          <label className="block font-bold">
            Your answer
            <input
              className="field"
              lang="fr"
              value={typedAnswer}
              onChange={(event) => {
                setTypedAnswer(event.target.value);
                setChecked(undefined);
              }}
              placeholder="Type the French phrase"
              autoComplete="off"
            />
          </label>
          <button className="button-primary" type="submit" disabled={!typedAnswer.trim()}>
            Check preview answer
          </button>
        </form>}

        {firstMiss && (
          <div className="status-error mt-5" aria-live="polite" data-testid="preview-practice-feedback">
            <p className="font-black">Almost — try once more.</p>
            <p className="mt-2">
              Which taught form lets you {teachingConcepts.at(-1)?.teachingStep.function.toLowerCase() ?? "express this meaning"}?
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="button-primary" type="button" onClick={() => { setFirstMiss(false); setTypedAnswer(""); }}>Try again</button>
              <button className="button-secondary" type="button" onClick={revealWithoutCredit}>Show me the answer</button>
            </div>
          </div>
        )}

        {checked && (
          <div className={checked.correct ? "status-success mt-5" : "status-error mt-5"} aria-live="polite">
            <p className="font-black">{checked.selfReport ? "Answer shown." : checked.correct ? "That works." : "Added to Review."}</p>
            <p className="mt-2">{checked.message}</p>
          </div>
        )}

        {revealed ? (
          <div className="mt-5 rounded-2xl bg-surface p-4" aria-live="polite">
            <p className="text-lg font-black" data-testid="preview-practice-answer" lang="fr">
              {activeCheck.answer}
            </p>
            <p className="mt-2 text-sm text-ink/70">{activeCheck.reason}</p>
          </div>
        ) : !firstMiss ? (
          <button className="button-secondary mt-5" onClick={revealWithoutCredit}>
            Show answer
          </button>
        ) : null}

        {revealed && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="button-primary" onClick={nextSelfCheck}>
              Next self-check
            </button>
          </div>
        )}
        </>}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-cream p-4">
          <p className="eyebrow">Seen</p>
          <p className="mt-1 text-3xl font-black">{summary.seenCount}</p>
        </div>
        <div className="rounded-2xl bg-cream p-4">
          <p className="eyebrow">Confident</p>
          <p className="mt-1 text-3xl font-black">{summary.confidentCount}</p>
        </div>
        <div className="rounded-2xl bg-cream p-4">
          <p className="eyebrow">Review</p>
          <p className="mt-1 text-3xl font-black" data-testid="preview-practice-review-count">
            {summary.needsReviewCount}
          </p>
        </div>
      </div>
    </section>
  );
}
