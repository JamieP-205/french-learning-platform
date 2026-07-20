import { describe, expect, it } from "vitest";
import { ENGLISH_RATE, FRENCH_RATE_NORMAL, FRENCH_RATE_SLOW } from "../lib/speech/speech-rates";

// These constants exist because learners found the French too fast. The
// assertions stop anyone quietly drifting them back toward native pace.
describe("speech rates", () => {
  it("keeps everyday French below native pace", () => {
    expect(FRENCH_RATE_NORMAL).toBeLessThan(1);
    expect(FRENCH_RATE_NORMAL).toBeGreaterThanOrEqual(0.75);
  });

  it("keeps the slow rate meaningfully slower but still intelligible", () => {
    expect(FRENCH_RATE_SLOW).toBeLessThan(FRENCH_RATE_NORMAL);
    expect(FRENCH_RATE_SLOW).toBeGreaterThanOrEqual(0.6);
  });

  it("keeps English prompts near natural pace", () => {
    expect(ENGLISH_RATE).toBeGreaterThanOrEqual(0.9);
    expect(ENGLISH_RATE).toBeLessThanOrEqual(1);
  });
});
