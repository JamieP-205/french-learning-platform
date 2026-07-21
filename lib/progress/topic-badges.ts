// Topic badges earned by evidence, never by taps. A badge needs at least one
// correct, completed, productive attempt (typing, fill blank, sentence
// building, or dictation) in each of the topic's requirement groups.
// Recognition-only work and revealed answers never count, and the labels stay
// honest: practised, not mastered.

import { isPublicScoredMissionSlug } from "@/lib/content/scored-missions";
import type { AttemptEvidenceKind } from "@/lib/domain/types";

export type TopicBadge = {
  id: string;
  topicSlug: string;
  title: string;
  detail: string;
  earned: boolean;
};

export type BadgeAttemptSignal = {
  activityId: string;
  isCorrect: boolean;
  evidenceKind?: AttemptEvidenceKind;
  completed?: boolean;
  productive?: boolean;
};

type BadgeSpec = {
  id: string;
  topicSlug: string;
  title: string;
  detail: string;
  requirementGroups: string[][];
};

// Each inner array is one requirement: any listed activity satisfies it.
// Only the codebase's productive types (typing, fill blank, sentence
// building) appear here; dictation is controlled transcription and stays out,
// matching the wider evidence model.
const BADGE_SPECS: BadgeSpec[] = [
  {
    id: "badge-introduce-yourself",
    topicSlug: "introduce-yourself",
    title: "Practised: introducing yourself",
    detail: "Produced your age and where you are from, from memory.",
    requirementGroups: [
      ["act-age-fill-v1", "act-age-typing-v1"],
      ["act-origin-builder-v1"],
    ],
  },
  {
    id: "badge-cafe-food",
    topicSlug: "cafe-food",
    title: "Practised: ordering at a cafe",
    detail: "Produced a polite order and a menu choice, from memory.",
    requirementGroups: [
      ["act-cafe-fill-order-v1", "act-cafe-type-order-v1"],
      ["act-cafe-sentence-builder-v1"],
    ],
  },
  {
    id: "badge-travel-basics",
    topicSlug: "travel-basics",
    title: "Practised: basic travel questions",
    detail: "Produced the station question, a ticket request, and the time question, from memory.",
    requirementGroups: [
      ["act-travel-fill-gare-v1", "act-travel-fill-lost-v1"],
      ["act-travel-type-ticket-v1"],
      ["act-travel-sentence-builder-time-v1"],
    ],
  },
];

function qualifies(signal: BadgeAttemptSignal): boolean {
  return (
    signal.isCorrect &&
    signal.completed !== false &&
    signal.evidenceKind !== "self-report" &&
    signal.productive !== false
  );
}

export function computeTopicBadges(signals: BadgeAttemptSignal[]): TopicBadge[] {
  const qualifyingActivityIds = new Set(signals.filter(qualifies).map((signal) => signal.activityId));
  return BADGE_SPECS
    // Draft missions keep their badges out of sight until publication.
    .filter((spec) => isPublicScoredMissionSlug(spec.topicSlug))
    .map((spec) => ({
      id: spec.id,
      topicSlug: spec.topicSlug,
      title: spec.title,
      detail: spec.detail,
      earned: spec.requirementGroups.every((group) =>
        group.some((activityId) => qualifyingActivityIds.has(activityId)),
      ),
    }));
}
