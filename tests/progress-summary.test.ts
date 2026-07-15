import { describe, expect, it } from "vitest";
import type { LearnerProfile, ReviewItem } from "../lib/domain/types";
import { buildProgressSnapshot } from "../lib/learning/progress-summary";

const profile: LearnerProfile = {
  userId: "progress-user",
  displayName: "Progress learner",
  currentLevel: "A1",
  learningGoals: ["travel"],
  interests: ["music"],
  dailyMinutes: 8,
  preferredMode: "normal",
  country: "GB",
  birthDate: "2000-01-01",
  policyVersion: "test",
  completedSessions: 1,
  currentStreak: 1,
  lastCompletedAt: "2026-06-25T08:00:00.000Z",
};

const dueReview: ReviewItem = {
  id: "review-1",
  userId: profile.userId,
  contentItemId: "rule-age-avoir-v1",
  activityId: "act-age-typing-v1",
  ruleId: "rule-age-avoir-v1",
  prompt: "Write: I am 20 years old.",
  expectedAnswers: [{ value: "J'ai 20 ans" }],
  stage: 0,
  dueAt: "2026-06-25T08:01:00.000Z",
  successCount: 0,
  failureCount: 1,
  priority: 2,
};

describe("progress summary", () => {
  it("turns learner evidence into achievements and a review-first next action", () => {
    const progress = buildProgressSnapshot({
      profile,
      attempts: [
        { activityId: "act-name-meaning-v1", isCorrect: true },
        { activityId: "act-age-typing-v1", isCorrect: false },
        { activityId: "act-origin-builder-v1", isCorrect: true },
      ],
      reviews: [dueReview],
      mistakes: [{ resolved: false }],
      missionTitle: "Introduce yourself and talk about your day",
      missionActivityCount: 7,
      now: new Date("2026-06-25T09:00:00.000Z"),
    });

    expect(progress.habit.tone).toBe("fresh");
    expect(progress.nextAction.href).toBe("/review");
    expect(progress.reviewsDue).toBe(1);
    expect(progress.mission.completionPercent).toBe(43);
    expect(progress.achievements.find((achievement) => achievement.id === "first-session")?.earned).toBe(true);
    expect(progress.achievements.find((achievement) => achievement.id === "mistake-captured")?.earned).toBe(true);
  });

  it("creates a confidence-first comeback pull after several days away", () => {
    const progress = buildProgressSnapshot({
      profile: { ...profile, lastCompletedAt: "2026-06-20T08:00:00.000Z" },
      attempts: [],
      reviews: [],
      mistakes: [],
      missionTitle: "Introduce yourself and talk about your day",
      missionActivityCount: 7,
      now: new Date("2026-06-25T09:00:00.000Z"),
    });

    expect(progress.habit.tone).toBe("comeback");
    expect(progress.nextAction).toMatchObject({ href: "/today", label: "Restart gently" });
  });
});
