import type {
  ActivityDefinition,
  LearnerActivityBase,
  LearnerActivityDefinition,
  ReviewItem,
  LearnerSessionPlanV1,
  LearnerSessionRecord,
  SessionPlanV1,
  SessionRecord,
} from "@/lib/domain/types";
import { audioSourceForFrench } from "@/lib/content/french-audio";

/**
 * Session plans are persisted with their deterministic answer keys so the
 * server can validate attempts. Browser responses are rebuilt from an explicit
 * allowlist so answer keys and correction content cannot cross the API boundary.
 */
function presentBaseActivity(activity: ActivityDefinition): LearnerActivityBase {
  return {
    id: activity.id,
    prompt: activity.prompt,
    promptFrenchSegments: [...activity.promptFrenchSegments],
    helperText: activity.helperText,
    contentItemIds: [...activity.contentItemIds],
    grammarRuleIds: [...activity.grammarRuleIds],
    estimatedSeconds: activity.estimatedSeconds,
  };
}

function learnerAudioSource(activityId: string) {
  return `/api/learning-audio/${encodeURIComponent(activityId)}`;
}

export function presentActivityForLearner(
  activity: ActivityDefinition,
): LearnerActivityDefinition {
  const base = presentBaseActivity(activity);

  switch (activity.type) {
    case "multiple_choice":
      return {
        ...base,
        type: activity.type,
        choices: activity.choices.map((choice) => ({ ...choice })),
      };
    case "sentence_builder":
      return {
        ...base,
        type: activity.type,
        tokens: [...activity.tokens],
      };
    case "fill_blank":
    case "typing":
      return {
        ...base,
        type: activity.type,
        placeholder: activity.placeholder,
      };
    case "dictation": {
      if (!activity.targetText) {
        throw new Error(`Dictation activity ${activity.id} is missing its audio target.`);
      }
      const audioSource = audioSourceForFrench(activity.targetText);
      if (!audioSource) {
        throw new Error(`Dictation activity ${activity.id} has no bundled audio.`);
      }
      return {
        ...base,
        type: activity.type,
        placeholder: activity.placeholder,
        audioSource: learnerAudioSource(activity.id),
      };
    }
    case "speak_repeat": {
      const targetText = activity.targetText ?? activity.prompt;
      const hasBundledAudio = Boolean(audioSourceForFrench(targetText));
      return {
        ...base,
        type: activity.type,
        placeholder: activity.placeholder,
        targetText,
        audioSource: hasBundledAudio ? learnerAudioSource(activity.id) : undefined,
      };
    }
  }
}

export function presentSessionPlanForLearner(plan: SessionPlanV1): LearnerSessionPlanV1 {
  return {
    id: plan.id,
    userId: plan.userId,
    missionId: plan.missionId,
    missionTitle: plan.missionTitle,
    mode: plan.mode,
    estimatedMinutes: plan.estimatedMinutes,
    weakFocus: plan.weakFocus,
    activities: plan.activities.map((entry) => ({
      kind: entry.kind,
      rationale: entry.rationale,
      activity: presentActivityForLearner(entry.activity),
    })),
    completionReward: plan.completionReward,
  };
}

export function presentSessionForLearner(session: SessionRecord): LearnerSessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    plan: presentSessionPlanForLearner(session.plan),
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    currentIndex: session.currentIndex,
  };
}

export type LearnerReviewSummary = Pick<
  ReviewItem,
  "id" | "prompt" | "dueAt" | "failureCount"
>;

export function presentReviewForLearner(review: ReviewItem): LearnerReviewSummary {
  return {
    id: review.id,
    prompt: review.prompt,
    dueAt: review.dueAt,
    failureCount: review.failureCount,
  };
}
