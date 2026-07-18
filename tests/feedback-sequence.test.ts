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
  it("returns the original result when the same submission is retried", async () => {
    const repository = getLearningRepository();
    const userId = `idempotent-submission-${crypto.randomUUID()}`;
    const requestId = crypto.randomUUID();
    await repository.saveProfile(profile(userId));
    const session = await repository.createSession(userId, plan(userId, ["act-name-meaning-v1"]));
    const input = {
      requestId,
      userId,
      sessionId: session.id,
      activityId: "act-name-meaning-v1",
      submittedAnswer: "a",
      latencyMs: 1_000,
    };

    const first = await submitActivity(input);
    const retry = await submitActivity(input);

    expect(retry).toEqual(first);
    expect(await repository.getSessionAttempts(userId, session.id)).toHaveLength(1);
    expect(await repository.getProfile(userId)).toMatchObject({ completedSessions: 1 });
    await expect(submitActivity({ ...input, submittedAnswer: "b" })).rejects.toThrow(
      "This request ID was already used for another answer.",
    );
  });

  it("does not duplicate mistake state when a first-miss response is retried", async () => {
    const repository = getLearningRepository();
    const userId = `idempotent-miss-${crypto.randomUUID()}`;
    const requestId = crypto.randomUUID();
    await repository.saveProfile(profile(userId));
    const session = await repository.createSession(userId, plan(userId, ["act-age-typing-v1"]));
    const input = {
      requestId,
      userId,
      sessionId: session.id,
      activityId: "act-age-typing-v1",
      submittedAnswer: "Je suis 20 ans",
      latencyMs: 1_000,
    };

    const first = await submitActivity(input);
    const retry = await submitActivity(input);

    expect(retry).toEqual(first);
    expect(retry.attempt.result.correctAnswer).toBe("");
    expect(await repository.getSessionAttempts(userId, session.id)).toHaveLength(1);
    expect(await repository.getOpenMistakes(userId)).toEqual([
      expect.objectContaining({ repeatCount: 1 }),
    ]);
    expect(await repository.getDueReviews(userId)).toEqual([
      expect.objectContaining({ failureCount: 1, stage: 0 }),
    ]);
  });

  it("keeps miss one incomplete, captures it for review, and gives the recast only on miss two", async () => {
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
    });

    expect(first.attempt).toMatchObject({
      completed: false,
      correct: false,
      result: {
        correctAnswer: "",
        shouldCreateReview: true,
      },
    });
    expect(first.attempt.result.feedback).toMatch(/which form belongs with je/i);
    expect(first.session).toMatchObject({ currentIndex: 0 });
    expect(first.session?.completedAt).toBeFalsy();
    expect(await repository.getDueReviews(userId)).toHaveLength(1);
    expect(await repository.getOpenMistakes(userId)).toHaveLength(1);

    const second = await submitActivity({
      userId,
      sessionId: session.id,
      activityId: "act-age-typing-v1",
      submittedAnswer: "Je suis 20 ans",
      latencyMs: 1_000,
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
    expect(await repository.getProgress(userId)).toMatchObject({
      attemptsCount: 2,
      accuracyPercent: 0,
      mission: { completedSteps: 1 },
    });
    expect(await repository.getDueReviews(userId)).toHaveLength(1);
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

  it("awards completion from aggregate checked work regardless of which step reveals an answer", async () => {
    const repository = getLearningRepository();
    const activityIds = ["act-name-meaning-v1", "act-age-fill-v1", "act-age-typing-v1"];
    const correctAnswers: Record<string, string> = {
      "act-name-meaning-v1": "a",
      "act-age-fill-v1": "ai",
      "act-age-typing-v1": "J'ai 20 ans",
    };

    for (const revealIndex of [0, 2]) {
      const userId = `aggregate-credit-${revealIndex}-${crypto.randomUUID()}`;
      await repository.saveProfile(profile(userId));
      const session = await repository.createSession(userId, plan(userId, activityIds));

      for (const [index, activityId] of activityIds.entries()) {
        await submitActivity({
          userId,
          sessionId: session.id,
          activityId,
          submittedAnswer: index === revealIndex ? "" : correctAnswers[activityId],
          latencyMs: 1_000,
          ...(index === revealIndex ? { evidenceKind: "self-report" as const } : {}),
        });
      }

      expect(await repository.getProfile(userId)).toMatchObject({ completedSessions: 1 });
    }
  });

  it("does not award completion when fewer than sixty percent of activities are checked", async () => {
    const repository = getLearningRepository();
    const userId = `aggregate-no-credit-${crypto.randomUUID()}`;
    const activityIds = ["act-name-meaning-v1", "act-age-fill-v1", "act-age-typing-v1"];
    await repository.saveProfile(profile(userId));
    const session = await repository.createSession(userId, plan(userId, activityIds));

    for (const [index, activityId] of activityIds.entries()) {
      await submitActivity({
        userId,
        sessionId: session.id,
        activityId,
        submittedAnswer: index === 2 ? "J'ai 20 ans" : "",
        latencyMs: 1_000,
        ...(index < 2 ? { evidenceKind: "self-report" as const } : {}),
      });
    }

    expect(await repository.getProfile(userId)).toMatchObject({ completedSessions: 0 });
  });
});
