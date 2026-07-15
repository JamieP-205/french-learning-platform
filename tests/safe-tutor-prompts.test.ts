import { describe, expect, it } from "vitest";
import { safeTutorPrompts } from "../lib/content/safe-tutor-prompts";

describe("safe tutor prompts", () => {
  it("keeps public tutor help source-bound and practice-linked", () => {
    expect(safeTutorPrompts.length).toBeGreaterThanOrEqual(4);

    for (const prompt of safeTutorPrompts) {
      expect(prompt.question.length).toBeGreaterThan(10);
      expect(prompt.explanation.length).toBeGreaterThan(30);
      expect(prompt.example.length).toBeGreaterThan(3);
      expect(prompt.sourceLabel.length).toBeGreaterThan(3);
      expect(prompt.href).toMatch(/^\/(demo|learn)/);
    }
  });

  it("covers the public vertical-slice trouble spots", () => {
    const promptIds = safeTutorPrompts.map((prompt) => prompt.id);

    expect(promptIds).toContain("age-avoir");
    expect(promptIds).toContain("polite-cafe");
    expect(promptIds).toContain("repeat-please");
  });
});
