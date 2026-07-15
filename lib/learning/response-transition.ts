import type {
  ActivityDefinition,
  AttemptEvidenceKind,
  MistakePattern,
  ReviewItem,
  ValidationResultV1,
} from "@/lib/domain/types";
import { createReviewDueSoon, nextReview, qualityFromAttempt } from "@/lib/learning/srs";

const productiveActivityTypes = new Set<ActivityDefinition["type"]>([
  "typing",
  "fill_blank",
  "sentence_builder",
]);

export function inferEvidenceKind(activityType: ActivityDefinition["type"]): AttemptEvidenceKind {
  if (activityType === "multiple_choice") return "recognition";
  if (activityType === "typing") return "free-production";
  return "controlled";
}

export function isQualifyingProductiveSuccess({
  activity,
  completed,
  correct,
  evidenceKind,
}: {
  activity: ActivityDefinition;
  completed: boolean;
  correct: boolean;
  evidenceKind: AttemptEvidenceKind;
}) {
  return completed && correct && evidenceKind !== "self-report" && productiveActivityTypes.has(activity.type);
}

export function isQualifyingSessionEvidence({
  completed,
  correct,
  evidenceKind,
}: {
  completed: boolean;
  correct: boolean;
  evidenceKind: AttemptEvidenceKind;
}) {
  return completed && correct && evidenceKind !== "self-report";
}

export type ResponseTransitionInput = {
  userId: string;
  activity: ActivityDefinition;
  result: ValidationResultV1;
  completed: boolean;
  correct: boolean;
  evidenceKind: AttemptEvidenceKind;
  latencyMs: number;
  createdAt: string;
  contentItemId: string;
  ruleId: string;
  mistakePatternId: string;
  reviewId: string;
  existingPattern?: MistakePattern;
  existingReview?: ReviewItem;
};

export type ResponseTransition = {
  mistakePattern?: MistakePattern;
  reviewItem?: ReviewItem;
  recordMistakeEvent: boolean;
};

/**
 * The single domain transition for response evidence, mistake state, and review
 * state. Repositories only load current state and persist the returned updates.
 */
export function transitionResponseState(input: ResponseTransitionInput): ResponseTransition {
  if (!input.completed || input.evidenceKind === "self-report") {
    return { recordMistakeEvent: false };
  }

  if (!input.correct) {
    if (!input.result.shouldCreateReview) return { recordMistakeEvent: false };

    const mistakePattern: MistakePattern = {
      id: input.existingPattern?.id ?? input.mistakePatternId,
      userId: input.userId,
      ruleId: input.ruleId,
      mistakeType: input.result.mistakeType ?? "unknown",
      correctedAnswer: input.result.correctAnswer,
      explanation: input.result.feedback,
      repeatCount: (input.existingPattern?.repeatCount ?? 0) + 1,
      separateProductionSuccesses: 0,
      resolved: false,
      lastSeenAt: input.createdAt,
    };
    const reviewItem = input.existingReview
      ? {
          ...nextReview(input.existingReview, "again", new Date(input.createdAt)),
          priority: Math.max(input.existingReview.priority + 2, 2),
        }
      : createReviewDueSoon(
          {
            id: input.reviewId,
            userId: input.userId,
            contentItemId: input.contentItemId,
            activityId: input.activity.id,
            ruleId: input.ruleId,
            prompt: input.activity.prompt,
            expectedAnswers: input.activity.acceptedAnswers,
          },
          new Date(input.createdAt),
        );

    return { mistakePattern, reviewItem, recordMistakeEvent: true };
  }

  const qualifiesForRepair = isQualifyingProductiveSuccess({
    activity: input.activity,
    completed: input.completed,
    correct: input.correct,
    evidenceKind: input.evidenceKind,
  });
  const mistakePattern = input.existingPattern && !input.existingPattern.resolved && qualifiesForRepair
    ? {
        ...input.existingPattern,
        separateProductionSuccesses: input.existingPattern.separateProductionSuccesses + 1,
        resolved: input.existingPattern.separateProductionSuccesses + 1 >= 2,
        lastSeenAt: input.createdAt,
      }
    : undefined;
  const reviewItem = input.existingReview
    ? nextReview(
        input.existingReview,
        qualityFromAttempt({
          isCorrect: true,
          latencyMs: input.latencyMs,
          estimatedSeconds: input.activity.estimatedSeconds,
          activityType: input.activity.type,
        }),
        new Date(input.createdAt),
      )
    : undefined;

  return { mistakePattern, reviewItem, recordMistakeEvent: false };
}
