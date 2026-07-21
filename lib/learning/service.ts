import { z } from "zod";
import { getLearningRepository } from "@/lib/data";
import type {
  ActivityAttempt,
  ActivityDefinition,
  AttemptEvidenceKind,
  LearnerProfile,
  SessionPlanV1,
  SessionRecord,
} from "@/lib/domain/types";
import { validateActivityAnswer } from "@/lib/learning/answer-validation";
import { selfCorrectionPrompt } from "@/lib/learning/feedback-sequence";
import { buildLearnerStats } from "@/lib/learning/learner-model";
import { inferEvidenceKind } from "@/lib/learning/response-transition";
import { buildSessionPlan } from "@/lib/learning/session-planner";
import { getMissionBySlug, isPublicScoredMissionSlug } from "@/lib/content/scored-missions";
import { CURRENT_REQUIRED_POLICY_VERSION } from "@/lib/privacy/policy";
import {
  DEFAULT_TIME_ZONE,
  isSameCalendarDay,
  isValidIanaTimeZone,
  normalizeIanaTimeZone,
} from "@/lib/time/calendar-day";

const timeZoneSchema = z.string()
  .trim()
  .min(1)
  .max(100)
  .refine(isValidIanaTimeZone, "Choose a valid time zone.")
  .transform(normalizeIanaTimeZone);

const displayNameSchema = z.string()
  .refine(
    (value) => !/[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/u.test(value),
    "Use a name without control or hidden formatting characters.",
  )
  .transform((value) => value.normalize("NFC").trim().replace(/\p{Zs}+/gu, " "))
  .pipe(z.string().min(1).max(60));

function presentAttemptWithoutEarlyAnswer(
  attempt: ActivityAttempt,
  activity: ActivityDefinition,
) {
  if (
    attempt.completed !== false ||
    attempt.evidenceKind === "self-report" ||
    (attempt.correct ?? attempt.result.isCorrect)
  ) {
    return attempt;
  }

  return {
    ...attempt,
    result: {
      ...attempt.result,
      feedback: selfCorrectionPrompt(activity, attempt.result),
      correctAnswer: "",
      shouldCreateReview: true,
    },
  };
}

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  currentLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
  learningGoals: z.array(z.string().trim().min(1).max(30)).min(1).max(6).optional(),
  dailyMinutes: z.number().int().min(2).max(60).optional(),
  preferredMode: z.enum(["normal", "short"]).optional(),
  timeZone: timeZoneSchema.optional(),
  focusPreferences: z.array(z.enum(["speaking", "listening", "writing", "review"])).max(4).optional(),
  speakingConfidence: z.enum(["low", "medium", "high"]).optional(),
  speechSpeed: z.enum(["normal", "slow"]).optional(),
  themePreference: z.enum(["light", "dark", "system"]).optional(),
  companionQuiet: z.boolean().optional(),
  gamification: z.enum(["full", "quiet", "off"]).optional(),
  streakMode: z.enum(["daily", "weekly"]).optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
}).strict();

export async function updateProfile(userId: string, changes: z.infer<typeof profileUpdateSchema>) {
  return getLearningRepository().updateProfilePreferences(userId, changes);
}

export class OnboardingEligibilityError extends Error {}

export const onboardingSchema = z.object({
  displayName: displayNameSchema,
  currentLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  learningGoals: z.array(z.string().trim().min(1).max(30)).min(1).max(6),
  interests: z.array(z.string().trim().min(1).max(30)).max(12),
  dailyMinutes: z.number().int().min(2).max(60),
  preferredMode: z.enum(["normal", "short"]),
  timeZone: timeZoneSchema.default(DEFAULT_TIME_ZONE),
  focusPreferences: z.array(z.enum(["speaking", "listening", "writing", "review"])).max(4).default([]),
  speakingConfidence: z.enum(["low", "medium", "high"]).default("medium"),
  ageConfirmed: z.literal(true),
  acceptedRequiredPolicies: z.literal(true),
}).strict();

export async function completeOnboarding(userId: string, data: z.infer<typeof onboardingSchema>) {
  const repository = getLearningRepository();
  const existing = await repository.getProfile(userId);
  const { acceptedRequiredPolicies, ...profileFields } = data;
  if (!acceptedRequiredPolicies) throw new OnboardingEligibilityError("Required policies were not accepted.");
  const profile: LearnerProfile = {
    userId,
    ...profileFields,
    policyVersion: CURRENT_REQUIRED_POLICY_VERSION,
    friendCode: existing?.friendCode,
    lastCompletedAt: existing?.lastCompletedAt,
    completedSessions: existing?.completedSessions ?? 0,
    currentStreak: existing?.currentStreak ?? 0,
    streakFreezes: existing?.streakFreezes ?? 0,
  };
  return repository.completeOnboardingProfile(profile);
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

export const FOCUSED_REVIEW_MISSION_TITLE = "Focused review";

export function isFocusedReviewPlan(plan: SessionPlanV1) {
  return plan.missionTitle === FOCUSED_REVIEW_MISSION_TITLE;
}

type SessionIntent = "lesson" | "focused_review";

export function findResumableSession(
  sessions: SessionRecord[],
  {
    intent,
    missionId,
    mode,
  }: {
    intent: SessionIntent;
    missionId?: string;
    mode?: SessionPlanV1["mode"];
  },
  now = new Date(),
  timeZone?: string,
) {
  return sessions.find((session) => {
    const focusedReview = isFocusedReviewPlan(session.plan);
    return !session.completedAt &&
      isSameCalendarDay(session.startedAt, now, timeZone) &&
      focusedReview === (intent === "focused_review") &&
      (!missionId || session.plan.missionId === missionId) &&
      (!mode || session.plan.mode === mode);
  }) ?? null;
}

export async function getResumableSession(
  userId: string,
  criteria: {
    intent: SessionIntent;
    missionId?: string;
    mode?: SessionPlanV1["mode"];
  },
  now = new Date(),
) {
  const repository = getLearningRepository();
  const [profile, sessions] = await Promise.all([
    repository.getProfile(userId),
    repository.getActiveSessions(userId),
  ]);
  return findResumableSession(sessions, criteria, now, profile?.timeZone);
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
    missionTitle: FOCUSED_REVIEW_MISSION_TITLE,
    activities: focused.length > 0 ? focused : plan.activities.slice(0, 2),
    estimatedMinutes: Math.max(2, Math.min(plan.estimatedMinutes, focused.length * 2)),
    weakFocus: "Just the phrases that are due, so recall stays cheap to keep.",
    completionReward: "Due review cleared. The fastest kind of progress.",
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
export async function startSession(
  userId: string,
  plan: SessionPlanV1,
  {
    allowResume = true,
    requestId,
  }: {
    allowResume?: boolean;
    requestId?: string;
  } = {},
) {
  const repository = getLearningRepository();
  // Resume a same-day unfinished session instead of quietly abandoning its progress.
  // Focused review and ordinary lesson sessions have separate resume lanes.
  // Older unfinished sessions are stale plans, so those start fresh.
  if (allowResume) {
    const active = await getResumableSession(userId, {
      intent: isFocusedReviewPlan(plan) ? "focused_review" : "lesson",
      missionId: plan.missionId,
      mode: plan.mode,
    });
    if (active) return active;
  }
  return repository.createSession(userId, plan, {
    resumeIfAvailable: allowResume,
    requestId,
  });
}

export async function submitActivity({
  requestId = crypto.randomUUID(),
  userId,
  sessionId,
  activityId,
  submittedAnswer,
  latencyMs,
  evidenceKind,
}: {
  requestId?: string;
  userId: string;
  sessionId: string;
  activityId: string;
  submittedAnswer: string;
  latencyMs: number;
  evidenceKind?: AttemptEvidenceKind;
}) {
  const repository = getLearningRepository();
  const existingAttempt = await repository.getAttemptByRequestId(userId, requestId);
  const session = await repository.getSession(userId, sessionId);
  if (!session) throw new Error("This learning session is unavailable.");
  if (existingAttempt) {
    const existingActivity = session.plan.activities.find((entry) => entry.activity.id === activityId)?.activity;
    const expectedEvidenceKind = existingActivity?.type === "speak_repeat" || evidenceKind === "self-report"
      ? "self-report"
      : existingActivity ? inferEvidenceKind(existingActivity.type) : undefined;
    if (
      existingAttempt.sessionId !== sessionId ||
      existingAttempt.activityId !== activityId ||
      existingAttempt.submittedAnswer !== submittedAnswer ||
      existingAttempt.latencyMs !== latencyMs ||
      !existingActivity ||
      existingAttempt.evidenceKind !== expectedEvidenceKind
    ) {
      throw new Error("This request ID was already used for another answer.");
    }
    const presentationAttempt = presentAttemptWithoutEarlyAnswer(existingAttempt, existingActivity);
    return { attempt: presentationAttempt, session };
  }
  if (session.completedAt) throw new Error("This learning session is unavailable.");
  const planned = session.plan.activities[session.currentIndex];
  if (!planned || planned.activity.id !== activityId) throw new Error("That activity is not the current session step.");
  const isSpeechCheck = planned.activity.type === "speak_repeat";
  const isAnswerReveal = !isSpeechCheck && evidenceKind === "self-report";
  const effectiveEvidenceKind = isSpeechCheck || isAnswerReveal
    ? "self-report"
    : inferEvidenceKind(planned.activity.type);
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
  const presentationResult = isAnswerReveal
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
        isCorrect: false,
        isNearMiss: false,
        feedback: "Speaking self-check saved. It does not change your lesson results.",
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
          shouldCreateReview: true,
        }
      : validatedResult;
  // Keep the first retry hint free of the answer while persisting the full
  // validated miss as diagnostic evidence. The session remains on this step.
  const persistedResult = isFirstScoredMiss ? validatedResult : presentationResult;
  const attempt = await repository.recordSubmission({
    requestId,
    expectedCurrentIndex: session.currentIndex,
    userId,
    sessionId,
    activity: planned.activity,
    submittedAnswer,
    latencyMs,
    result: persistedResult,
    completed: effectiveCompleted,
    correct: persistedResult.isCorrect,
    evidenceKind: effectiveEvidenceKind,
  });
  const updatedSession = await repository.getSession(userId, sessionId);
  return {
    // The repository result is authoritative. A concurrent retry can commit the
    // first miss after this handler's initial lookup, so never base answer
    // visibility only on this handler's earlier view of the attempt history.
    attempt: presentAttemptWithoutEarlyAnswer(attempt, planned.activity),
    session: updatedSession,
  };
}

