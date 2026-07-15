import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import { buildLearnerStats } from "../lib/learning/learner-model";
import type { ActivityAttempt } from "../lib/domain/types";

const activityById = new Map(INTRO_MISSION.activities.map((activity) => [activity.id, activity]));

function attempt(activityId: string, isCorrect: boolean, latencyMs = 2_000, ruleIds: string[] = []): ActivityAttempt {
  return {
    id: `attempt-${Math.random().toString(16).slice(2)}`,
    userId: "learner",
    sessionId: "session",
    activityId,
    submittedAnswer: "answer",
    latencyMs,
    result: {
      isCorrect,
      isNearMiss: false,
      normalizedAnswer: "answer",
      feedback: "",
      correctAnswer: "",
      ruleIds,
      shouldCreateReview: !isCorrect,
    },
    createdAt: new Date().toISOString(),
  };
}

describe("learner model", () => {
  it("identifies the weakest evidenced skill without reacting to single misses", () => {
    const stats = buildLearnerStats(
      [
        attempt("act-dictation-v1", false),
        attempt("act-dictation-v1", false),
        attempt("act-dictation-v1", true),
        attempt("act-age-typing-v1", true),
        attempt("act-age-typing-v1", true),
        attempt("act-age-typing-v1", true),
        attempt("act-name-meaning-v1", false),
      ],
      activityById,
    );
    expect(stats.weakestSkill).toBe("listening");
    expect(stats.skills.listening.accuracy).toBeCloseTo(1 / 3);
    expect(stats.skills.writing.accuracy).toBe(1);
  });

  it("keeps slow-but-correct recall visible as fragile", () => {
    const stats = buildLearnerStats([attempt("act-age-typing-v1", true, 9_500)], activityById);
    expect(stats.slowRecallActivityIds).toContain("act-age-typing-v1");
  });

  it("records which activity formats already failed per rule", () => {
    const stats = buildLearnerStats(
      [attempt("act-age-typing-v1", false, 2_000, ["rule-age-avoir-v1"])],
      activityById,
    );
    expect(stats.failedTypesByRule["rule-age-avoir-v1"]).toEqual(["typing"]);
  });
});
