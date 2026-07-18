import type { ActivityDefinition, Mission } from "@/lib/domain/types";

export type PublicDemoMode = "full" | "short";

export const shortPublicDemoMinutes = 2;

const baseActivityIds = [
  "act-name-meaning-v1",
  "act-age-fill-v1",
  "act-age-typing-v1",
  "act-origin-builder-v1",
  "act-dictation-v1",
  "act-speak-repeat-v1",
  "act-register-v1",
];

export function buildPublicDemoActivities(
  mission: Mission,
  weakActivityIds: string[],
  mode: PublicDemoMode,
): ActivityDefinition[] {
  const activitiesById = new Map(mission.activities.map((activity) => [activity.id, activity]));
  const weakFirst = [...new Set(weakActivityIds.filter((id) => baseActivityIds.includes(id)))];
  const orderedIds = [...weakFirst, ...baseActivityIds.filter((id) => !weakFirst.includes(id))];
  const ordered = orderedIds
    .map((id) => activitiesById.get(id))
    .filter((activity): activity is ActivityDefinition => Boolean(activity));

  return mode === "short" ? ordered.slice(0, 2) : ordered;
}

export function publicDemoMinutes(mission: Mission, mode: PublicDemoMode) {
  return mode === "short" ? shortPublicDemoMinutes : mission.estimatedMinutes;
}
