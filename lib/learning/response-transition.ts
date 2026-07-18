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

export function isProductiveActivityType(activityType: ActivityDefinition["type"]) {
  return productiveActivityTypes.has(activityType);
}

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
  return completed && correct && evidenceKind !== "self-report" && isProductiveActivityType(activity.type);
}

export function isQualifyingSessionEvidence({
  completed,
  evidenceKind,
}: {
  completed: boolean;
  evidenceKind: AttemptEvidenceKind;
}) {
  return completed && evidenceKind !== "self-report";
}

export function requiredCheckedActivities(totalActivities: number) {
  return Math.max(1, Math.ceil(Math.max(0, totalActivities) * 0.6));
}

export function hasSessionCompletionCredit({
  attempts,
  totalActivities,
}: {
  attempts: Array<{ activityId: string; completed?: boolean; evidenceKind?: AttemptEvidenceKind }>;
  totalActivities: number;
}) {
  const checkedActivityIds = new Set(
    attempts
      .filter((attempt) => isQualifyingSessionEvidence({
        completed: attempt.completed ?? true,
        evidenceKind: attempt.evidenceKind ?? "controlled",
      }))
      .map((attempt) => attempt.activityId),
  );

  return checkedActivityIds.size >= requiredCheckedActivities(totalActivities);
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
  // An incomplete first miss is still valid diagnostic evidence: it should
  // schedule a repair without advancing the session. Answer reveals are the
  // exception because they are explicitly self-reported, not retrieved.
  if (input.evidenceKind === "self-report") {
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

  if (!input.completed) {
    return { recordMistakeEvent: false };
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
