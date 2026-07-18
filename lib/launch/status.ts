import { topicPreviews } from "@/lib/content/topic-previews";
import { isServerAccountSyncReady } from "@/lib/auth/readiness";

export { isAccountSyncReady } from "@/lib/auth/readiness";

export type LaunchStatus = {
  publicLearningReady: boolean;
  publicSignupEnabled: boolean;
  publicDemoAvailable: boolean;
  verifiedScoredTopics: { slug: string; title: string; level: string }[];
  reviewStageTopics: { slug: string; title: string; level: string }[];
  blockers: string[];
};

type LaunchEnvironment = Record<string, string | undefined>;

export function buildLaunchStatus(environment: LaunchEnvironment = process.env): LaunchStatus {
  const verifiedScoredTopics = topicPreviews
    .filter((topic) => topic.status === "ready")
    .map((topic) => ({ slug: topic.slug, title: topic.title, level: topic.level }));
  const reviewStageTopics = topicPreviews
    .filter((topic) => topic.status === "practice_preview")
    .map((topic) => ({ slug: topic.slug, title: topic.title, level: topic.level }));

  const publicSignupEnabled = isServerAccountSyncReady(environment);
  const blockers = reviewStageTopics.length > 0
    ? ["More topics are available as extra practice while their full lessons receive a final language review."]
    : [];

  if (!publicSignupEnabled) {
    blockers.push(
      "Accounts are temporarily unavailable while email confirmation is being tested.",
    );
  }

  return {
    publicLearningReady: verifiedScoredTopics.length > 0,
    publicSignupEnabled,
    publicDemoAvailable: verifiedScoredTopics.length > 0,
    verifiedScoredTopics,
    reviewStageTopics,
    blockers,
  };
}
