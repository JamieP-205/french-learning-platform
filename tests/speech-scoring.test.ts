import { describe, expect, it } from "vitest";
import { scorePronunciation } from "../lib/speech/scoring";

describe("pronunciation scoring", () => {
  it("accepts a clean transcript including accent and apostrophe noise", () => {
    const feedback = scorePronunciation("je voudrais un cafe sil vous plait", [
      "Je voudrais un café, s'il vous plaît.",
    ]);
    expect(feedback.verdict).toBe("match");
    expect(feedback.score).toBe(1);
  });

  it("does not accept the right words in the wrong order", () => {
    const feedback = scorePronunciation("café un voudrais je", ["Je voudrais un café"]);

    expect(feedback.verdict).toBe("retry");
    expect(feedback.score).toBeLessThan(0.4);
  });

  it("marks partial phrases as close with the missing words listed", () => {
    const feedback = scorePronunciation("je voudrais café", ["Je voudrais un café, s'il vous plaît."]);
    expect(feedback.verdict).toBe("close");
    expect(feedback.missingWords).toContain("sil");
  });

  it("asks for a retry when little matches", () => {
    const feedback = scorePronunciation("bonjour", ["Je voudrais un café, s'il vous plaît."]);
    expect(feedback.verdict).toBe("retry");
  });

  it("scores against the best accepted alternative", () => {
    const feedback = scorePronunciation("je viens de belfast", [
      "Je suis de Belfast.",
      "Je viens de Belfast.",
    ]);
    expect(feedback.verdict).toBe("match");
  });
});
