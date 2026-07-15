import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import { MockLearningRepository } from "../lib/data/mock-repository";
import { validateActivityAnswer } from "../lib/learning/answer-validation";
import { buildSessionPlan } from "../lib/learning/session-planner";
import { startSession } from "../lib/learning/service";

const successfulAnswers: Record<string, string> = {
  "act-name-meaning-v1": "a",
  "act-age-fill-v1": "ai",
  "act-age-typing-v1": "J'ai 20 ans.",
  "act-origin-builder-v1": "Je viens de Belfast",
  "act-dictation-v1": "Je m'appelle Jamie.",
  "act-speak-repeat-v1": "completed",
  "act-register-v1": "b",
};

describe("session resume", () => {
  it("resumes today's unfinished session instead of creating a duplicate", async () => {
    const { getLearningRepository } = await import("../lib/data");
    const repository = getLearningRepository();
    const userId = "resume-test-user";
    const profile = await repository.saveProfile({
      userId,
      displayName: "Resume learner",
      currentLevel: "A1",
      learningGoals: ["travel"],
      interests: [],
      dailyMinutes: 10,
      preferredMode: "normal",
      country: "GB",
      birthDate: "2000-01-01",
      policyVersion: "test",
      completedSessions: 0,
      currentStreak: 0,
    });
    const plan = buildSessionPlan({ profile, mission: INTRO_MISSION, dueReviews: [], mistakes: [] });

    const first = await startSession(userId, plan);
    const resumed = await startSession(userId, plan);
    expect(resumed.id).toBe(first.id);

    const otherMission = await startSession(userId, { ...plan, missionId: "different-mission" });
    expect(otherMission.id).not.toBe(first.id);
  });
});

describe("mock learner flow", () => {
  it("persists a known mistake, schedules review, and records completed progress", async () => {
    const repository = new MockLearningRepository();
    const userId = "flow-test-user";
    const profile = await repository.saveProfile({
      userId,
      displayName: "Flow learner",
      currentLevel: "A1",
      learningGoals: ["travel"],
      interests: [],
      dailyMinutes: 10,
      preferredMode: "normal",
      country: "GB",
      birthDate: "2000-01-01",
      policyVersion: "test",
      completedSessions: 0,
      currentStreak: 0,
    });
    const plan = buildSessionPlan({ profile, mission: INTRO_MISSION, dueReviews: [], mistakes: [] });
    const session = await repository.createSession(userId, plan);
    const ageActivity = INTRO_MISSION.activities.find((activity) => activity.id === "act-age-typing-v1")!;
    const wrongResult = validateActivityAnswer(ageActivity, "Je suis 20 ans");

    for (const entry of plan.activities) {
      const isKnownAgeMistake = entry.activity.id === ageActivity.id;
      const answer = isKnownAgeMistake ? "Je suis 20 ans" : successfulAnswers[entry.activity.id];
      const result = isKnownAgeMistake ? wrongResult : validateActivityAnswer(entry.activity, answer);
      expect(result.isCorrect).toBe(!isKnownAgeMistake);
      await repository.recordSubmission({
        userId,
        sessionId: session.id,
        activity: entry.activity,
        submittedAnswer: answer,
        latencyMs: isKnownAgeMistake ? 4_200 : 2_200,
        result,
      });
    }

    const initialReviews = await repository.getDueReviews(userId);
    expect(initialReviews).toHaveLength(1);
    expect(initialReviews[0]).toMatchObject({ contentItemId: "rule-age-avoir-v1", priority: 2, stage: 0 });
    const progress = await repository.getProgress(userId);
    const updatedProfile = await repository.getProfile(userId);
    expect(progress.sessionsCompleted).toBe(1);
    expect(progress.phrasesLearned).toBe(plan.activities.length - 1);
    expect(progress.reviewsDue).toBe(0);
    expect(progress.achievements.find((achievement) => achievement.id === "first-session")?.earned).toBe(true);
    expect(progress.nextAction.href).toBe("/today");
    expect(updatedProfile?.completedSessions).toBe(1);
  });
});
