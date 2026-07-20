import { describe, expect, it } from "vitest";
import { roleplayScenarios } from "../lib/content/roleplay";
import { evaluateRoleplayChoice, roleplayVerdict } from "../lib/learning/roleplay";

describe("deterministic roleplay", () => {
  it("scores explicit register choices without free-form generation", () => {
    const scenario = roleplayScenarios.find((item) => item.id === "cafe-counter")!;
    const strong = evaluateRoleplayChoice(scenario, 0, "voudrais");
    const repair = evaluateRoleplayChoice(scenario, 0, "veux");

    expect(strong).toMatchObject({ score: 2, nextTurnIndex: 1, complete: false });
    expect(strong.choice.feedback).toContain("Polite");
    expect(repair).toMatchObject({ score: 0 });
    expect(repair.choice.feedback).toContain("too direct");
  });

  it("summarises a completed scenario from the deterministic score", () => {
    expect(roleplayVerdict(6, 6)).toBe("Ready for the real exchange.");
    expect(roleplayVerdict(4, 6)).toBe("Safe enough, with one phrase to polish.");
    expect(roleplayVerdict(1, 6)).toBe("Good practice target. Repeat the safer chunks before trying this live.");
  });

  it("keeps every scenario well-formed: unique ids, and each turn teaches a contrast", () => {
    const scenarioIds = roleplayScenarios.map((scenario) => scenario.id);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
    expect(scenarioIds).toEqual(
      expect.arrayContaining(["cafe-counter", "station-help", "bakery-counter", "meeting-colleague"]),
    );

    for (const scenario of roleplayScenarios) {
      expect(scenario.turns.length).toBeGreaterThanOrEqual(2);
      for (const turn of scenario.turns) {
        const choiceIds = turn.choices.map((choice) => choice.id);
        expect(new Set(choiceIds).size).toBe(choiceIds.length);
        expect(turn.choices.some((choice) => choice.outcome === "strong")).toBe(true);
        expect(turn.choices.some((choice) => choice.outcome === "repair")).toBe(true);
        for (const choice of turn.choices) {
          expect(choice.feedback.length).toBeGreaterThan(10);
        }
      }
    }
  });
});
