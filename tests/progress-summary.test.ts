import { describe, expect, it } from "vitest";
import type { LearnerProfile, ReviewItem } from "../lib/domain/types";
import { INTRO_MISSION } from "../lib/content/seed";
import { buildProgressSnapshot } from "../lib/learning/progress-summary";
import { inferEvidenceKind } from "../lib/learning/response-transition";

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

function attempt(activityId: string, isCorrect: boolean) {
  const activity = INTRO_MISSION.activities.find((candidate) => candidate.id === activityId)!;
  return {
    activityId,
    isCorrect,
    activity,
    evidenceKind: inferEvidenceKind(activity.type),
  };
}

describe("progress summary", () => {
  it("turns learner evidence into achievements and a review-first next action", () => {
    const progress = buildProgressSnapshot({
      profile,
      attempts: [
        attempt("act-name-meaning-v1", true),
        attempt("act-age-typing-v1", false),
        attempt("act-origin-builder-v1", true),
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
    expect(progress.phrasesLearned).toBe(1);
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
    expect(progress.skills.filter((skill) => skill.label !== "Speaking").every((skill) => skill.score === 0)).toBe(true);
    expect(progress.skills.find((skill) => skill.label === "Speaking")).toMatchObject({
      score: null,
      practiceAttempts: 0,
      measuredAttempts: 0,
    });
  });

  it("uses the learner's local date for today's habit state", () => {
    const progress = buildProgressSnapshot({
      profile: {
        ...profile,
        timeZone: "Europe/London",
        lastCompletedAt: "2026-07-18T23:30:00.000Z",
      },
      attempts: [],
      reviews: [],
      mistakes: [],
      missionTitle: INTRO_MISSION.title,
      missionActivityCount: INTRO_MISSION.activities.length,
      now: new Date("2026-07-19T00:30:00.000Z"),
    });

    expect(progress.habit).toMatchObject({ tone: "fresh", daysSinceLastSession: 0 });
  });

  it("deduplicates productive recall by canonical content item", () => {
    const progress = buildProgressSnapshot({
      profile,
      attempts: [
        attempt("act-age-fill-v1", true),
        attempt("act-age-typing-v1", true),
        attempt("act-name-meaning-v1", true),
      ],
      reviews: [],
      mistakes: [],
      missionTitle: INTRO_MISSION.title,
      missionActivityCount: INTRO_MISSION.activities.length,
    });

    expect(progress.phrasesLearned).toBe(1);
    expect(progress.skills.find((skill) => skill.label === "Writing")?.score).toBeGreaterThan(0);
    expect(progress.skills.find((skill) => skill.label === "Listening")?.score).toBe(0);
  });

  it("folds database-grouped signal counts without expanding lifetime attempts", () => {
    const speaking = attempt("act-speak-repeat-v1", false);
    const progress = buildProgressSnapshot({
      profile,
      attempts: [
        { ...attempt("act-age-typing-v1", true), count: 7 },
        { ...attempt("act-age-typing-v1", false), count: 3 },
        { ...speaking, evidenceKind: "self-report", count: 5 },
      ],
      reviews: [],
      mistakes: [{ resolved: true, count: 4 }],
      missionTitle: INTRO_MISSION.title,
      missionActivityCount: INTRO_MISSION.activities.length,
    });

    expect(progress.attemptsCount).toBe(10);
    expect(progress.accuracyPercent).toBe(70);
    expect(progress.mistakesFixed).toBe(4);
    expect(progress.skills.find((skill) => skill.label === "Writing")).toMatchObject({
      practiceAttempts: 10,
      measuredAttempts: 10,
    });
    expect(progress.skills.find((skill) => skill.label === "Speaking")).toMatchObject({
      practiceAttempts: 5,
      measuredAttempts: 0,
    });
  });

  it("uses saved goals and relevant interests for honest topic recommendations", () => {
    const progress = buildProgressSnapshot({
      profile: {
        ...profile,
        learningGoals: ["work"],
        interests: ["food", "music"],
      },
      attempts: [],
      reviews: [],
      mistakes: [],
      missionTitle: INTRO_MISSION.title,
      missionActivityCount: INTRO_MISSION.activities.length,
    });

    expect(progress.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "goal-work", href: "/learn/work-basics" }),
        expect.objectContaining({ id: "interest-food", href: "/learn/cafe-food" }),
      ]),
    );
  });
});
