// What the course actually contains right now, derived from the content
// modules themselves so no page can drift from reality.

import { registerComparisons, roleplayScenarios } from "@/lib/content/roleplay";
import { SCORED_MISSIONS, getPublicScoredMissionSlugs } from "@/lib/content/scored-missions";

export function contentStatus() {
  const publicSlugs = new Set(getPublicScoredMissionSlugs());
  const published = SCORED_MISSIONS.filter((mission) => publicSlugs.has(mission.slug));
  const inReview = SCORED_MISSIONS.filter((mission) => !publicSlugs.has(mission.slug));

  return {
    publishedMissionCount: published.length,
    publishedMissionTitles: published.map((mission) => mission.title),
    inReviewMissionCount: inReview.length,
    inReviewMissionTitles: inReview.map((mission) => mission.title),
    roleplayScenarioCount: roleplayScenarios.length,
    registerComparisonCount: registerComparisons.length,
  };
}
