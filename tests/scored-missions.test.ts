import { describe, expect, it } from "vitest";
import { getMissionBySlug, getPublicScoredMissionSlugs, getScoredMissionSlugs } from "../lib/content/scored-missions";
import { validateActivityAnswer } from "../lib/learning/answer-validation";
import { buildSessionPlan } from "../lib/learning/session-planner";
import type { LearnerProfile } from "../lib/domain/types";

const profile: LearnerProfile = {
  userId: "test-user",
  displayName: "Jamie",
  currentLevel: "A1",
  learningGoals: ["travel"],
  interests: ["music"],
  dailyMinutes: 10,
  preferredMode: "normal",
  country: "GB",
  birthDate: "2000-01-01",
  policyVersion: "2026-06-v1",
  completedSessions: 0,
  currentStreak: 0,
};

describe("scored beginner missions", () => {
  it("keeps cafe and travel mission definitions behind the public review gate", () => {
    expect(getScoredMissionSlugs()).toContain("cafe-food");
    expect(getScoredMissionSlugs()).toContain("travel-basics");
    expect(getPublicScoredMissionSlugs()).toEqual(["introduce-yourself"]);

    for (const slug of ["cafe-food", "travel-basics"]) {
      const mission = getMissionBySlug(slug);
      expect(mission?.contentItems.every((item) =>
        item.verificationStatus === "needs_review" &&
        item.publicationStatus === "draft",
      )).toBe(true);
    }
  });

  it("gives cafe and travel mixed scored activities", () => {
    for (const slug of ["cafe-food", "travel-basics"]) {
      const mission = getMissionBySlug(slug);
      expect(mission).toBeTruthy();
      expect(mission?.activities.length).toBeGreaterThanOrEqual(7);

      const activityTypes = new Set(mission?.activities.map((activity) => activity.type));
      expect(activityTypes.has("multiple_choice")).toBe(true);
      expect(activityTypes.has("fill_blank")).toBe(true);
      expect(activityTypes.has("typing")).toBe(true);
      expect(activityTypes.has("sentence_builder")).toBe(true);
      expect(activityTypes.has("dictation")).toBe(true);
      expect(activityTypes.has("speak_repeat")).toBe(true);

      for (const activity of mission?.activities ?? []) {
        expect(activity.acceptedAnswers.length).toBeGreaterThan(0);
        expect(activity.contentItemIds.length).toBeGreaterThan(0);
        expect(activity.feedbackCorrect.length).toBeGreaterThan(5);
        expect(activity.feedbackIncorrect.length).toBeGreaterThan(5);
        if (activity.type === "fill_blank") {
          expect(activity.acceptedAnswers.map((answer) => answer.value))
            .not.toContain(activity.placeholder);
        }
      }
    }
  });

  it("validates cafe answers deterministically without AI", () => {
    const cafe = getMissionBySlug("cafe-food");
    const typeOrder = cafe?.activities.find((activity) => activity.id === "act-cafe-type-order-v1");
    const fillOrder = cafe?.activities.find((activity) => activity.id === "act-cafe-fill-order-v1");

    expect(typeOrder).toBeTruthy();
    expect(fillOrder).toBeTruthy();

    expect(validateActivityAnswer(typeOrder!, "Je voudrais un cafe s'il vous plait").isCorrect).toBe(true);
    expect(validateActivityAnswer(fillOrder!, "cafe").isCorrect).toBe(true);

    const blunt = validateActivityAnswer(typeOrder!, "Je veux un café");
    expect(blunt.isCorrect).toBe(false);
    expect(blunt.isNearMiss).toBe(true);
    expect(blunt.correctAnswer).toBe("Je voudrais un café, s'il vous plaît.");
  });

  it("validates travel answers deterministically without AI", () => {
    const travel = getMissionBySlug("travel-basics");
    const station = travel?.activities.find((activity) => activity.id === "act-travel-fill-gare-v1");
    const repeat = travel?.activities.find((activity) => activity.id === "act-travel-dictation-repeat-v1");

    expect(station).toBeTruthy();
    expect(repeat).toBeTruthy();

    expect(validateActivityAnswer(station!, "gare").isCorrect).toBe(true);
    expect(validateActivityAnswer(repeat!, "Pouvez vous repeter s'il vous plait").isCorrect).toBe(true);
  });

  it("builds mission-specific session plans", () => {
    const cafe = getMissionBySlug("cafe-food");
    const travel = getMissionBySlug("travel-basics");

    expect(cafe).toBeTruthy();
    expect(travel).toBeTruthy();

    const cafePlan = buildSessionPlan({ profile, mission: cafe!, dueReviews: [], mistakes: [] });
    const travelPlan = buildSessionPlan({ profile, mission: travel!, dueReviews: [], mistakes: [] });

    expect(cafePlan.missionId).toBe("mission-cafe-food-v1");
    expect(travelPlan.missionId).toBe("mission-travel-basics-v1");
    expect(cafePlan.activities.length).toBeGreaterThanOrEqual(5);
    expect(travelPlan.activities.length).toBeGreaterThanOrEqual(5);
  });
});
