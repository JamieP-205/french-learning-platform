import type { ReviewItem } from "@/lib/domain/types";

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export type ReviewQuality = "again" | "hard" | "good" | "easy";

export function qualityFromAttempt({
  isCorrect,
  latencyMs,
  estimatedSeconds,
  activityType,
}: {
  isCorrect: boolean;
  latencyMs: number;
  estimatedSeconds: number;
  activityType: string;
}): ReviewQuality {
  if (!isCorrect) return "again";
  const isRecognition = activityType === "multiple_choice";
  const isSlow = latencyMs > estimatedSeconds * 1000 * 1.5;
  if (isRecognition || isSlow) return "hard";
  if (latencyMs < estimatedSeconds * 1000 * 0.55) return "easy";
  return "good";
}

export function nextReview(item: ReviewItem, quality: ReviewQuality, now = new Date()): ReviewItem {
  let stage = item.stage;
  let priority = item.priority;
  let successCount = item.successCount;
  let failureCount = item.failureCount;
  let dueAt: Date;

  if (quality === "again") {
    stage = Math.max(0, stage - 1);
    failureCount += 1;
    priority += 2;
    dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (quality === "hard") {
    successCount += 1;
    priority += 1;
    dueAt = new Date(now.getTime() + REVIEW_INTERVAL_DAYS[Math.min(stage, 1)] * 24 * 60 * 60 * 1000);
  } else if (quality === "easy") {
    stage = Math.min(REVIEW_INTERVAL_DAYS.length - 1, stage + 2);
    successCount += 1;
    priority = Math.max(0, priority - 1);
    dueAt = new Date(now.getTime() + REVIEW_INTERVAL_DAYS[stage] * 24 * 60 * 60 * 1000);
  } else {
    stage = Math.min(REVIEW_INTERVAL_DAYS.length - 1, stage + 1);
    successCount += 1;
    priority = Math.max(0, priority - 1);
    dueAt = new Date(now.getTime() + REVIEW_INTERVAL_DAYS[stage] * 24 * 60 * 60 * 1000);
  }

  return { ...item, stage, priority, successCount, failureCount, dueAt: dueAt.toISOString() };
}

export function createReviewDueSoon(item: Omit<ReviewItem, "stage" | "dueAt" | "successCount" | "failureCount" | "priority">, now = new Date()): ReviewItem {
  return {
    ...item,
    stage: 0,
    dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    successCount: 0,
    failureCount: 1,
    priority: 2,
  };
}
