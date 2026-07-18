import { createClient } from "@supabase/supabase-js";
import { getSeedMission } from "@/lib/content/seed";
import type {
  ActivityAttempt,
  CefrLevel,
  LearnerProfile,
  MistakePattern,
  ProgressSnapshot,
  ReviewItem,
  SessionPlanV1,
  SessionRecord,
  SocialProfile,
  SocialSnapshot,
  TutorContextPackV1,
  TutorFeedbackV1,
  ValidationResultV1,
} from "@/lib/domain/types";
import type {
  LearningRepository,
  ProfilePreferenceChanges,
  SessionCreationOptions,
  SubmissionInput,
} from "@/lib/data/repository";
import { buildProgressSnapshot } from "@/lib/learning/progress-summary";
import { getMissionById, getScoredActivityById } from "@/lib/content/scored-missions";
import {
  inferEvidenceKind,
  transitionResponseState,
} from "@/lib/learning/response-transition";
import { generateFriendCode } from "@/lib/social/friend-code";
import { coopChallengeProgress } from "@/lib/social/integrity";
import { normalizeIanaTimeZone } from "@/lib/time/calendar-day";

const requiredEnvironment = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server configuration is incomplete.");
  return { url, serviceKey };
};

type Row = Record<string, unknown>;
const RESUMABLE_SESSION_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const RESUMABLE_SESSION_LIMIT = 50;
const SOCIAL_FRIEND_LIMIT = 200;
const SOCIAL_PENDING_REQUEST_LIMIT = 100;
const SOCIAL_BLOCK_LIMIT = 500;
const LEARNING_SIGNAL_LIMIT = 200;

type ExportPageOptions = {
  orderBy: string;
  cutoffColumn: string;
  cutoff: string;
};

function mistakePatternFromRow(row: Row): MistakePattern {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    ruleId: row.rule_id as string,
    mistakeType: row.mistake_type as MistakePattern["mistakeType"],
    correctedAnswer: row.corrected_answer as string,
    explanation: row.explanation as string,
    repeatCount: row.repeat_count as number,
    separateProductionSuccesses: row.separate_production_successes as number,
    resolved: row.resolved as boolean,
    lastSeenAt: row.last_seen_at as string,
    transitionRevision: (row.transition_revision as number | undefined) ?? 0,
  };
}

function reviewItemFromRow(row: Row): ReviewItem {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    contentItemId: row.content_item_id as string,
    activityId: row.activity_id as string,
    ruleId: row.rule_id as string | undefined,
    prompt: row.prompt as string,
    expectedAnswers: row.expected_answers as ReviewItem["expectedAnswers"],
    stage: row.stage as number,
    dueAt: row.due_at as string,
    successCount: row.success_count as number,
    failureCount: row.failure_count as number,
    priority: row.priority as number,
    transitionRevision: (row.transition_revision as number | undefined) ?? 0,
  };
}

function activityAttemptFromRow(row: Row): ActivityAttempt {
  return {
    id: row.id as string,
    requestId: row.request_id as string | undefined,
    userId: row.user_id as string,
    sessionId: row.session_id as string,
    activityId: row.activity_id as string,
    submittedAnswer: row.submitted_answer as string,
    latencyMs: (row.latency_ms as number) ?? 0,
    completed: (row.completed as boolean | undefined) ?? true,
    correct: (row.is_correct as boolean | undefined) ?? Boolean((row.result_json as ValidationResultV1).isCorrect),
    evidenceKind: row.evidence_kind as ActivityAttempt["evidenceKind"] | undefined,
    result: row.result_json as ValidationResultV1,
    createdAt: row.created_at as string,
  };
}

function sessionFromRow(row: Row): SessionRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    plan: row.plan_json as SessionPlanV1,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | undefined,
    currentIndex: row.current_index as number,
  };
}

export class SupabaseLearningRepository implements LearningRepository {
  private readonly client = (() => {
    const { url, serviceKey } = requiredEnvironment();
    return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  })();

  async getProfile(userId: string): Promise<LearnerProfile | null> {
    const { data, error } = await this.client.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Row;
    return {
      userId: row.id as string,
      displayName: (row.display_name as string) ?? "Learner",
      friendCode: row.friend_code as string | undefined,
      currentLevel: ((row.current_level as CefrLevel) ?? "A1"),
      learningGoals: (row.learning_goals as string[]) ?? [],
      interests: (row.interests as string[]) ?? [],
      dailyMinutes: (row.daily_minutes as number) ?? 8,
      preferredMode: (row.preferred_mode as "normal" | "short") ?? "normal",
      timeZone: normalizeIanaTimeZone(row.time_zone as string | undefined),
      focusPreferences: (row.focus_preferences as string[]) ?? [],
      speakingConfidence: ((row.speaking_confidence as "low" | "medium" | "high") ?? "medium"),
      ageConfirmed: Boolean(row.age_confirmed),
      country: (row.country as string) ?? "",
      birthDate: (row.birth_date as string) ?? undefined,
      policyVersion: row.policy_version as string,
      lastCompletedAt: row.last_completed_at as string | undefined,
      completedSessions: (row.completed_sessions as number) ?? 0,
      currentStreak: (row.current_streak as number) ?? 0,
      streakFreezes: (row.streak_freezes as number) ?? 0,
    };
  }

  async saveProfile(profile: LearnerProfile) {
    const existing = await this.getProfile(profile.userId);
    const { error } = await this.client.from("profiles").upsert({
      id: profile.userId,
      display_name: profile.displayName,
      friend_code: existing?.friendCode ?? profile.friendCode ?? generateFriendCode(),
      current_level: profile.currentLevel,
      learning_goals: profile.learningGoals,
      interests: profile.interests,
      daily_minutes: profile.dailyMinutes,
      preferred_mode: profile.preferredMode,
      time_zone: normalizeIanaTimeZone(profile.timeZone),
      focus_preferences: profile.focusPreferences ?? [],
      speaking_confidence: profile.speakingConfidence ?? "medium",
      age_confirmed: profile.ageConfirmed ?? false,
      country: profile.country ?? null,
      birth_date: profile.birthDate ?? null,
      policy_version: profile.policyVersion,
      last_completed_at: profile.lastCompletedAt ?? null,
      completed_sessions: profile.completedSessions,
      current_streak: profile.currentStreak,
      streak_freezes: profile.streakFreezes ?? 0,
    });
    if (error) throw error;
    return (await this.getProfile(profile.userId)) ?? profile;
  }

  async updateProfilePreferences(userId: string, changes: ProfilePreferenceChanges) {
    const update: Row = {};
    if (changes.displayName !== undefined) update.display_name = changes.displayName;
    if (changes.currentLevel !== undefined) update.current_level = changes.currentLevel;
    if (changes.learningGoals !== undefined) update.learning_goals = changes.learningGoals;
    if (changes.interests !== undefined) update.interests = changes.interests;
    if (changes.dailyMinutes !== undefined) update.daily_minutes = changes.dailyMinutes;
    if (changes.preferredMode !== undefined) update.preferred_mode = changes.preferredMode;
    if (changes.timeZone !== undefined) update.time_zone = normalizeIanaTimeZone(changes.timeZone);
    if (changes.focusPreferences !== undefined) update.focus_preferences = changes.focusPreferences;
    if (changes.speakingConfidence !== undefined) update.speaking_confidence = changes.speakingConfidence;
    if (Object.keys(update).length === 0) return this.getProfile(userId);

    const { error } = await this.client.from("profiles").update(update).eq("id", userId);
    if (error) throw error;
    return this.getProfile(userId);
  }

  async completeOnboardingProfile(profile: LearnerProfile) {
    const { error } = await this.client.rpc("complete_onboarding", {
      p_user_id: profile.userId,
      p_display_name: profile.displayName,
      p_current_level: profile.currentLevel,
      p_learning_goals: profile.learningGoals,
      p_interests: profile.interests,
      p_daily_minutes: profile.dailyMinutes,
      p_preferred_mode: profile.preferredMode,
      p_time_zone: normalizeIanaTimeZone(profile.timeZone),
      p_focus_preferences: profile.focusPreferences ?? [],
      p_speaking_confidence: profile.speakingConfidence ?? "medium",
      p_age_confirmed: profile.ageConfirmed ?? false,
      p_policy_version: profile.policyVersion,
      p_friend_code: profile.friendCode ?? generateFriendCode(),
    });
    if (error) throw error;
    return (await this.getProfile(profile.userId)) ?? profile;
  }

  async getMission() {
    const { data: missionData, error: missionError } = await this.client
      .from("missions")
      .select("*")
      .eq("slug", "introduce-yourself")
      .eq("publication_status", "published")
      .single();
    if (missionError) throw missionError;
    const mission = missionData as Row;
    const { data: activities, error: activitiesError } = await this.client
      .from("activities")
      .select("payload")
      .eq("mission_id", mission.id as string)
      .eq("publication_status", "published")
      .order("step_order");
    if (activitiesError) throw activitiesError;
    if (!activities || activities.length === 0) {
      throw new Error("The published mission has no published activities. Run the verified content seed before enabling learner sessions.");
    }
    const activityPayloads = activities.map((entry) => (entry as Row).payload) as ReturnType<typeof getSeedMission>["activities"];
    const contentItemIds = [...new Set(activityPayloads.flatMap((activity) => activity.contentItemIds))];
    const { data: contentRows, error: contentError } = await this.client
      .from("content_items")
      .select("*")
      .in("id", contentItemIds)
      .eq("publication_status", "published")
      .eq("verification_status", "source_validated");
    if (contentError) throw contentError;
    if (!contentRows || contentRows.length !== contentItemIds.length) {
      throw new Error("A published activity refers to missing or unpublished canonical content.");
    }
    if (contentRows.some((row) => !Array.isArray(row.source_ids) || row.source_ids.length === 0)) {
      throw new Error("Published learning content must cite at least one reviewed source.");
    }
    const sourceIds = [...new Set(contentRows.flatMap((row) => (row.source_ids as string[]) ?? []))];
    const { data: sourceRows, error: sourceError } = await this.client.from("content_sources").select("*").in("id", sourceIds);
    if (sourceError) throw sourceError;
    if (!sourceRows || sourceRows.length !== sourceIds.length) {
      throw new Error("Published learning content refers to a missing source record.");
    }
    const contentItems = contentRows.map((value) => {
      const row = value as Row;
      return {
        id: row.id as string,
        version: row.current_version as number,
        type: row.item_type as "phrase" | "grammar" | "dialogue",
        frenchText: row.french_text as string,
        englishMeaning: row.english_meaning as string,
        literalMeaning: row.literal_meaning as string | undefined,
        register: row.register as "formal" | "neutral" | "casual" | "slang" | "regional",
        usageContext: row.usage_context as string,
        cefrLevel: row.cefr_level as "A1",
        grammarTags: (row.grammar_tags as string[]) ?? [],
        sourceIds: (row.source_ids as string[]) ?? [],
        verificationStatus: row.verification_status as "source_validated",
        publicationStatus: "published" as const,
        reviewerNotes: row.reviewer_notes as string | undefined,
      };
    });
    const sources = (sourceRows ?? []).map((value) => {
      const row = value as Row;
      return { id: row.id as string, title: row.title as string, reference: row.reference as string, trustLevel: row.trust_level as "primary" | "editorial" | "reference" };
    });
    return {
      id: mission.id as string,
      slug: mission.slug as string,
      title: mission.title as string,
      description: mission.description as string,
      outcome: mission.outcome as string,
      estimatedMinutes: mission.estimated_minutes as number,
      cefrLevel: mission.cefr_level as "A1",
      activities: activityPayloads,
      contentItems,
      sources,
    };
  }

  async getDueReviews(userId: string) {
    const { data, error } = await this.client
      .from("review_items")
      .select("*")
      .eq("user_id", userId)
      .order("due_at")
      .limit(LEARNING_SIGNAL_LIMIT);
    if (error) throw error;
    return (data ?? []).map((value) => reviewItemFromRow(value as Row));
  }

  async getOpenMistakes(userId: string) {
    const { data, error } = await this.client
      .from("mistake_patterns")
      .select("*")
      .eq("user_id", userId)
      .eq("resolved", false)
      .order("last_seen_at", { ascending: false })
      .limit(LEARNING_SIGNAL_LIMIT);
    if (error) throw error;
    return (data ?? []).map((value) => mistakePatternFromRow(value as Row));
  }

  private async assertPublishedMissionRowsForSession(plan: SessionPlanV1) {
    const mission = getMissionById(plan.missionId);
    if (!mission) throw new Error("The session references an unknown mission.");
    const canonicalActivityIds = new Set(mission.activities.map((activity) => activity.id));
    if (plan.activities.some((entry) => !canonicalActivityIds.has(entry.activity.id))) {
      throw new Error("The session plan contains an activity outside its canonical mission.");
    }

    // Learner requests must never create or rewrite shared curriculum rows.
    // Content is provisioned by reviewed migrations and seed data; session
    // creation only verifies that the published foreign-key targets exist.
    const [missionResult, activityResult] = await Promise.all([
      this.client
        .from("missions")
        .select("id")
        .eq("id", mission.id)
        .eq("publication_status", "published")
        .maybeSingle(),
      this.client
        .from("activities")
        .select("id,activity_type,step_order")
        .eq("mission_id", mission.id)
        .eq("publication_status", "published"),
    ]);
    if (missionResult.error || activityResult.error) throw missionResult.error ?? activityResult.error;
    if (!missionResult.data) throw new Error("The reviewed mission has not been published to learning storage.");

    const publishedById = new Map(
      ((activityResult.data ?? []) as Row[]).map((row) => [row.id as string, row]),
    );
    for (const entry of plan.activities) {
      const row = publishedById.get(entry.activity.id);
      if (!row || row.activity_type !== entry.activity.type) {
        throw new Error("The reviewed activity set is missing or out of date in learning storage.");
      }
    }
  }

  async createSession(
    userId: string,
    plan: SessionPlanV1,
    { resumeIfAvailable = false, requestId }: SessionCreationOptions = {},
  ) {
    await this.assertPublishedMissionRowsForSession(plan);

    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const { data, error } = await this.client.rpc("create_or_resume_learning_session", {
      p_user_id: userId,
      p_session_id: id,
      p_mission_id: plan.missionId,
      p_plan_json: plan,
      p_mode: plan.mode,
      p_started_at: startedAt,
      p_resume_if_available: resumeIfAvailable,
      p_request_id: requestId ?? crypto.randomUUID(),
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("The session start did not return a learning session.");
    return sessionFromRow(row as Row);
  }

  async getSession(userId: string, sessionId: string) {
    const { data, error } = await this.client.from("sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return sessionFromRow(data as Row);
  }

  async getActiveSession(userId: string) {
    const { data, error } = await this.client
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return sessionFromRow(data as Row);
  }

  async getActiveSessions(userId: string) {
    const cutoff = new Date(Date.now() - RESUMABLE_SESSION_LOOKBACK_MS).toISOString();
    const { data, error } = await this.client
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .is("completed_at", null)
      .gte("started_at", cutoff)
      .order("started_at", { ascending: false })
      .limit(RESUMABLE_SESSION_LIMIT);

    if (error) throw error;
    return ((data ?? []) as Row[]).map(sessionFromRow);
  }

  async getSessionAttempts(userId: string, sessionId: string) {
    const { data, error } = await this.client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(activityAttemptFromRow);
  }

  async getRecentAttempts(userId: string, limit = 200) {
    const { data, error } = await this.client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Row[]).reverse().map(activityAttemptFromRow);
  }

  async getAttemptByRequestId(userId: string, requestId: string) {
    const { data, error } = await this.client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return activityAttemptFromRow(data as Row);
  }

  async recordSubmission(input: SubmissionInput): Promise<ActivityAttempt> {
    const createdAt = new Date().toISOString();
    const completed = input.completed ?? true;
    const evidenceKind = input.evidenceKind ?? inferEvidenceKind(input.activity.type);
    const correct = evidenceKind === "self-report" ? false : input.result.isCorrect;
    const contentItemId = input.activity.contentItemIds[0] ?? input.activity.id;
    const ruleId = input.result.ruleIds[0] ?? input.activity.grammarRuleIds[0] ?? input.activity.id;
    const reviewKey = `${input.userId}:${contentItemId}:${ruleId}`;
    const [patternResult, reviewResult] = await Promise.all([
      this.client
        .from("mistake_patterns")
        .select("*")
        .eq("user_id", input.userId)
        .eq("rule_id", ruleId)
        .maybeSingle(),
      this.client
        .from("review_items")
        .select("*")
        .eq("id", reviewKey)
        .eq("user_id", input.userId)
        .maybeSingle(),
    ]);
    if (patternResult.error || reviewResult.error) throw patternResult.error ?? reviewResult.error;
    const existingPattern = patternResult.data
      ? mistakePatternFromRow(patternResult.data as Row)
      : undefined;
    const existingReview = reviewResult.data
      ? reviewItemFromRow(reviewResult.data as Row)
      : undefined;
    const transition = transitionResponseState({
      userId: input.userId,
      activity: input.activity,
      result: input.result,
      completed,
      correct,
      evidenceKind,
      latencyMs: input.latencyMs,
      createdAt,
      contentItemId,
      ruleId,
      mistakePatternId: existingPattern?.id ?? crypto.randomUUID(),
      reviewId: reviewKey,
      existingPattern,
      existingReview,
    });
    const mistakeEvent = transition.recordMistakeEvent
      ? {
          content_item_id: contentItemId,
          rule_id: ruleId,
          corrected_answer: input.result.correctAnswer,
          mistake_type: input.result.mistakeType ?? "unknown",
          explanation: input.result.feedback,
        }
      : null;
    const mistakePattern = transition.mistakePattern
      ? {
          id: transition.mistakePattern.id,
          user_id: transition.mistakePattern.userId,
          rule_id: transition.mistakePattern.ruleId,
          mistake_type: transition.mistakePattern.mistakeType,
          corrected_answer: transition.mistakePattern.correctedAnswer,
          explanation: transition.mistakePattern.explanation,
          repeat_count: transition.mistakePattern.repeatCount,
          separate_production_successes: transition.mistakePattern.separateProductionSuccesses,
          resolved: transition.mistakePattern.resolved,
          expected_revision: existingPattern?.transitionRevision ?? 0,
        }
      : null;
    const reviewItem = transition.reviewItem
      ? {
          id: transition.reviewItem.id,
          user_id: transition.reviewItem.userId,
          content_item_id: transition.reviewItem.contentItemId,
          activity_id: transition.reviewItem.activityId,
          rule_id: transition.reviewItem.ruleId ?? null,
          prompt: transition.reviewItem.prompt,
          expected_answers: transition.reviewItem.expectedAnswers,
          stage: transition.reviewItem.stage,
          due_at: transition.reviewItem.dueAt,
          success_count: transition.reviewItem.successCount,
          failure_count: transition.reviewItem.failureCount,
          priority: transition.reviewItem.priority,
          expected_revision: existingReview?.transitionRevision ?? 0,
        }
      : null;

    const { data, error } = await this.client.rpc("submit_activity_attempt", {
      p_user_id: input.userId,
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
      p_expected_current_index: input.expectedCurrentIndex,
      p_activity_id: input.activity.id,
      p_submitted_answer: input.submittedAnswer,
      p_latency_ms: input.latencyMs,
      p_result_json: input.result,
      p_completed: completed,
      p_is_correct: correct,
      p_evidence_kind: evidenceKind,
      p_mistake_event: mistakeEvent,
      p_mistake_pattern: mistakePattern,
      p_review_item: reviewItem,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("The activity submission did not return a saved attempt.");
    return activityAttemptFromRow(row as Row);
  }

  async getProgress(userId: string): Promise<ProgressSnapshot> {
    const profile = await this.getProfile(userId);
    const mission = getSeedMission();
    const [attempts, reviews, mistakes] = await Promise.all([
      this.client.rpc("get_progress_attempt_signals", { p_user_id: userId }),
      this.getDueReviews(userId),
      this.client.rpc("get_progress_mistake_signals", { p_user_id: userId }),
    ]);
    if (attempts.error || mistakes.error) throw attempts.error ?? mistakes.error;

    return buildProgressSnapshot({
      profile,
      attempts: ((attempts.data ?? []) as Row[])
        .map((row) => {
          const activityId = row.activity_id as string;
          const activity = getScoredActivityById(activityId);
          return {
            activityId,
            isCorrect: Boolean(row.is_correct),
            activity,
            completed: (row.completed as boolean | undefined) ?? true,
            evidenceKind: (row.evidence_kind as ActivityAttempt["evidenceKind"]) ??
              (activity ? inferEvidenceKind(activity.type) : undefined),
            count: Number(row.attempt_count ?? 0),
          };
        }),
      reviews,
      mistakes: ((mistakes.data ?? []) as Row[]).map((row) => ({
        resolved: Boolean(row.resolved),
        count: Number(row.mistake_count ?? 0),
      })),
      missionTitle: mission.title,
      missionActivityCount: mission.activities.length,
    });
  }

  private async ensureSocialProfile(userId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error("Finish onboarding before using friends.");
    if (!profile.friendCode) return this.saveProfile({ ...profile, friendCode: generateFriendCode() });
    return profile;
  }

  private toSocialProfile(profile: LearnerProfile): SocialProfile {
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      currentLevel: profile.currentLevel,
      completedSessions: profile.completedSessions,
      currentStreak: profile.currentStreak,
    };
  }

  private async socialProfiles(userIds: string[]) {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return new Map<string, SocialProfile>();
    const batches = Array.from(
      { length: Math.ceil(ids.length / 100) },
      (_, index) => ids.slice(index * 100, (index + 1) * 100),
    );
    const results = await Promise.all(
      batches.map((batch) =>
        this.client
          .from("profiles")
          .select("id,display_name,current_level,completed_sessions,current_streak")
          .in("id", batch),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const rows = results.flatMap((result) => (result.data ?? []) as Row[]);
    return new Map(
      rows.map((row) => [
        row.id as string,
        {
          userId: row.id as string,
          displayName: (row.display_name as string) ?? "Learner",
          currentLevel: ((row.current_level as CefrLevel) ?? "A1"),
          completedSessions: (row.completed_sessions as number) ?? 0,
          currentStreak: (row.current_streak as number) ?? 0,
        },
      ]),
    );
  }

  private async blockedPairs(userId: string) {
    const { data, error } = await this.client
      .from("social_blocks")
      .select("blocker_user_id,blocked_user_id")
      .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(SOCIAL_BLOCK_LIMIT);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    return {
      ownBlockedUserIds: rows
        .filter((row) => row.blocker_user_id === userId)
        .map((row) => row.blocked_user_id as string),
      blockedEitherDirection: new Set(
        rows.flatMap((row) => [row.blocker_user_id as string, row.blocked_user_id as string]).filter((id) => id !== userId),
      ),
    };
  }

  async getSocialSnapshot(userId: string): Promise<SocialSnapshot> {
    const profile = await this.ensureSocialProfile(userId);
    const { ownBlockedUserIds, blockedEitherDirection } = await this.blockedPairs(userId);
    const [friendshipRows, incomingRequestRows, outgoingRequestRows, challengeRows] = await Promise.all([
      this.client
        .from("friendships")
        .select("*")
        .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(SOCIAL_FRIEND_LIMIT),
      this.client
        .from("friend_requests")
        .select("*")
        .eq("to_user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(SOCIAL_PENDING_REQUEST_LIMIT),
      this.client
        .from("friend_requests")
        .select("*")
        .eq("from_user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(SOCIAL_PENDING_REQUEST_LIMIT),
      this.client
        .from("coop_challenges")
        .select("*")
        .or(`created_by_user_id.eq.${userId},friend_user_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (
      friendshipRows.error ||
      incomingRequestRows.error ||
      outgoingRequestRows.error ||
      challengeRows.error
    ) {
      throw friendshipRows.error ??
        incomingRequestRows.error ??
        outgoingRequestRows.error ??
        challengeRows.error;
    }

    const friendships = ((friendshipRows.data ?? []) as Row[]).filter((row) => {
      const friendUserId = row.user_one_id === userId ? (row.user_two_id as string) : (row.user_one_id as string);
      return !blockedEitherDirection.has(friendUserId);
    });
    const requests = ([
      ...((incomingRequestRows.data ?? []) as Row[]),
      ...((outgoingRequestRows.data ?? []) as Row[]),
    ]).filter((row) => {
      const otherUserId = row.from_user_id === userId ? (row.to_user_id as string) : (row.from_user_id as string);
      return !blockedEitherDirection.has(otherUserId);
    });
    const visibleChallenges = ((challengeRows.data ?? []) as Row[]).filter((row) => {
      const friendUserId = row.created_by_user_id === userId ? (row.friend_user_id as string) : (row.created_by_user_id as string);
      return !blockedEitherDirection.has(friendUserId);
    });
    const challenge = visibleChallenges.find((row) => row.status === "active") ?? visibleChallenges[0];

    const profileIds = [
      ...friendships.flatMap((row) => [row.user_one_id as string, row.user_two_id as string]),
      ...requests.flatMap((row) => [row.from_user_id as string, row.to_user_id as string]),
      ...ownBlockedUserIds,
      ...(challenge ? [challenge.created_by_user_id as string, challenge.friend_user_id as string] : []),
    ];
    const profiles = await this.socialProfiles(profileIds);
    const fallbackProfile = this.toSocialProfile(profile);
    const getProfile = (id: string) => profiles.get(id) ?? (id === userId ? fallbackProfile : undefined);
    const getPendingProfile = (id: string) => {
      const candidate = getProfile(id);
      if (!candidate) throw new Error("The friend request profile could not be loaded.");
      return { userId: candidate.userId, displayName: candidate.displayName };
    };
    let activeChallenge: SocialSnapshot["activeChallenge"];

    if (challenge) {
      const friendUserId =
        challenge.created_by_user_id === userId ? (challenge.friend_user_id as string) : (challenge.created_by_user_id as string);
      const friend = getProfile(friendUserId);
      if (!friend) throw new Error("The challenge participant profile could not be loaded.");
      const startingSessions = (challenge.starting_sessions as Record<string, number>) ?? {};
      const yourStartingSessions = startingSessions[userId] ?? fallbackProfile.completedSessions;
      const friendStartingSessions = startingSessions[friendUserId] ?? friend.completedSessions;
      const progress = coopChallengeProgress({
        yourStartingSessions,
        friendStartingSessions,
        yourCompletedSessions: fallbackProfile.completedSessions,
        friendCompletedSessions: friend.completedSessions,
      });

      if (challenge.status === "active" && progress.combinedProgress >= ((challenge.target_sessions as number) ?? 3)) {
        const completedAt = new Date().toISOString();
        const { error: completionError } = await this.client
          .from("coop_challenges")
          .update({ status: "completed", completed_at: completedAt })
          .eq("id", challenge.id as string)
          .eq("status", "active");
        if (completionError) throw completionError;
        challenge.status = "completed";
        challenge.completed_at = completedAt;
      }

      activeChallenge = {
        id: challenge.id as string,
        friend,
        title: challenge.title as string,
        description: "Both learners complete focused sessions. The challenge rewards showing up, not competing on mistakes.",
        targetSessions: (challenge.target_sessions as number) ?? 3,
        yourStartingSessions,
        friendStartingSessions,
        ...progress,
        status: challenge.status as "active" | "completed",
        createdAt: challenge.created_at as string,
        completedAt: challenge.completed_at as string | undefined,
      };
    }

    const incomingRequests = requests
      .filter((row) => row.to_user_id === userId)
      .map((row) => ({
        id: row.id as string,
        from: getPendingProfile(row.from_user_id as string),
        status: row.status as "pending" | "accepted" | "declined",
        createdAt: row.created_at as string,
        respondedAt: row.responded_at as string | undefined,
      }));
    const outgoingRequests = requests
      .filter((row) => row.from_user_id === userId)
      .map((row) => ({
        id: row.id as string,
        to: { displayName: getPendingProfile(row.to_user_id as string).displayName },
        status: row.status as "pending" | "accepted" | "declined",
        createdAt: row.created_at as string,
        respondedAt: row.responded_at as string | undefined,
      }));

    return {
      profile: fallbackProfile,
      friendCode: profile.friendCode ?? generateFriendCode(),
      friends: friendships.map((row) => {
        const friendUserId = row.user_one_id === userId ? (row.user_two_id as string) : (row.user_one_id as string);
        return { id: row.id as string, friend: getProfile(friendUserId)!, createdAt: row.created_at as string };
      }),
      incomingRequests,
      outgoingRequests,
      blockedUserIds: ownBlockedUserIds,
      blockedUsers: ownBlockedUserIds.map((blockedUserId) => ({
        userId: blockedUserId,
        displayName: getProfile(blockedUserId)?.displayName ?? "Blocked learner",
      })),
      activeChallenge,
    };
  }

  async sendFriendRequestByCode(userId: string, friendCode: string) {
    await this.ensureSocialProfile(userId);
    const { error } = await this.client.rpc("send_friend_request_by_code", {
      p_user_id: userId,
      p_friend_code: friendCode,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async rotateFriendCode(userId: string, requestId: string) {
    const { error } = await this.client.rpc("rotate_friend_code", {
      p_user_id: userId,
      p_request_id: requestId,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async respondFriendRequest(userId: string, requestId: string, decision: "accepted" | "declined") {
    const { error } = await this.client.rpc("respond_friend_request", {
      p_user_id: userId,
      p_request_id: requestId,
      p_decision: decision,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async blockSocialUser(userId: string, targetUserId: string) {
    const { error } = await this.client.rpc("block_social_user", {
      p_user_id: userId,
      p_target_user_id: targetUserId,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async unblockSocialUser(userId: string, targetUserId: string) {
    const { error } = await this.client.rpc("unblock_social_user", {
      p_user_id: userId,
      p_target_user_id: targetUserId,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async reportSocialUser(
    userId: string,
    targetUserId: string,
    reason: string,
    details: string | undefined,
    requestId: string,
  ) {
    if (targetUserId === userId) throw new Error("You cannot report yourself.");
    const { error } = await this.client.rpc("report_social_user", {
      p_user_id: userId,
      p_target_user_id: targetUserId,
      p_request_id: requestId,
      p_reason: reason,
      p_details: details ?? null,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async startCoopChallenge(userId: string, friendUserId: string) {
    const { error } = await this.client.rpc("start_coop_challenge", {
      p_user_id: userId,
      p_friend_user_id: friendUserId,
      p_title: "Three-session co-op",
      p_target_sessions: 3,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async logTutorInteraction(input: { userId: string; contextPack: TutorContextPackV1; feedback: TutorFeedbackV1; provider: "fallback" | "openai" }) {
    const { error } = await this.client.from("ai_interactions").upsert({
      id: input.contextPack.attemptId, user_id: input.userId, interaction_type: input.contextPack.task,
      attempt_id: input.contextPack.attemptId,
      context_pack_summary: { sessionId: input.contextPack.sessionId, activityId: input.contextPack.activity.id, sourceIds: input.contextPack.allowedSourceIds, ruleIds: input.contextPack.ruleNotes.map((note) => note.id) },
      response_summary: input.feedback, provider: input.provider, created_at: new Date().toISOString(),
    }, { onConflict: "user_id,attempt_id" });
    if (error) throw error;
  }

  async claimTutorInteraction(userId: string, contextPack: TutorContextPackV1) {
    const { data, error } = await this.client.rpc("claim_tutor_interaction", {
      p_user_id: userId,
      p_attempt_id: contextPack.attemptId,
      p_interaction_type: contextPack.task,
      p_context_pack_summary: {
        sessionId: contextPack.sessionId,
        activityId: contextPack.activity.id,
        sourceIds: contextPack.allowedSourceIds,
        ruleIds: contextPack.ruleNotes.map((note) => note.id),
      },
    });
    if (error) throw error;
    return data === true;
  }

  async getTutorInteractionForAttempt(userId: string, attemptId: string) {
    const { data, error } = await this.client
      .from("ai_interactions")
      .select("response_summary,provider")
      .eq("user_id", userId)
      .eq("attempt_id", attemptId)
      .neq("provider", "pending")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      feedback: data.response_summary as TutorFeedbackV1,
      provider: data.provider as "fallback" | "openai",
    };
  }

  async countTutorInteractionsSince(userId: string, since: string) {
    const { count, error } = await this.client
      .from("ai_interactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  }

  async consumeRateLimit(
    userId: string,
    action: string,
    options: { limit: number; windowSeconds: number },
    requestId?: string,
  ) {
    const { data, error } = await this.client.rpc("consume_api_quota", {
      p_user_id: userId,
      p_action: action,
      p_window_seconds: options.windowSeconds,
      p_limit: options.limit,
      p_request_id: requestId ?? null,
    });
    if (error) throw error;
    return data === true;
  }

  private async selectAllBy(
    table: string,
    column: string,
    value: string,
    options: ExportPageOptions,
  ): Promise<Row[]> {
    const pageSize = 500;
    const rows: Row[] = [];
    let afterKey: string | number | undefined;

    for (;;) {
      let query = this.client
        .from(table)
        .select("*")
        .eq(column, value)
        .lte(options.cutoffColumn, options.cutoff)
        .order(options.orderBy, { ascending: true })
        .limit(pageSize);
      if (afterKey !== undefined) query = query.gt(options.orderBy, afterKey);

      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as Row[];
      rows.push(...page);
      if (page.length < pageSize) return rows;

      const nextKey = page.at(-1)?.[options.orderBy];
      if (typeof nextKey !== "string" && typeof nextKey !== "number") {
        throw new Error(`Cannot paginate ${table}: ${options.orderBy} is not a stable scalar key.`);
      }
      afterKey = nextKey;
    }
  }

  private async selectAllEither(table: string, filter: string, options: ExportPageOptions): Promise<Row[]> {
    const pageSize = 500;
    const rows: Row[] = [];
    let afterKey: string | number | undefined;

    for (;;) {
      let query = this.client
        .from(table)
        .select("*")
        .or(filter)
        .lte(options.cutoffColumn, options.cutoff)
        .order(options.orderBy, { ascending: true })
        .limit(pageSize);
      if (afterKey !== undefined) query = query.gt(options.orderBy, afterKey);

      const { data, error } = await query;
      if (error) throw error;
      const page = (data ?? []) as Row[];
      rows.push(...page);
      if (page.length < pageSize) return rows;

      const nextKey = page.at(-1)?.[options.orderBy];
      if (typeof nextKey !== "string" && typeof nextKey !== "number") {
        throw new Error(`Cannot paginate ${table}: ${options.orderBy} is not a stable scalar key.`);
      }
      afterKey = nextKey;
    }
  }

  async exportLearnerData(userId: string) {
    const { data: cutoff, error: cutoffError } = await this.client.rpc("get_learner_export_cutoff");
    if (cutoffError) throw cutoffError;
    if (typeof cutoff !== "string" || Number.isNaN(Date.parse(cutoff))) {
      throw new Error("The database returned an invalid privacy export cutoff.");
    }
    const exportCutoff = cutoff;
    const atCutoff = (orderBy: string, cutoffColumn: string): ExportPageOptions => ({
      orderBy,
      cutoffColumn,
      cutoff: exportCutoff,
    });
    const [
      profile,
      authAccount,
      sessions,
      sessionStartRequests,
      attempts,
      reviews,
      mistakes,
      mistakeEvents,
      privacyConsents,
      aiInteractions,
      friendRequests,
      friendshipsOne,
      friendshipsTwo,
      socialBlocks,
      socialReports,
      challengesCreated,
      challengesJoined,
      streakEvents,
      rewards,
      aiSessionSummaries,
      contentVersions,
      friendCodeRotationRequests,
      rateLimitEvents,
    ] = await Promise.all([
      this.getProfile(userId),
      this.client.auth.admin.getUserById(userId),
      this.selectAllBy("sessions", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy(
        "session_start_requests",
        "user_id",
        userId,
        atCutoff("request_id", "created_at"),
      ),
      this.selectAllBy("activity_attempts", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("review_items", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("mistake_patterns", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("mistake_events", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("privacy_consents", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("ai_interactions", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllEither(
        "friend_requests",
        `from_user_id.eq.${userId},to_user_id.eq.${userId}`,
        atCutoff("id", "created_at"),
      ),
      this.selectAllBy("friendships", "user_one_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("friendships", "user_two_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("social_blocks", "blocker_user_id", userId, atCutoff("blocked_user_id", "created_at")),
      this.selectAllBy("social_reports", "reporter_user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("coop_challenges", "created_by_user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("coop_challenges", "friend_user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("streak_events", "user_id", userId, atCutoff("id", "occurred_at")),
      this.selectAllBy("rewards", "user_id", userId, atCutoff("id", "earned_at")),
      this.selectAllBy("ai_session_summaries", "user_id", userId, atCutoff("id", "created_at")),
      this.selectAllBy("content_versions", "created_by", userId, atCutoff("id", "created_at")),
      this.selectAllBy(
        "friend_code_rotation_requests",
        "user_id",
        userId,
        atCutoff("request_id", "created_at"),
      ),
      this.selectAllBy("api_rate_events", "user_id", userId, atCutoff("id", "created_at")),
    ]);
    if (authAccount.error) throw authAccount.error;
    const account = authAccount.data.user;

    return {
      exportedAt: exportCutoff,
      account: {
        id: account.id,
        email: account.email,
        emailConfirmedAt: account.email_confirmed_at,
        createdAt: account.created_at,
        lastSignInAt: account.last_sign_in_at,
      },
      profile,
      sessions,
      sessionStartRequests,
      attempts,
      reviews,
      mistakes,
      mistakeEvents,
      privacyConsents,
      tutorInteractions: aiInteractions,
      friendRequests,
      friendships: [...friendshipsOne, ...friendshipsTwo],
      socialBlocks,
      socialReports,
      coopChallenges: [...challengesCreated, ...challengesJoined],
      streakEvents,
      rewards,
      aiSessionSummaries,
      contentVersions,
      friendCodeRotationRequests,
      rateLimitEvents,
      retentionNotice:
        "Rate-limit and abuse-prevention events may remain for up to eight days. Limited blocks and moderation reports may be retained after learner-data deletion to protect other learners and preserve safety investigations. For authorised content editors, restricted version attribution remains with editorial history and is anonymised if the sign-in account is deleted.",
    };
  }

  async deleteLearnerData(userId: string) {
    // Profile-owned learner and social rows use ON DELETE CASCADE, so this is
    // one atomic database statement. Safety records and short-lived quota
    // events reference auth.users directly and intentionally survive.
    const { error } = await this.client.from("profiles").delete().eq("id", userId);
    if (error) throw error;
  }
}


