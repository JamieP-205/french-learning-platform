import { describe, expect, it } from "vitest";
import { getLearningRepository } from "../lib/data";
import { INTRO_MISSION } from "../lib/content/seed";
import type { LearnerProfile, SessionPlanV1 } from "../lib/domain/types";
import { submitActivity } from "../lib/learning/service";

describe("speech self-report evidence", () => {
  it.each([
    { label: "an explicit self-report", reportedCorrect: true, evidenceKind: "self-report" },
    { label: "a failed recognition result", reportedCorrect: false, evidenceKind: "controlled" },
  ] as const)("records $label without correctness, review, mastery progress, or streak credit", async ({
    reportedCorrect,
    evidenceKind,
  }) => {
    const repository = getLearningRepository();
    const userId = `speech-self-report-${crypto.randomUUID()}`;
    const profile: LearnerProfile = {
      userId,
      displayName: "Speech learner",
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
    await repository.saveProfile(profile);
    const activity = INTRO_MISSION.activities.find((candidate) => candidate.id === "act-speak-repeat-v1")!;
    const plan: SessionPlanV1 = {
      id: `speech-plan-${crypto.randomUUID()}`,
      userId,
      missionId: INTRO_MISSION.id,
      missionTitle: INTRO_MISSION.title,
      mode: "normal",
      estimatedMinutes: 1,
      weakFocus: "speaking",
      activities: [{ activity, kind: "mission", rationale: "Speech self-check test" }],
      completionReward: "Test complete",
    };
    const session = await repository.createSession(userId, plan);

    const outcome = await submitActivity({
      userId,
      sessionId: session.id,
      activityId: activity.id,
      submittedAnswer: "completed",
      latencyMs: 1_000,
      completed: true,
      correct: reportedCorrect,
      evidenceKind,
    });

    expect(outcome.attempt).toMatchObject({
      completed: true,
      correct: false,
      evidenceKind: "self-report",
      result: { isCorrect: false, shouldCreateReview: false },
    });
    expect(outcome.session?.completedAt).toBeTruthy();
    expect(await repository.getOpenMistakes(userId)).toEqual([]);
    expect(await repository.getDueReviews(userId)).toEqual([]);
    expect(await repository.getProfile(userId)).toMatchObject({ completedSessions: 0, currentStreak: 0 });
    expect(await repository.getProgress(userId)).toMatchObject({
      sessionsCompleted: 0,
      attemptsCount: 0,
      phrasesLearned: 0,
    });
  });
});
