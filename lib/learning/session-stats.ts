import type { ActivityAttempt } from "@/lib/domain/types";

export type SessionStats = {
  correct: number;
  total: number;
  fastestMs?: number;
};

export function buildSessionStats(attempts: ActivityAttempt[], sessionId: string): SessionStats {
  const checkedAttempts = attempts.filter(
    (attempt) =>
      attempt.sessionId === sessionId &&
      attempt.evidenceKind !== "self-report",
  );

  if (checkedAttempts.length === 0) {
    return { correct: 0, total: 0 };
  }

  return {
    correct: checkedAttempts.filter((attempt) => attempt.correct ?? attempt.result.isCorrect).length,
    total: checkedAttempts.length,
    fastestMs: Math.min(...checkedAttempts.map((attempt) => attempt.latencyMs)),
  };
}
