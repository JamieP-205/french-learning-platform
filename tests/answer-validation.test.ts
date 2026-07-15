import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import { validateActivityAnswer } from "../lib/learning/answer-validation";
import type { ActivityDefinition } from "../lib/domain/types";

const activity = (id: string) => INTRO_MISSION.activities.find((item) => item.id === id)!;

describe("deterministic French answer validation", () => {
  it("identifies the configured avoir-for-age near miss", () => {
    const result = validateActivityAnswer(activity("act-age-typing-v1"), "Je suis 20 ans");
    expect(result).toMatchObject({ isCorrect: false, isNearMiss: true, mistakeType: "grammar", correctAnswer: "J'ai 20 ans.", ruleIds: ["rule-age-avoir-v1"] });
  });

  it("accepts a configured casual alternative only where the activity allows it", () => {
    const registerActivity = activity("act-register-v1");
    expect(validateActivityAnswer(registerActivity, "b").isCorrect).toBe(true);
    expect(validateActivityAnswer(registerActivity, "a").isCorrect).toBe(false);
  });

  it("allows the configured accent-tolerant answer but does not fuzzy-match spelling", () => {
    const thanks: ActivityDefinition = { ...activity("act-age-typing-v1"), id: "thanks", prompt: "Thank you very much", acceptedAnswers: [{ value: "Merci beaucoup", allowAccentless: true }], nearMisses: [{ value: "Merci bocoup", mistakeType: "spelling", ruleId: "spelling-beaucoup", explanation: "The standard spelling is beaucoup.", correctedAnswer: "Merci beaucoup." }] };
    expect(validateActivityAnswer(thanks, "Merci beaucoup").isCorrect).toBe(true);
    expect(validateActivityAnswer(thanks, "Merci bocoup")).toMatchObject({ isCorrect: false, isNearMiss: true, mistakeType: "spelling" });
  });

  it("checks sentence-builder order through the same accepted answer path", () => {
    expect(validateActivityAnswer(activity("act-origin-builder-v1"), "Je viens de Belfast").isCorrect).toBe(true);
    expect(validateActivityAnswer(activity("act-origin-builder-v1"), "Belfast viens de Je").isCorrect).toBe(false);
  });
});
