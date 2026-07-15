import { describe, expect, it } from "vitest";
import { INTRO_MISSION } from "../lib/content/seed";
import { activityTypes } from "../lib/domain/types";

describe("published starter content contract", () => {
  it("keeps every published activity source-linked and deterministically answerable", () => {
    const sourceIds = new Set(INTRO_MISSION.sources.map((source) => source.id));
    const contentById = new Map(INTRO_MISSION.contentItems.map((item) => [item.id, item]));

    for (const contentItem of INTRO_MISSION.contentItems) {
      expect(contentItem.verificationStatus).toBe("source_validated");
      expect(contentItem.publicationStatus).toBe("published");
      expect(contentItem.sourceIds.length).toBeGreaterThan(0);
      expect(contentItem.sourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
    }

    for (const activity of INTRO_MISSION.activities) {
      expect(activity.acceptedAnswers.length).toBeGreaterThan(0);
      expect(activity.contentItemIds.length).toBeGreaterThan(0);
      expect(activity.contentItemIds.every((contentId) => contentById.has(contentId))).toBe(true);
    }
  });

  it("delivers every approved MVP activity modality in the normal mission", () => {
    expect(new Set(INTRO_MISSION.activities.map((activity) => activity.type))).toEqual(new Set(activityTypes));
  });
});
