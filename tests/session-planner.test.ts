import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import { buildSessionPlan } from "../lib/learning/session-planner";
import type { LearnerProfile, MistakePattern, ReviewItem } from "../lib/domain/types";

const profile: LearnerProfile = { userId: "learner", displayName: "Jamie", currentLevel: "A1", learningGoals: ["travel"], interests: ["music"], dailyMinutes: 8, preferredMode: "normal", country: "GB", birthDate: "2000-01-01", policyVersion: "v1", completedSessions: 0, currentStreak: 0 };
const dueReview: ReviewItem = { id: "review", userId: "learner", contentItemId: "rule-age-avoir-v1", activityId: "act-age-typing-v1", ruleId: "rule-age-avoir-v1", prompt: "Write your age", expectedAnswers: [{ value: "J'ai 20 ans" }], stage: 0, dueAt: "2026-06-19T00:00:00Z", successCount: 0, failureCount: 1, priority: 2 };

describe("Today session planning", () => {
  it("places due review first and includes output in a normal session", () => {
    const plan = buildSessionPlan({ profile, mission: INTRO_MISSION, dueReviews: [dueReview], mistakes: [], now: new Date("2026-06-20T12:00:00Z") });
    expect(plan.activities[0]?.kind).toBe("review");
    expect(plan.activities.some((entry) => ["typing", "fill_blank", "sentence_builder", "speak_repeat_placeholder"].includes(entry.activity.type))).toBe(true);
    expect(new Set(plan.activities.map((entry) => entry.activity.type))).toEqual(
      new Set([
        "multiple_choice",
        "fill_blank",
        "typing",
        "sentence_builder",
        "dictation_placeholder",
        "speak_repeat_placeholder",
      ]),
    );
  });
  it("creates a confidence-first comeback after three missed days", () => {
    const plan = buildSessionPlan({ profile: { ...profile, lastCompletedAt: "2026-06-16T12:00:00Z" }, mission: INTRO_MISSION, dueReviews: [], mistakes: [], now: new Date("2026-06-20T12:00:00Z") });
    expect(plan).toMatchObject({ mode: "comeback", estimatedMinutes: 4 });
    expect(plan.activities.length).toBeLessThanOrEqual(3);
  });

  it("moves the weakest evidenced skill to the front of mission work", () => {
    const stats = {
      totalAttempts: 6,
      skills: {
        recognition: { attempts: 3, correct: 3, accuracy: 1, averageLatencyMs: 1_000 },
        grammar: { attempts: 3, correct: 3, accuracy: 1, averageLatencyMs: 1_000 },
        writing: { attempts: 3, correct: 3, accuracy: 1, averageLatencyMs: 1_000 },
        listening: { attempts: 3, correct: 1, accuracy: 1 / 3, averageLatencyMs: 4_000 },
        speaking: { attempts: 0, correct: 0, accuracy: 0, averageLatencyMs: null },
      },
      weakestSkill: "listening" as const,
      slowRecallActivityIds: [],
      failedTypesByRule: {},
    };
    const plan = buildSessionPlan({ profile, mission: INTRO_MISSION, dueReviews: [], mistakes: [], stats, now: new Date("2026-06-20T12:00:00Z") });
    const firstMission = plan.activities.find((entry) => entry.kind === "mission");
    expect(firstMission?.activity.type).toBe("dictation_placeholder");
    expect(plan.weakFocus).toMatch(/listening/i);
  });

  it("switches repair to an unfailed activity format", () => {
    const mistake: MistakePattern = {
      id: "mistake", userId: "learner", ruleId: "rule-age-avoir-v1", mistakeType: "grammar",
      correctedAnswer: "J'ai 20 ans.", explanation: "French uses avoir for age.",
      repeatCount: 2, separateProductionSuccesses: 0, resolved: false, lastSeenAt: "2026-06-19T00:00:00Z",
    };
    const stats = {
      totalAttempts: 2,
      skills: {
        recognition: { attempts: 0, correct: 0, accuracy: 0, averageLatencyMs: null },
        grammar: { attempts: 0, correct: 0, accuracy: 0, averageLatencyMs: null },
        writing: { attempts: 2, correct: 0, accuracy: 0, averageLatencyMs: 3_000 },
        listening: { attempts: 0, correct: 0, accuracy: 0, averageLatencyMs: null },
        speaking: { attempts: 0, correct: 0, accuracy: 0, averageLatencyMs: null },
      },
      weakestSkill: undefined,
      slowRecallActivityIds: [],
      failedTypesByRule: { "rule-age-avoir-v1": ["typing"] },
    };
    const plan = buildSessionPlan({ profile, mission: INTRO_MISSION, dueReviews: [], mistakes: [mistake], stats, now: new Date("2026-06-20T12:00:00Z") });
    const repair = plan.activities.find((entry) => entry.kind === "repair");
    expect(repair).toBeDefined();
    expect(repair?.activity.grammarRuleIds).toContain("rule-age-avoir-v1");
    expect(repair?.activity.type).not.toBe("typing");
  });
});
