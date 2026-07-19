import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import type { ReviewItem, SessionPlanV1, SessionRecord } from "../lib/domain/types";
import {
  presentActivityForLearner,
  presentReviewForLearner,
  presentSessionForLearner,
  presentSessionPlanForLearner,
} from "../lib/learning/presentation";

function plan(): SessionPlanV1 {
  return {
    id: "plan-presentation",
    userId: "learner-presentation",
    missionId: INTRO_MISSION.id,
    missionTitle: INTRO_MISSION.title,
    mode: "normal",
    estimatedMinutes: 10,
    weakFocus: "A balanced start.",
    activities: INTRO_MISSION.activities.map((activity) => ({
      activity,
      kind: "mission" as const,
      rationale: "Build the foundation.",
    })),
    completionReward: "Session complete.",
  };
}

describe("learner-facing learning responses", () => {
  it("omits deterministic answer and correction fields from every session activity", () => {
    const storedPlan = plan();
    const presented = presentSessionPlanForLearner(storedPlan);

    for (const entry of presented.activities) {
      expect(entry.activity).not.toHaveProperty("acceptedAnswers");
      expect(entry.activity).not.toHaveProperty("nearMisses");
      expect(entry.activity).not.toHaveProperty("feedbackCorrect");
      expect(entry.activity).not.toHaveProperty("feedbackIncorrect");
    }

    expect(storedPlan.activities[0]?.activity.acceptedAnswers.length).toBeGreaterThan(0);
  });

  it("applies the same redaction to resumable session records", () => {
    const stored: SessionRecord = {
      id: "session-presentation",
      userId: "learner-presentation",
      plan: plan(),
      startedAt: "2026-07-18T10:00:00.000Z",
      currentIndex: 0,
    };

    const presented = presentSessionForLearner(stored);

    expect(
      presented.plan.activities.every(
        (entry) => !Object.hasOwn(entry.activity, "acceptedAnswers"),
      ),
    ).toBe(true);
    expect(stored.plan.activities.some((entry) => entry.activity.acceptedAnswers.length > 0)).toBe(true);
  });

  it("keeps written targets out of scored browser DTOs and sends dictation audio instead", () => {
    const dictation = INTRO_MISSION.activities.find((activity) => activity.type === "dictation");
    const typing = INTRO_MISSION.activities.find((activity) => activity.type === "typing");

    expect(dictation?.type).toBe("dictation");
    expect(typing?.type).toBe("typing");
    if (!dictation || dictation.type !== "dictation" || !typing || typing.type !== "typing") {
      throw new Error("Expected seed dictation and typing activities.");
    }

    const presentedDictation = presentActivityForLearner(dictation);
    const presentedTyping = presentActivityForLearner(typing);

    expect(presentedDictation.type).toBe("dictation");
    expect(presentedDictation).not.toHaveProperty("targetText");
    expect(presentedDictation).toMatchObject({
      audioSource: "/api/learning-audio/act-dictation-v1",
    });
    expect(
      presentedDictation.type === "dictation" ? presentedDictation.audioSource : "",
    ).not.toMatch(/appelle|jamie/i);
    expect(presentedTyping).not.toHaveProperty("targetText");
    expect(JSON.stringify([presentedDictation, presentedTyping])).not.toContain(
      dictation.targetText,
    );
  });

  it("preserves the visible target and bundled audio for speak-and-repeat", () => {
    const speaking = INTRO_MISSION.activities.find(
      (activity) => activity.type === "speak_repeat",
    );
    expect(speaking?.type).toBe("speak_repeat");
    if (!speaking || speaking.type !== "speak_repeat" || !speaking.targetText) {
      throw new Error("Expected a seed speak-and-repeat activity.");
    }

    expect(presentActivityForLearner(speaking)).toMatchObject({
      type: "speak_repeat",
      targetText: speaking.targetText,
      audioSource: "/api/learning-audio/act-speak-repeat-v1",
    });
  });

  it("keeps legacy stored sessions usable when prompt language metadata is absent", () => {
    const activity = INTRO_MISSION.activities[0];
    const legacyActivity = { ...activity } as Partial<typeof activity>;
    delete legacyActivity.promptFrenchSegments;

    expect(
      presentActivityForLearner(
        legacyActivity as typeof activity,
      ).promptFrenchSegments,
    ).toEqual([]);
  });

  it("fails closed when a dictation has no bundled audio", () => {
    const dictation = INTRO_MISSION.activities.find((activity) => activity.type === "dictation");
    expect(dictation?.type).toBe("dictation");
    if (!dictation || dictation.type !== "dictation") {
      throw new Error("Expected a seed dictation activity.");
    }

    expect(() =>
      presentActivityForLearner({
        ...dictation,
        id: "dictation-without-audio",
        targetText: "Une phrase sans fichier audio.",
      }),
    ).toThrow("has no bundled audio");
  });

  it("returns only the review fields needed by the due-review page", () => {
    const review: ReviewItem = {
      id: "review-presentation",
      userId: "learner-presentation",
      contentItemId: "content-presentation",
      activityId: "activity-presentation",
      prompt: "Write the phrase.",
      expectedAnswers: [{ value: "Answer that must stay server-side" }],
      stage: 0,
      dueAt: "2026-07-18T10:00:00.000Z",
      successCount: 0,
      failureCount: 1,
      priority: 2,
    };

    expect(presentReviewForLearner(review)).toEqual({
      id: review.id,
      prompt: review.prompt,
      dueAt: review.dueAt,
      failureCount: review.failureCount,
    });
  });
});
