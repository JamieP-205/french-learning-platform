import { describe, expect, it } from "vitest";
import {
  initialLessonRemyState,
  reduceLessonRemy,
  shouldOfferHelp,
  type LessonRemyEvent,
} from "../lib/companion/lesson-remy-triggers";

const calm = { quiet: false, celebrationOpen: false };

function play(events: LessonRemyEvent[]) {
  return events.reduce(reduceLessonRemy, initialLessonRemyState);
}

describe("lesson Remy triggers", () => {
  it("stays silent while the learner is simply working", () => {
    expect(shouldOfferHelp(initialLessonRemyState, calm)).toBe(false);
  });

  it("offers after a scored miss, in the retry window", () => {
    expect(shouldOfferHelp(play(["scored-miss"]), calm)).toBe(true);
  });

  it("offers after a long visible idle", () => {
    expect(shouldOfferHelp(play(["idle"]), calm)).toBe(true);
  });

  it("respects Not now for the rest of the activity, even after more misses", () => {
    expect(shouldOfferHelp(play(["scored-miss", "not-now", "scored-miss"]), calm)).toBe(false);
  });

  it("resets when the learner moves to the next activity", () => {
    const state = play(["scored-miss", "not-now", "activity-advanced"]);
    expect(state).toEqual(initialLessonRemyState);
    expect(shouldOfferHelp(state, calm)).toBe(false);
  });

  it("never offers while quiet or during the celebration", () => {
    const struggling = play(["scored-miss", "idle"]);
    expect(shouldOfferHelp(struggling, { quiet: true, celebrationOpen: false })).toBe(false);
    expect(shouldOfferHelp(struggling, { quiet: false, celebrationOpen: true })).toBe(false);
  });
});
