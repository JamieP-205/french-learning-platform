import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import {
  buildPublicDemoActivities,
  publicDemoMinutes,
  shortPublicDemoMinutes,
} from "../lib/local-learning/demo-plan";

describe("public demo plans", () => {
  it("keeps the standard lesson complete", () => {
    const activities = buildPublicDemoActivities(INTRO_MISSION, [], "full");

    expect(activities).toHaveLength(INTRO_MISSION.activities.length);
    expect(publicDemoMinutes(INTRO_MISSION, "full")).toBe(INTRO_MISSION.estimatedMinutes);
  });

  it("makes the short lesson a two-step subset and keeps repair first", () => {
    const activities = buildPublicDemoActivities(
      INTRO_MISSION,
      ["act-age-typing-v1"],
      "short",
    );

    expect(activities.map((activity) => activity.id)).toEqual([
      "act-age-typing-v1",
      "act-name-meaning-v1",
    ]);
    expect(publicDemoMinutes(INTRO_MISSION, "short")).toBe(shortPublicDemoMinutes);
  });

  it("repairs duplicated legacy weak-item data without duplicating lesson steps", () => {
    const activities = buildPublicDemoActivities(
      INTRO_MISSION,
      ["act-age-typing-v1", "act-age-typing-v1", "unknown-activity"],
      "full",
    );
    const activityIds = activities.map((activity) => activity.id);

    expect(activityIds[0]).toBe("act-age-typing-v1");
    expect(new Set(activityIds).size).toBe(activityIds.length);
    expect(activityIds).toHaveLength(INTRO_MISSION.activities.length);
  });
});
