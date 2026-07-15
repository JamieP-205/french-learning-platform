import { describe, expect, it } from "vitest";
import { createReviewDueSoon, nextReview, qualityFromAttempt } from "../lib/learning/srs";

const item = () => createReviewDueSoon({ id: "review-1", userId: "learner", contentItemId: "item", activityId: "activity", prompt: "Prompt", expectedAnswers: [{ value: "Answer" }] }, new Date("2026-06-20T10:00:00Z"));

describe("review scheduling", () => {
  it("starts an incorrect item due the next day", () => expect(item().dueAt).toBe("2026-06-21T10:00:00.000Z"));
  it("moves a good answer forward on the defined ladder", () => {
    const updated = nextReview(item(), "good", new Date("2026-06-20T10:00:00Z"));
    expect(updated).toMatchObject({ stage: 1, dueAt: "2026-06-23T10:00:00.000Z", successCount: 1 });
  });
  it("lowers stage and raises priority after another lapse", () => {
    const first = nextReview({ ...item(), stage: 2, priority: 1 }, "again", new Date("2026-06-20T10:00:00Z"));
    expect(first).toMatchObject({ stage: 1, priority: 3, failureCount: 2, dueAt: "2026-06-21T10:00:00.000Z" });
  });
  it("keeps slow and recognition-only correct answers in a shorter review lane", () => {
    expect(qualityFromAttempt({ isCorrect: true, latencyMs: 30_000, estimatedSeconds: 10, activityType: "typing" })).toBe("hard");
    expect(qualityFromAttempt({ isCorrect: true, latencyMs: 1_000, estimatedSeconds: 10, activityType: "multiple_choice" })).toBe("hard");
  });
});
