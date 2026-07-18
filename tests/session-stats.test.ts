import { describe, expect, it } from "vitest";
import type { ActivityAttempt } from "../lib/domain/types";
import { buildSessionStats } from "../lib/learning/session-stats";

function attempt(overrides: Partial<ActivityAttempt>): ActivityAttempt {
  return {
    id: "attempt",
    userId: "learner",
    sessionId: "session-a",
    activityId: "activity",
    submittedAnswer: "answer",
    latencyMs: 2_000,
    completed: true,
    correct: true,
    evidenceKind: "controlled",
    result: {
      isCorrect: true,
      isNearMiss: false,
      normalizedAnswer: "answer",
      feedback: "Correct",
      correctAnswer: "answer",
      ruleIds: [],
      shouldCreateReview: false,
    },
    createdAt: "2026-07-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("session stats", () => {
  it("reconstructs checked results for a resumed or completed session", () => {
    const stats = buildSessionStats([
      attempt({ id: "correct", latencyMs: 3_200 }),
      attempt({ id: "wrong", correct: false, result: { ...attempt({}).result, isCorrect: false }, latencyMs: 4_100 }),
      attempt({ id: "first-miss", completed: false, correct: false, latencyMs: 900 }),
      attempt({ id: "reveal", evidenceKind: "self-report", correct: false, latencyMs: 700 }),
      attempt({ id: "other-session", sessionId: "session-b", latencyMs: 500 }),
    ], "session-a");

    expect(stats).toEqual({ correct: 1, total: 3, fastestMs: 900 });
  });

  it("does not invent speed or accuracy evidence when nothing was checked", () => {
    expect(buildSessionStats([
      attempt({ evidenceKind: "self-report", correct: false }),
    ], "session-a")).toEqual({ correct: 0, total: 0 });
  });
});
