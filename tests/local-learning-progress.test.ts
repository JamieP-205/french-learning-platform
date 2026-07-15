import { describe, expect, it, vi } from "vitest";
import {
  emptyLocalLearningProgress,
  localLearningAchievements,
  localDailyPlan,
  localLearningNextAction,
  localLearningPath,
  localLevelRoadmap,
  localLearnerPreferenceSummary,
  localSkillReadiness,
  localTopicPreviewSummary,
  recordLocalSkillAttempt,
  recordLocalTopicPreviewCheck,
  skillForLocalActivity,
  updateLocalLearnerPreferences,
  type LocalLearningProgress,
} from "../lib/local-learning/progress";

describe("public local learning progress", () => {
  it("starts with a clear no-account first action", () => {
    const nextAction = localLearningNextAction(emptyLocalLearningProgress);
    const path = localLearningPath(emptyLocalLearningProgress);

    expect(nextAction).toMatchObject({ label: "Start local session", tone: "start" });
    expect(path[0]).toMatchObject({ current: true, complete: false });
  });

  it("turns a missed answer into repair-first motivation and achievements", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));

    const progress: LocalLearningProgress = {
      ...emptyLocalLearningProgress,
      sessionsCompleted: 1,
      attemptsCount: 7,
      correctCount: 6,
      mistakePrompts: ["Write: I am 20 years old."],
      weakActivityIds: ["act-age-typing-v1"],
      lastCompletedAt: "2026-06-26T12:00:00.000Z",
    };

    const nextAction = localLearningNextAction(progress);
    const earnedAchievementIds = localLearningAchievements(progress)
      .filter((achievement) => achievement.earned)
      .map((achievement) => achievement.id);

    expect(nextAction).toMatchObject({ label: "Repair weak point", tone: "repair" });
    expect(earnedAchievementIds).toEqual(["first-session", "mistake-captured", "repair-loop", "steady-recall"]);

    vi.useRealTimers();
  });

  it("uses a gentle comeback action after several days away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));

    const progress: LocalLearningProgress = {
      ...emptyLocalLearningProgress,
      sessionsCompleted: 1,
      lastCompletedAt: "2026-06-20T12:00:00.000Z",
    };

    expect(localLearningNextAction(progress)).toMatchObject({ label: "Restart gently", tone: "comeback" });

    vi.useRealTimers();
  });

  it("tracks preview self-check confidence without turning it into scored content", () => {
    const needsReview = recordLocalTopicPreviewCheck({
      progress: emptyLocalLearningProgress,
      topicSlug: "cafe-food",
      prompt: "Safer café phrase for: I want a coffee.",
      confident: false,
      now: new Date("2026-06-28T08:00:00.000Z"),
    });

    expect(localTopicPreviewSummary(needsReview, "cafe-food")).toMatchObject({
      seenCount: 1,
      confidentCount: 0,
      needsReviewCount: 1,
    });
    expect(localLearningNextAction(needsReview)).toMatchObject({
      label: "Review preview phrase",
      href: "/learn/cafe-food",
    });

    const confident = recordLocalTopicPreviewCheck({
      progress: needsReview,
      topicSlug: "cafe-food",
      prompt: "Safer café phrase for: I want a coffee.",
      confident: true,
      now: new Date("2026-06-28T08:05:00.000Z"),
    });

    expect(localTopicPreviewSummary(confident, "cafe-food")).toMatchObject({
      seenCount: 1,
      confidentCount: 1,
      needsReviewCount: 0,
    });
  });

  it("stores local preferences and uses them in no-account recommendations", () => {
    const progress = updateLocalLearnerPreferences(
      emptyLocalLearningProgress,
      {
        displayName: "Sam",
        currentLevel: "B1",
        primaryGoal: "work",
        dailyMinutes: 12,
        sessionEnergy: "low",
      },
      new Date("2026-06-28T09:00:00.000Z"),
    );

    expect(localLearnerPreferenceSummary(progress)).toMatchObject({
      headline: "B1 · work · 12 min",
    });
    expect(localLearningNextAction(progress)).toMatchObject({
      title: "Calibrate your B1 French safely.",
    });
  });

  it("tracks skill evidence and level route without pretending all levels are fully built", () => {
    const grammarAttempt = recordLocalSkillAttempt({
      progress: emptyLocalLearningProgress,
      skill: "grammar",
      correct: false,
      now: new Date("2026-06-28T10:00:00.000Z"),
    });

    expect(localSkillReadiness(grammarAttempt).find((skill) => skill.key === "grammar")).toMatchObject({
      status: "repair",
      attempts: 1,
      needsReview: 1,
    });

    const b1Progress = updateLocalLearnerPreferences(grammarAttempt, { currentLevel: "B1" });
    expect(localLevelRoadmap(b1Progress).find((step) => step.level === "B1")).toMatchObject({
      status: "calibrate",
    });
  });

  it("maps local activities to skill areas", () => {
    expect(
      skillForLocalActivity({
        type: "sentence_builder",
        prompt: "Put the words in order.",
      }),
    ).toBe("sentence_building");
    expect(
      skillForLocalActivity({
        type: "multiple_choice",
        prompt: "Which version is more casual?",
      }),
    ).toBe("register");
  });

  it("builds a repair-first daily plan with a goal-based stretch", () => {
    const progress = updateLocalLearnerPreferences(
      {
        ...emptyLocalLearningProgress,
        weakActivityIds: ["act-age-typing-v1"],
        mistakePrompts: ["Write: I am 20 years old."],
      },
      {
        primaryGoal: "work",
        dailyMinutes: 12,
        sessionEnergy: "normal",
      },
    );

    const plan = localDailyPlan(progress);

    expect(plan[0]).toMatchObject({
      id: "repair-lesson",
      href: "/demo",
      label: "Start repair",
    });
    expect(plan[1]).toMatchObject({
      id: "goal-stretch",
      href: "/learn/work-basics",
      title: "Work basics",
    });
    expect(plan[2]).toMatchObject({
      id: "finish",
      href: "/progress",
    });
  });

  it("keeps low-energy daily plans short and confidence-first", () => {
    const progress = updateLocalLearnerPreferences(emptyLocalLearningProgress, {
      dailyMinutes: 20,
      sessionEnergy: "low",
      primaryGoal: "food",
    });
    const plan = localDailyPlan(progress);
    const totalMinutes = plan.reduce((total, step) => total + step.estimatedMinutes, 0);

    expect(totalMinutes).toBeLessThanOrEqual(5);
    expect(plan[1]).toMatchObject({ href: "/learn/cafe-food" });
    expect(plan[2].title).toMatch(/one clean win/i);
  });
});
