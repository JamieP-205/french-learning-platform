"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { getTopicPreview } from "@/lib/content/topic-previews";
import {
  emptyLocalLearningProgress,
  localProgressUpdatedEvent,
  localLearningStorageKey,
  localLearningAchievements,
  localLearningAccuracy,
  localDailyPlan,
  localLearningDaysSince,
  localLevelRoadmap,
  localLearningNextAction,
  localLearningPath,
  localLearnerPreferenceSummary,
  localSkillReadiness,
  localTopicPreviewSummary,
  recordLocalTopicPreviewCheck,
  resetLocalLearningProgress,
  saveLocalLearningProgress,
  type LocalLearningProgress,
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

function getLocalProgressSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(localLearningStorageKey) ?? "";
}

function getServerProgressSnapshot(): string {
  return "";
}

function parseLocalProgressSnapshot(snapshot: string): LocalLearningProgress {
  if (!snapshot) return emptyLocalLearningProgress;

  try {
    const parsed = JSON.parse(snapshot);
    return {
      ...emptyLocalLearningProgress,
      ...parsed,
      topicPreviewStats: parsed.topicPreviewStats ?? {},
      skillSignals: parsed.skillSignals ?? {},
      activeDates: parsed.activeDates ?? [],
      preferences: {
        ...emptyLocalLearningProgress.preferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return emptyLocalLearningProgress;
  }
}

function notifyLocalProgressChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(localProgressUpdatedEvent));
  }
}

function useLocalProgress() {
  const snapshot = useSyncExternalStore(subscribeToLocalProgress, getLocalProgressSnapshot, getServerProgressSnapshot);
  const progress = useMemo(() => parseLocalProgressSnapshot(snapshot), [snapshot]);

  function save(progressToSave: LocalLearningProgress) {
    saveLocalLearningProgress(progressToSave);
  }

  function reset() {
    resetLocalLearningProgress();
    notifyLocalProgressChanged();
  }

  return { progress, reset, save };
}

function ConfirmedLocalReset({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="button-secondary" type="button" onClick={() => setConfirming(true)}>
        Reset all browser progress
      </button>
    );
  }

  return (
    <>
      <p className="status-coaching w-full" role="alert">
        This clears every lesson attempt, review reminder, and preference saved in this browser. It cannot be undone.
      </p>
      <button
        className="button-secondary border-coral/60"
        type="button"
        onClick={() => {
          onReset();
          setConfirming(false);
        }}
      >
        Yes, reset browser progress
      </button>
      <button className="button-secondary" type="button" onClick={() => setConfirming(false)}>
        Cancel
      </button>
    </>
  );
}

export function PublicLocalTodayPanel() {
  const { progress } = useLocalProgress();
  const nextAction = localLearningNextAction(progress);
  const isComeback = nextAction.tone === "comeback";
  const isRepair = nextAction.tone === "repair";
  const preferenceSummary = localLearnerPreferenceSummary(progress);
  const dailyPlan = localDailyPlan(progress);

  return (
    <section className={isComeback ? "card mt-7 bg-amber/20" : "card mt-7 bg-moss/10"}>
      <p className="eyebrow">Learning on this device</p>
      <h2 className="mt-2 text-3xl font-black">
        {nextAction.title}
      </h2>
      <p className="mt-3 max-w-2xl text-ink/75">
        {nextAction.reason} New lessons are added only after review.
      </p>
      <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold text-ink/75">
        Local setup: {preferenceSummary.headline}. {preferenceSummary.detail}
      </p>
      {isRepair && (
        <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold text-ink/75">
          Repair target: {progress.mistakePrompts[0] ?? "your most recent missed activity"}
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="button-primary" href={nextAction.href}>
          {nextAction.label}
        </Link>
        <Link className="button-secondary" href="/progress">
          See progress
        </Link>
      </div>

      <div className="mt-7">
        <p className="eyebrow">Today&apos;s plan</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {dailyPlan.map((step, index) => (
            <Link key={step.id} href={step.href} className="rounded-2xl bg-white/70 p-4 transition hover:bg-white">
              <p className="text-xs font-black uppercase tracking-wide text-coral">
                {String(index + 1).padStart(2, "0")} · {step.kicker} · {step.estimatedMinutes} min
              </p>
              <h3 className="mt-2 font-black">{step.title}</h3>
              <p className="mt-2 text-sm text-ink/70">{step.description}</p>
              <p className="mt-3 text-sm font-black text-coral">{step.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PublicLocalProgressPanel() {
  const { progress, reset } = useLocalProgress();
  const accuracy = localLearningAccuracy(progress);
  const daysAway = localLearningDaysSince(progress.lastCompletedAt);
  const achievements = localLearningAchievements(progress);
  const earnedAchievements = achievements.filter((achievement) => achievement.earned);
  const path = localLearningPath(progress);
  const nextAction = localLearningNextAction(progress);
  const preferenceSummary = localLearnerPreferenceSummary(progress);
  const skillReadiness = localSkillReadiness(progress);
  const levelRoadmap = localLevelRoadmap(progress);
  const topicSummaries = Object.keys(progress.topicPreviewStats).map((topicSlug) => ({
    topicSlug,
    ...localTopicPreviewSummary(progress, topicSlug),
  }));

  return (
    <section className="mt-7 space-y-6">
      <div className="card bg-moss/10">
        <p className="eyebrow">Progress on this device</p>
        <h2 className="mt-2 text-3xl font-black">Your practice, saved in this browser.</h2>
        <p className="mt-3 max-w-2xl text-ink/75">
          Missed answers can return at the right time without creating an account or sending this progress to our server.
        </p>
        <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm font-bold text-ink/75">
          {preferenceSummary.headline} — {preferenceSummary.detail}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="eyebrow">Sessions</p>
          <p className="mt-2 text-4xl font-black">{progress.sessionsCompleted}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Accuracy</p>
          <p className="mt-2 text-4xl font-black">{accuracy}%</p>
        </div>
        <div className="card">
          <p className="eyebrow">Attempts</p>
          <p className="mt-2 text-4xl font-black">{progress.attemptsCount}</p>
        </div>
        <div className="card">
          <p className="eyebrow">Last session</p>
          <p className="mt-2 text-2xl font-black">{daysAway === undefined ? "Not yet" : daysAway === 0 ? "Today" : `${daysAway}d ago`}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card">
          <p className="eyebrow">Path</p>
          <h2 className="mt-2 text-2xl font-black">A clear route from your first lesson to real situations.</h2>
          <ol className="mt-5 space-y-3">
            {path.map((step, index) => (
              <li
                key={step.id}
                className={step.current ? "rounded-2xl bg-amber/20 p-4" : step.complete ? "rounded-2xl bg-moss/10 p-4" : "rounded-2xl bg-cream p-4 text-ink/70"}
              >
                <p className="text-xs font-black uppercase tracking-wide text-coral">
                  {step.complete ? "Done" : step.current ? "Now" : `Next ${index + 1}`}
                </p>
                <h3 className="mt-1 font-black">{step.title}</h3>
                <p className="mt-1 text-sm">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <p className="eyebrow">Achievements</p>
          <h2 className="mt-2 text-2xl font-black">{earnedAchievements.length} earned through completed practice.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {achievements.map((achievement) => (
              <article
                key={achievement.id}
                className={achievement.earned ? "rounded-2xl bg-moss/10 p-4" : "rounded-2xl bg-cream p-4 opacity-75"}
              >
                <p className="text-xs font-black uppercase tracking-wide text-coral">
                  {achievement.earned ? "Earned" : "Locked"}
                </p>
                <h3 className="mt-1 font-black">{achievement.title}</h3>
                <p className="mt-1 text-sm text-ink/70">{achievement.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="card">
          <p className="eyebrow">Skills you have practised</p>
          <h2 className="mt-2 text-2xl font-black">The app adapts from what you actually do.</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {skillReadiness.map((skill) => (
              <article key={skill.key} className="rounded-2xl bg-cream p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black">{skill.label}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-ink/70">
                    {skill.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink/70">
                  {skill.attempts === 0
                    ? "Not practised yet."
                    : `${skill.accuracy}% across ${skill.attempts} attempt${skill.attempts === 1 ? "" : "s"}.`}
                </p>
                {skill.needsReview > 0 && (
                  <p className="mt-2 text-sm font-bold text-coral">
                     {skill.needsReview} answer{skill.needsReview === 1 ? "" : "s"} to revisit.
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Level route</p>
          <h2 className="mt-2 text-2xl font-black">Your selected level and the lessons actually available.</h2>
          <div className="mt-5 space-y-3">
            {levelRoadmap.map((step) => (
              <article key={step.level} className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-black uppercase tracking-wide text-coral">
                  {step.level} · {{ calibrate: "Selected", active: "Practised", preview: "Foundation", later: "Not available yet" }[step.status]}
                </p>
                <h3 className="mt-1 font-black">{step.title}</h3>
                <p className="mt-1 text-sm text-ink/70">{step.description}</p>
              </article>
            ))}
          </div>
          <Link className="button-secondary mt-5" href="/settings">
            Adjust level and goal
          </Link>
        </div>
      </div>

      <div className="card">
        <p className="eyebrow">Recommended next</p>
        <h2 className="mt-2 text-2xl font-black">{nextAction.title}</h2>
        <p className="mt-3 text-ink/75">{nextAction.reason}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="button-primary" href={nextAction.href}>
            {nextAction.label}
          </Link>
          <ConfirmedLocalReset onReset={reset} />
        </div>
      </div>

      {topicSummaries.length > 0 && (
        <div className="card">
          <p className="eyebrow">Preview practice</p>
          <h2 className="mt-2 text-2xl font-black">Practical topics you have warmed up.</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {topicSummaries.map((summary) => (
              <Link key={summary.topicSlug} href={`/learn/${summary.topicSlug}`} className="rounded-2xl bg-cream p-4 transition hover:bg-ink/10">
                <p className="text-xs font-black uppercase tracking-wide text-coral">{summary.topicSlug.replaceAll("-", " ")}</p>
                <h3 className="mt-2 font-black">
                  {summary.confidentCount} confident · {summary.needsReviewCount} to revisit
                </h3>
                <p className="mt-1 text-sm text-ink/70">
                  Preview checks do not count as completed lessons yet, but they help bring useful topics back for practice.
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function PublicLocalReviewPanel() {
  const { progress, reset, save } = useLocalProgress();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, { correct: boolean; text: string; stage?: "prompt" | "recast" | "self-report" }>>({});
  const [missCounts, setMissCounts] = useState<Record<string, number>>({});
  const [recentlyRepaired, setRecentlyRepaired] = useState<string[]>([]);
  const nextAction = localLearningNextAction(progress);
  const topicReviewEntries = Object.entries(progress.topicPreviewStats).flatMap(([topicSlug, stats]) =>
    stats.needsReviewPrompts.map((prompt) => ({ topicSlug, prompt })),
  );
  const reviewCount = progress.mistakePrompts.length + topicReviewEntries.length;
  const previewReviewChecks = topicReviewEntries.map((entry) => {
    const topic = getTopicPreview(entry.topicSlug);
    const checkIndex = topic?.selfChecks.findIndex((selfCheck) => selfCheck.prompt === entry.prompt) ?? -1;
    const check = checkIndex >= 0 ? topic?.selfChecks[checkIndex] : undefined;
    return {
      ...entry,
      checkIndex,
      answer: check?.answer,
      acceptedAnswers: check?.acceptedAnswers?.length ? check.acceptedAnswers : check?.answer ? [check.answer] : [],
      reason: check?.reason,
    };
  });

  function reviewAnswerMatches(acceptedAnswers: string[], submittedAnswer: string) {
    return acceptedAnswers.some(
      (acceptedAnswer) =>
        normalizeFrenchAnswer(acceptedAnswer) === normalizeFrenchAnswer(submittedAnswer) ||
        normalizeFrenchAnswer(acceptedAnswer, true) === normalizeFrenchAnswer(submittedAnswer, true),
    );
  }

  function checkPreviewReview(
    event: FormEvent,
    entry: { topicSlug: string; prompt: string; acceptedAnswers: string[]; answer?: string; reason?: string },
  ) {
    event.preventDefault();
    const key = `${entry.topicSlug}-${entry.prompt}`;
    const submittedAnswer = answers[key] ?? "";
    const correct = reviewAnswerMatches(entry.acceptedAnswers, submittedAnswer);

    if (!correct && (missCounts[key] ?? 0) === 0) {
      setMissCounts((current) => ({ ...current, [key]: 1 }));
      setMessages((current) => ({
        ...current,
        [key]: {
          correct: false,
          stage: "prompt",
          text: "Almost — try once more. Which taught form fits this meaning and situation?",
        },
      }));
      return;
    }

    if (correct) {
      setRecentlyRepaired((current) => [entry.prompt, ...current.filter((prompt) => prompt !== entry.prompt)].slice(0, 3));
    }

    save(
      recordLocalTopicPreviewCheck({
        progress,
        topicSlug: entry.topicSlug,
        prompt: entry.prompt,
        confident: correct,
      }),
    );

    setMessages((current) => ({
      ...current,
      [key]: {
        correct,
        stage: correct ? undefined : "recast",
        text: correct
          ? "Correct. This phrase has left Review."
          : `Correct answer: ${entry.answer ?? "the phrase on the topic page"}. Rule: ${entry.reason ?? "Use the reviewed form from the teaching step."}`,
      },
    }));
  }

  function revealPreviewReview(entry: { topicSlug: string; prompt: string; answer?: string; reason?: string }) {
    const key = `${entry.topicSlug}-${entry.prompt}`;
    setMessages((current) => ({
      ...current,
      [key]: {
        correct: false,
        stage: "self-report",
        text: `Correct answer: ${entry.answer ?? "Revisit the topic to see the phrase"}. Rule: ${entry.reason ?? "Use the form from the topic."} Showing the answer does not mark this item correct.`,
      },
    }));
  }

  return (
    <section className="card mt-7">
      <p className="eyebrow">Review on this device</p>
      <h2 className="mt-2 text-2xl font-black">
        {reviewCount ? `${reviewCount} item${reviewCount === 1 ? "" : "s"} ready to review` : "Nothing to review yet"}
      </h2>
      <p className="mt-3 text-ink/75">
        Review is based on mistakes made in this browser. {nextAction.reason}
      </p>

      {recentlyRepaired.length > 0 && (
        <div className="status-success mt-5" role="status">
          <p className="font-black">Completed in this review session.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {recentlyRepaired.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        </div>
      )}

      {progress.mistakePrompts.length > 0 ? (
        <section className="mt-5">
          <p className="eyebrow">Lesson weak points</p>
          <ul className="mt-3 space-y-3">
          {progress.mistakePrompts.map((prompt) => (
            <li key={prompt} className="rounded-2xl bg-cream p-4 font-bold">
              {prompt}
            </li>
          ))}
          </ul>
        </section>
      ) : null}

      {previewReviewChecks.length > 0 ? (
        <section className="mt-5">
          <p className="eyebrow">Preview phrases to revisit</p>
          <div className="mt-3 space-y-3">
            {previewReviewChecks.map((entry) => {
              const key = `${entry.topicSlug}-${entry.prompt}`;
              const message = messages[key];
              return (
              <article key={`${entry.topicSlug}-${entry.prompt}`} className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-black uppercase tracking-wide text-coral">{entry.topicSlug.replaceAll("-", " ")}</p>
                <h3 className="mt-2 font-black">{entry.prompt}</h3>
                <p className="mt-2 text-sm text-ink/70">
                  Type the phrase from memory. A correct answer removes it from Review.
                </p>

                {entry.acceptedAnswers.length === 0 && (
                  <p className="status-error mt-4">This review item is not available yet. Choose another activity.</p>
                )}

                {entry.acceptedAnswers.length > 0 && !message && (
                  <form className="mt-4 space-y-3" onSubmit={(event) => checkPreviewReview(event, entry)}>
                    <label className="block font-bold">
                      Your answer
                      <input
                        className="field"
                        value={answers[key] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        placeholder="Type the French phrase"
                        autoComplete="off"
                      />
                    </label>
                    <button className="button-primary" type="submit" disabled={!(answers[key] ?? "").trim()}>
                      Check answer
                    </button>
                  </form>
                )}

                {message && (
                  <div className={message.correct ? "status-success mt-4" : "status-error mt-4"} role="status">
                    <p>{message.text}</p>
                    {message.stage === "prompt" && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button className="button-primary" type="button" onClick={() => {
                          setAnswers((current) => ({ ...current, [key]: "" }));
                          setMessages((current) => { const next = { ...current }; delete next[key]; return next; });
                        }}>Try again</button>
                        <button className="button-secondary" type="button" onClick={() => revealPreviewReview(entry)}>Show me the answer</button>
                      </div>
                    )}
                    {(message.stage === "recast" || message.stage === "self-report") && (
                      <button className="button-primary mt-4" type="button" onClick={() => {
                        setAnswers((current) => ({ ...current, [key]: "" }));
                        setMessages((current) => { const next = { ...current }; delete next[key]; return next; });
                      }}>Continue review</button>
                    )}
                  </div>
                )}

                {entry.reason && (message?.stage === "recast" || message?.stage === "self-report") && (
                  <p className="mt-3 text-sm text-ink/70">{entry.reason}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link className="button-secondary" href={`/learn/${entry.topicSlug}`}>
                    Revisit topic
                  </Link>
                </div>
              </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {reviewCount === 0 && (
        <div className="mt-5 rounded-2xl bg-cream p-4 font-bold text-ink/70">
          Miss an answer in a lesson or mark a topic preview for review, and it will appear here for another try.
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="button-primary" href="/demo">
          Start review
        </Link>
        <ConfirmedLocalReset onReset={reset} />
      </div>
    </section>
  );
}
