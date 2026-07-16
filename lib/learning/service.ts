import { z } from "zod";
import { getLearningRepository } from "@/lib/data";
import type { AttemptEvidenceKind, LearnerProfile, SessionPlanV1 } from "@/lib/domain/types";
import { validateActivityAnswer } from "@/lib/learning/answer-validation";
import { selfCorrectionPrompt } from "@/lib/learning/feedback-sequence";
import { buildLearnerStats } from "@/lib/learning/learner-model";
import { inferEvidenceKind } from "@/lib/learning/response-transition";
import { buildSessionPlan } from "@/lib/learning/session-planner";
import { getMissionBySlug, isPublicScoredMissionSlug } from "@/lib/content/scored-missions";

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  dailyMinutes: z.number().int().min(2).max(60).optional(),
  preferredMode: z.enum(["normal", "short"]).optional(),
  focusPreferences: z.array(z.enum(["speaking", "listening", "writing", "review"])).max(4).optional(),
  speakingConfidence: z.enum(["low", "medium", "high"]).optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
});

export async function updateProfile(userId: string, changes: z.infer<typeof profileUpdateSchema>) {
  const repository = getLearningRepository();
  const profile = await repository.getProfile(userId);
  if (!profile) return null;
  return repository.saveProfile({ ...profile, ...changes });
}

export class OnboardingEligibilityError extends Error {}

export const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  currentLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  learningGoals: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
  interests: z.array(z.string().trim().min(1).max(30)).max(12),
  dailyMinutes: z.number().int().min(2).max(60),
  preferredMode: z.enum(["normal", "short"]),
  focusPreferences: z.array(z.enum(["speaking", "listening", "writing", "review"])).max(4).default([]),
  speakingConfidence: z.enum(["low", "medium", "high"]).default("medium"),
  ageConfirmed: z.literal(true),
  policyVersion: z.string().trim().min(1).max(40),
  acceptedRequiredPolicies: z.literal(true),
});

export async function completeOnboarding(userId: string, data: z.infer<typeof onboardingSchema>) {
  const repository = getLearningRepository();
  const profile: LearnerProfile = {
    userId,
    ...data,
    completedSessions: 0,
    currentStreak: 0,
    streakFreezes: 0,
  };
  const savedProfile = await repository.saveProfile(profile);
  await repository.recordRequiredPrivacyConsents(userId, profile.policyVersion);
  return savedProfile;
}

export async function getTodayPlan(userId: string, requestedMode?: "normal" | "short") {
  const repository = getLearningRepository();
  const profile = await repository.getProfile(userId);
  if (!profile) return null;
  const [mission, dueReviews, mistakes, attempts] = await Promise.all([
    repository.getMission(),
    repository.getDueReviews(userId),
    repository.getOpenMistakes(userId),
    repository.getRecentAttempts(userId),
  ]);
  const activityById = new Map(mission.activities.map((activity) => [activity.id, activity]));
  const stats = buildLearnerStats(attempts, activityById);
  return buildSessionPlan({ profile, mission, dueReviews, mistakes, stats, requestedMode });
}

// A review-first plan for learners who open the Review tab with items due:
// due work plus the strongest repair, without introducing new mission steps.
export async function getReviewPlan(userId: string) {
  const repository = getLearningRepository();
  const profile = await repository.getProfile(userId);
  if (!profile) return null;
  const [mission, dueReviews, mistakes, attempts] = await Promise.all([
    repository.getMission(),
    repository.getDueReviews(userId),
    repository.getOpenMistakes(userId),
    repository.getRecentAttempts(userId),
  ]);
  if (dueReviews.length === 0) return getTodayPlan(userId);
  const activityById = new Map(mission.activities.map((activity) => [activity.id, activity]));
  const stats = buildLearnerStats(attempts, activityById);
  const plan = buildSessionPlan({
    profile: { ...profile, focusPreferences: [...(profile.focusPreferences ?? []), "review"] },
    mission,
    dueReviews,
    mistakes,
    stats,
  });
  const focused = plan.activities.filter((entry) => entry.kind !== "mission");
  return {
    ...plan,
    missionTitle: "Focused review",
    activities: focused.length > 0 ? focused : plan.activities.slice(0, 2),
    estimatedMinutes: Math.max(2, Math.min(plan.estimatedMinutes, focused.length * 2)),
    weakFocus: "Just the phrases that are due, so recall stays cheap to keep.",
    completionReward: "Due review cleared — the fastest kind of progress.",
  };
}


export async function getMissionPlan(userId: string, missionSlug: string, requestedMode?: "normal" | "short") {
  const repository = getLearningRepository();
  const profile = await repository.getProfile(userId);
  if (!profile) return null;

  const mission = getMissionBySlug(missionSlug);
  if (!mission) throw new Error("That scored mission is not available yet.");
  if (!isPublicScoredMissionSlug(missionSlug)) {
    throw new Error("That scored mission is still in content review. Use the preview page for now.");
  }

  const missionActivityIds = new Set(mission.activities.map((activity) => activity.id));
  const missionRuleIds = new Set(mission.activities.flatMap((activity) => activity.grammarRuleIds));

  const [dueReviews, mistakes] = await Promise.all([
    repository.getDueReviews(userId),
    repository.getOpenMistakes(userId),
  ]);

  return buildSessionPlan({
    profile,
    mission,
    dueReviews: dueReviews.filter((review) => missionActivityIds.has(review.activityId)),
    mistakes: mistakes.filter((mistake) => missionRuleIds.has(mistake.ruleId)),
    requestedMode,
  });
}
export async function startSession(userId: string, plan: SessionPlanV1, { allowResume = true } = {}) {
  const repository = getLearningRepository();
  // Resume a same-day unfinished session instead of quietly abandoning its progress.
  // Older unfinished sessions are stale plans, so those start fresh.
  if (allowResume) {
    const active = await repository.getActiveSession(userId);
    const sameDay = active?.startedAt.slice(0, 10) === new Date().toISOString().slice(0, 10);
    if (active && sameDay && active.plan.missionId === plan.missionId) {
      return active;
    }
  }
  return repository.createSession(userId, plan);
}

export async function submitActivity({
  userId,
  sessionId,
  activityId,
  submittedAnswer,
  latencyMs,
  correct,
  evidenceKind,
}: {
  userId: string;
  sessionId: string;
  activityId: string;
  submittedAnswer: string;
  latencyMs: number;
  completed?: boolean;
  correct?: boolean;
  evidenceKind?: AttemptEvidenceKind;
}) {
  const repository = getLearningRepository();
  const session = await repository.getSession(userId, sessionId);
  if (!session || session.completedAt) throw new Error("This learning session is unavailable.");
  const planned = session.plan.activities[session.currentIndex];
  if (!planned || planned.activity.id !== activityId) throw new Error("That activity is not the current session step.");
  const isSpeechCheck = planned.activity.type === "speak_repeat";
  const isAnswerReveal = evidenceKind === "self-report";
  const effectiveEvidenceKind = isAnswerReveal
    ? "self-report"
    : isSpeechCheck
    ? evidenceKind === "controlled" && correct === true
      ? "controlled"
      : "self-report"
    : inferEvidenceKind(planned.activity.type);
  const effectiveCorrect = isSpeechCheck && effectiveEvidenceKind === "controlled";
  const validatedResult = validateActivityAnswer(planned.activity, submittedAnswer);
  const previousAttempts = await repository.getRecentAttempts(userId);
  const previousMissesForPresentation = previousAttempts.filter(
    (attempt) =>
      attempt.sessionId === sessionId &&
      attempt.activityId === activityId &&
      attempt.evidenceKind !== "self-report" &&
      !(attempt.correct ?? attempt.result.isCorrect),
  );
  const isFirstScoredMiss =
    !isSpeechCheck &&
    !isAnswerReveal &&
    !validatedResult.isCorrect &&
    previousMissesForPresentation.length === 0;
  const effectiveCompleted = isFirstScoredMiss ? false : true;
  const result = isAnswerReveal
    ? {
        ...validatedResult,
        isCorrect: false,
        isNearMiss: false,
        feedback: "Answer revealed without mastery credit.",
        mistakeType: undefined,
        shouldCreateReview: false,
      }
    : isSpeechCheck
    ? {
        ...validatedResult,
        isCorrect: effectiveCorrect,
        isNearMiss: false,
        feedback: effectiveCorrect ? planned.activity.feedbackCorrect : "Speaking self-check saved without mastery credit.",
        correctAnswer: planned.activity.type === "speak_repeat"
          ? planned.activity.targetText ?? planned.activity.prompt
          : planned.activity.prompt,
        mistakeType: undefined,
        shouldCreateReview: false,
      }
    : isFirstScoredMiss
      ? {
          ...validatedResult,
          feedback: selfCorrectionPrompt(planned.activity, validatedResult),
          correctAnswer: "",
          shouldCreateReview: false,
        }
      : validatedResult;
  const attempt = await repository.recordSubmission({
    userId,
    sessionId,
    activity: planned.activity,
    submittedAnswer,
    latencyMs,
    result,
    completed: effectiveCompleted,
    correct: result.isCorrect,
    evidenceKind: effectiveEvidenceKind,
  });
  const updatedSession = await repository.getSession(userId, sessionId);
  return { attempt, session: updatedSession };
}

