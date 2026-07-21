import { describe, expect, it } from "vitest";
import { computeTopicBadges, type BadgeAttemptSignal } from "../lib/progress/topic-badges";

function productiveSuccess(activityId: string): BadgeAttemptSignal {
  return { activityId, isCorrect: true, evidenceKind: "controlled", completed: true, productive: true };
}

const introBadge = (signals: BadgeAttemptSignal[]) =>
  computeTopicBadges(signals).find((badge) => badge.id === "badge-introduce-yourself")!;

describe("topic badges", () => {
  it("only shows badges for published missions", () => {
    const badges = computeTopicBadges([]);
    expect(badges.map((badge) => badge.id)).toEqual(["badge-introduce-yourself"]);
  });

  it("earns the introduction badge from productive successes across every requirement", () => {
    const badge = introBadge([
      productiveSuccess("act-age-typing-v1"),
      productiveSuccess("act-origin-builder-v1"),
    ]);
    expect(badge.earned).toBe(true);
    expect(badge.title).toMatch(/practised/i);
  });

  it("stays unearned while any requirement group is missing", () => {
    const badge = introBadge([productiveSuccess("act-age-typing-v1")]);
    expect(badge.earned).toBe(false);
  });

  it("never counts recognition-only work", () => {
    const badge = introBadge([
      { activityId: "act-age-typing-v1", isCorrect: true, evidenceKind: "recognition", completed: true, productive: false },
      productiveSuccess("act-origin-builder-v1"),
    ]);
    expect(badge.earned).toBe(false);
  });

  it("never counts revealed or self-reported answers", () => {
    const badge = introBadge([
      { activityId: "act-age-typing-v1", isCorrect: false, evidenceKind: "self-report", completed: true, productive: true },
      { activityId: "act-origin-builder-v1", isCorrect: true, evidenceKind: "self-report", completed: true, productive: true },
    ]);
    expect(badge.earned).toBe(false);
  });
});
