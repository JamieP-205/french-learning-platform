import { describe, expect, it } from "vitest";
import { earnedMilestoneIds, gardenMilestones, type GardenProgress } from "../lib/progress/milestones";

function progressWith(overrides: Partial<GardenProgress>): GardenProgress {
  return {
    sessionsCompleted: 0,
    currentStreak: 0,
    phrasesLearned: 0,
    mistakesFixed: 0,
    habit: { tone: "new" },
    ...overrides,
  };
}

describe("garden milestones", () => {
  it("keeps the nine pieces and their thresholds stable", () => {
    const everything = gardenMilestones(
      progressWith({ sessionsCompleted: 20, currentStreak: 7, phrasesLearned: 1, mistakesFixed: 1 }),
    );
    expect(everything.map((milestone) => [milestone.id, milestone.target])).toEqual([
      ["sprout", 1],
      ["flowers", 1],
      ["bench", 1],
      ["path", 3],
      ["sun", 3],
      ["cafe", 5],
      ["lanterns", 7],
      ["tree", 10],
      ["canopy", 20],
    ]);
    expect(everything.every((milestone) => milestone.earned)).toBe(true);
  });

  it("earns nothing for a brand-new learner and only session pieces for sessions", () => {
    expect(earnedMilestoneIds(progressWith({}))).toEqual([]);
    expect(earnedMilestoneIds(progressWith({ sessionsCompleted: 3 }))).toEqual(["sprout", "path"]);
  });

  it("keeps streak pieces separate from session pieces", () => {
    const ids = earnedMilestoneIds(progressWith({ currentStreak: 3 }));
    expect(ids).toEqual(["sun"]);
  });
});
