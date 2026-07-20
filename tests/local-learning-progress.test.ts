import { describe, expect, it, vi } from "vitest";
import {
  emptyLocalLearningProgress,
  localLearningAchievements,
  localDailyPlan,
  localLearningDaysSince,
  localLearningNextAction,
  localLearningPath,
  localLearningStreak,
  localLevelRoadmap,
  localLearnerPreferenceSummary,
  localSkillReadiness,
  localTopicPreviewSummary,
  recordLocalSkillAttempt,
  recordLocalActiveDate,
  recordLocalTopicPreviewCheck,
  skillForLocalActivity,
  updateLocalLearnerPreferences,
  type LocalLearningProgress,
} from "../lib/local-learning/progress";

describe("public local learning progress", () => {
  it("counts consecutive local practice days without requiring activity today", () => {
    const progress = {
      ...emptyLocalLearningProgress,
      activeDates: ["2026-07-18", "2026-07-17", "2026-07-16"],
    };

    expect(
      localLearningStreak(
        progress,
        new Date("2026-07-19T12:00:00.000Z"),
        "UTC",
      ),
    ).toBe(3);
  });

  it("starts with a clear no-account first action", () => {
    const nextAction = localLearningNextAction(emptyLocalLearningProgress);
    const path = localLearningPath(emptyLocalLearningProgress);

    expect(nextAction).toMatchObject({ label: "Start lesson", tone: "start" });
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

    expect(nextAction).toMatchObject({ label: "Review weak point", tone: "repair" });
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

  it("uses the browser's calendar day for local-only progress", () => {
    const beforeMidnightUtc = "2026-07-18T23:30:00.000Z";
    const afterMidnightUtc = new Date("2026-07-19T00:30:00.000Z");

    expect(localLearningDaysSince(beforeMidnightUtc, afterMidnightUtc, "Europe/London")).toBe(0);
    expect(localLearningDaysSince(beforeMidnightUtc, afterMidnightUtc, "UTC")).toBe(1);
    expect(
      recordLocalActiveDate(emptyLocalLearningProgress, new Date(beforeMidnightUtc), "Europe/London")
        .activeDates[0],
    ).toBe("2026-07-19");
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
      title: "Use the A1 introduction as a foundation check.",
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
      description: expect.stringMatching(/available A1 check cannot confirm this level/i),
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
      label: "Start review",
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
    expect(plan[0]).toMatchObject({ href: "/demo?mode=short", estimatedMinutes: 2 });
    expect(plan[1]).toMatchObject({ href: "/learn/cafe-food" });
    expect(plan[2].title).toMatch(/one clear win/i);
  });

  it("keeps a repaired weak point in the learner's achievement history", () => {
    const repaired: LocalLearningProgress = {
      ...emptyLocalLearningProgress,
      sessionsCompleted: 2,
      mistakesCaptured: 1,
      repairsCompleted: 1,
    };
    const earned = localLearningAchievements(repaired)
      .filter((achievement) => achievement.earned)
      .map((achievement) => achievement.id);

    expect(earned).toContain("mistake-captured");
    expect(earned).toContain("repair-loop");
    expect(localLearningPath(repaired).find((step) => step.id === "repair")).toMatchObject({ complete: true });
  });

  it("does not pad a two-minute local plan with actions that cannot fit", () => {
    const progress = updateLocalLearnerPreferences(emptyLocalLearningProgress, {
      dailyMinutes: 2,
      sessionEnergy: "normal",
    });

    const plan = localDailyPlan(progress);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      href: "/demo?mode=short",
      estimatedMinutes: 2,
      description: expect.stringMatching(/phrase meaning and a basic sentence pattern/i),
    });
    expect(localLearningNextAction(progress).href).toBe("/demo?mode=short");
  });
});
