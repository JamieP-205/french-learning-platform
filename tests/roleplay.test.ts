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
});
