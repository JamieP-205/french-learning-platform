import { describe, expect, it } from "vitest";
import { getLearningRepository } from "../lib/data";
import { INTRO_MISSION } from "../lib/content/seed";
import type { LearnerProfile, SessionPlanV1 } from "../lib/domain/types";
import { submitActivity } from "../lib/learning/service";

function profile(userId: string): LearnerProfile {
  return {
    userId,
    displayName: "Feedback learner",
    currentLevel: "A1",
    learningGoals: ["travel"],
    interests: [],
    dailyMinutes: 8,
    preferredMode: "normal",
    policyVersion: "test",
    completedSessions: 0,
    currentStreak: 0,
    streakFreezes: 0,
  };
}

function plan(userId: string, activityIds: string[]): SessionPlanV1 {
  return {
    id: `feedback-plan-${crypto.randomUUID()}`,
    userId,
    missionId: INTRO_MISSION.id,
    missionTitle: INTRO_MISSION.title,
    mode: "normal",
    estimatedMinutes: 1,
    weakFocus: "grammar",
    activities: activityIds.map((activityId) => ({
      activity: INTRO_MISSION.activities.find((candidate) => candidate.id === activityId)!,
      kind: "mission" as const,
      rationale: "Feedback sequencing regression test",
    })),
    completionReward: "Test complete",
  };
}

describe("authoritative feedback sequencing", () => {
  it("keeps miss one incomplete and gives the recast only on miss two, regardless of caller flags", async () => {
    const repository = getLearningRepository();
    const userId = `feedback-sequence-${crypto.randomUUID()}`;
    await repository.saveProfile(profile(userId));
    const session = await repository.createSession(userId, plan(userId, ["act-age-typing-v1"]));

    const first = await submitActivity({
      userId,
      sessionId: session.id,
      activityId: "act-age-typing-v1",
      submittedAnswer: "Je suis 20 ans",
      latencyMs: 1_000,
      completed: true,
    });

    expect(first.attempt).toMatchObject({
      completed: false,
      correct: false,
      result: {
        correctAnswer: "",
        shouldCreateReview: false,
      },
    });
    expect(first.attempt.result.feedback).toMatch(/which form belongs with je/i);
    expect(first.session).toMatchObject({ currentIndex: 0 });
    expect(first.session?.completedAt).toBeFalsy();
    expect(await repository.getDueReviews(userId)).toEqual([]);
    expect(await repository.getOpenMistakes(userId)).toEqual([]);

    const second = await submitActivity({
      userId,
      sessionId: session.id,
      activityId: "act-age-typing-v1",
      submittedAnswer: "Je suis 20 ans",
      latencyMs: 1_000,
      completed: false,
    });

    expect(second.attempt).toMatchObject({
      completed: true,
      correct: false,
      result: {
        correctAnswer: "J'ai 20 ans.",
        shouldCreateReview: true,
      },
    });
    expect(second.session?.completedAt).toBeTruthy();
  });

  it("does not award session or streak credit when a self-report completes a session after a correct answer", async () => {
    const repository = getLearningRepository();
    const userId = `feedback-escape-${crypto.randomUUID()}`;
    await repository.saveProfile(profile(userId));
    const session = await repository.createSession(
      userId,
      plan(userId, ["act-name-meaning-v1", "act-age-typing-v1"]),
    );

    await submitActivity({
      userId,
      sessionId: session.id,
      activityId: "act-name-meaning-v1",
      submittedAnswer: "a",
      latencyMs: 1_000,
    });
    const beforeEscape = await repository.getProgress(userId);

    const escaped = await submitActivity({
      userId,
      sessionId: session.id,
      activityId: "act-age-typing-v1",
      submittedAnswer: "",
      latencyMs: 1_000,
      evidenceKind: "self-report",
    });

    expect(escaped.attempt).toMatchObject({
      completed: true,
      correct: false,
      evidenceKind: "self-report",
      result: { isCorrect: false, shouldCreateReview: false },
    });
    expect(escaped.session?.completedAt).toBeTruthy();
    expect(await repository.getProgress(userId)).toMatchObject({
      attemptsCount: beforeEscape.attemptsCount,
      sessionsCompleted: beforeEscape.sessionsCompleted,
      currentStreak: beforeEscape.currentStreak,
      phrasesLearned: beforeEscape.phrasesLearned,
      reviewsDue: beforeEscape.reviewsDue,
    });
  });
});
