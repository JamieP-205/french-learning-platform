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
  SocialProfile,
  SocialSnapshot,
  TutorContextPackV1,
  TutorFeedbackV1,
  ValidationResultV1,
} from "@/lib/domain/types";
import type { LearningRepository, SubmissionInput } from "@/lib/data/repository";
import { advanceStreak } from "@/lib/learning/streak";
import { buildProgressSnapshot } from "@/lib/learning/progress-summary";
import {
  inferEvidenceKind,
  isQualifyingSessionEvidence,
  transitionResponseState,
} from "@/lib/learning/response-transition";
import { friendCodeForUser, normalizeFriendCode } from "@/lib/social/friend-code";

const requiredEnvironment = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server configuration is incomplete.");
  return { url, serviceKey };
};

type Row = Record<string, unknown>;

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
      friendCode: (row.friend_code as string | undefined) ?? friendCodeForUser(row.id as string),
      currentLevel: ((row.current_level as CefrLevel) ?? "A1"),
      learningGoals: (row.learning_goals as string[]) ?? [],
      interests: (row.interests as string[]) ?? [],
      dailyMinutes: (row.daily_minutes as number) ?? 8,
      preferredMode: (row.preferred_mode as "normal" | "short") ?? "normal",
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
    const { error } = await this.client.from("profiles").upsert({
      id: profile.userId,
      display_name: profile.displayName,
      friend_code: profile.friendCode ?? friendCodeForUser(profile.userId),
      current_level: profile.currentLevel,
      learning_goals: profile.learningGoals,
      interests: profile.interests,
      daily_minutes: profile.dailyMinutes,
      preferred_mode: profile.preferredMode,
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
    return profile;
  }

  async recordRequiredPrivacyConsents(userId: string, policyVersion: string) {
    const { error } = await this.client.from("privacy_consents").insert(
      ["terms", "privacy", "ai_tutor"].map((consentType) => ({
        user_id: userId,
        consent_type: consentType,
        policy_version: policyVersion,
        granted: true,
      })),
    );
    if (error) throw error;
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
      .eq("publication_status", "published");
    if (contentError) throw contentError;
    if (!contentRows || contentRows.length !== contentItemIds.length) {
      throw new Error("A published activity refers to missing or unpublished canonical content.");
    }
    const sourceIds = [...new Set(contentRows.flatMap((row) => (row.source_ids as string[]) ?? []))];
    const { data: sourceRows, error: sourceError } = await this.client.from("content_sources").select("*").in("id", sourceIds);
    if (sourceError) throw sourceError;
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
        verificationStatus: "source_validated" as const,
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
    const { data, error } = await this.client.from("review_items").select("*").eq("user_id", userId).order("due_at");
    if (error) throw error;
    return (data ?? []).map((value) => {
      const row = value as Row;
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
      };
    });
  }

  async getOpenMistakes(userId: string) {
    const { data, error } = await this.client.from("mistake_patterns").select("*").eq("user_id", userId).eq("resolved", false);
    if (error) throw error;
    return (data ?? []).map((value) => mistakePatternFromRow(value as Row));
  }

  private async ensureMissionRowsForSession(plan: SessionPlanV1) {
    const slug = plan.missionId.replace(/^mission-/, "").replace(/-v\d+$/, "");
    const title = slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

    const { error: missionError } = await this.client.from("missions").upsert(
      {
        id: plan.missionId,
        slug,
        title,
        description: plan.weakFocus || title,
        outcome: plan.completionReward || title,
        estimated_minutes: plan.estimatedMinutes,
        cefr_level: "A1",
        publication_status: "published",
      },
      { onConflict: "id" },
    );

    if (missionError) throw missionError;

    const activities = plan.activities.map((planned, index) => ({
      id: planned.activity.id,
      mission_id: plan.missionId,
      step_order: index + 1,
      payload: planned.activity,
      publication_status: "published",
    }));

    if (activities.length > 0) {
      const { error: activitiesError } = await this.client.from("activities").upsert(activities, { onConflict: "id" });
      if (activitiesError) throw activitiesError;
    }
  }

  async createSession(userId: string, plan: SessionPlanV1) {
    await this.ensureMissionRowsForSession(plan);

    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const { error } = await this.client.from("sessions").insert({
      id,
      user_id: userId,
      mission_id: plan.missionId,
      plan_json: plan,
      mode: plan.mode,
      started_at: startedAt,
      current_index: 0,
    });
    if (error) throw error;
    return { id, userId, plan, startedAt, currentIndex: 0 };
  }

  async getSession(userId: string, sessionId: string) {
    const { data, error } = await this.client.from("sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as Row;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      plan: row.plan_json as SessionPlanV1,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      currentIndex: row.current_index as number,
    };
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
    const row = data as Row;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      plan: row.plan_json as SessionPlanV1,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      currentIndex: row.current_index as number,
    };
  }

  async getRecentAttempts(userId: string, limit = 200) {
    const { data, error } = await this.client
      .from("activity_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Row[]).reverse().map((row) => ({
      id: row.id as string,
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
    }));
  }

  async recordSubmission(input: SubmissionInput): Promise<ActivityAttempt> {
    const createdAt = new Date().toISOString();
    const completed = input.completed ?? true;
    const evidenceKind = input.evidenceKind ?? inferEvidenceKind(input.activity.type);
    const correct = evidenceKind === "self-report" ? false : input.result.isCorrect;
    const attempt: ActivityAttempt = {
      id: crypto.randomUUID(),
      userId: input.userId,
      sessionId: input.sessionId,
      activityId: input.activity.id,
      submittedAnswer: input.submittedAnswer,
      latencyMs: input.latencyMs,
      completed,
      correct,
      evidenceKind,
      result: input.result,
      createdAt,
    };
    const { error: attemptError } = await this.client.from("activity_attempts").insert({
      id: attempt.id,
      user_id: input.userId,
      session_id: input.sessionId,
      activity_id: input.activity.id,
      submitted_answer: input.submittedAnswer,
      latency_ms: input.latencyMs,
      completed,
      evidence_kind: evidenceKind,
      result_json: input.result,
      is_correct: correct,
      created_at: createdAt,
    });
    if (attemptError) throw attemptError;

    const contentItemId = input.activity.contentItemIds[0] ?? input.activity.id;
    const ruleId = input.result.ruleIds[0] ?? input.activity.grammarRuleIds[0] ?? input.activity.id;
    const reviewKey = `${input.userId}:${contentItemId}:${ruleId}`;
    const { data: patternData, error: patternError } = await this.client
      .from("mistake_patterns")
      .select("*")
      .eq("user_id", input.userId)
      .eq("rule_id", ruleId)
      .maybeSingle();
    if (patternError) throw patternError;
    const existingPattern = patternData ? mistakePatternFromRow(patternData as Row) : undefined;
    const existingReview = (await this.getDueReviews(input.userId)).find((review) => review.id === reviewKey);
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

    if (transition.recordMistakeEvent) {
      const { error: mistakeEventError } = await this.client.from("mistake_events").insert({
        id: crypto.randomUUID(), user_id: input.userId, session_id: input.sessionId, activity_id: input.activity.id,
        content_item_id: contentItemId, rule_id: ruleId, submitted_answer: input.submittedAnswer,
        corrected_answer: input.result.correctAnswer, mistake_type: input.result.mistakeType ?? "unknown",
        explanation: input.result.feedback, created_at: createdAt,
      });
      if (mistakeEventError) throw mistakeEventError;
    }
    if (transition.mistakePattern) {
      const pattern = transition.mistakePattern;
      const { error } = await this.client.from("mistake_patterns").upsert({
        id: pattern.id,
        user_id: pattern.userId,
        rule_id: pattern.ruleId,
        mistake_type: pattern.mistakeType,
        corrected_answer: pattern.correctedAnswer,
        explanation: pattern.explanation,
        repeat_count: pattern.repeatCount,
        separate_production_successes: pattern.separateProductionSuccesses,
        resolved: pattern.resolved,
        last_seen_at: pattern.lastSeenAt,
      }, { onConflict: "user_id,rule_id" });
      if (error) throw error;
    }
    if (transition.reviewItem) {
      const review = transition.reviewItem;
      const { error: reviewError } = await this.client.from("review_items").upsert({
        id: review.id, user_id: review.userId, content_item_id: review.contentItemId, activity_id: review.activityId,
        rule_id: review.ruleId ?? null, prompt: review.prompt, expected_answers: review.expectedAnswers, stage: review.stage,
        due_at: review.dueAt, success_count: review.successCount, failure_count: review.failureCount, priority: review.priority,
      });
      if (reviewError) throw reviewError;
    }

    const session = await this.getSession(input.userId, input.sessionId);
    if (session && completed) {
      const currentIndex = Math.min(session.currentIndex + 1, session.plan.activities.length);
      const completedAt = currentIndex >= session.plan.activities.length ? createdAt : null;
      const { error } = await this.client.from("sessions").update({ current_index: currentIndex, completed_at: completedAt }).eq("id", session.id);
      if (error) throw error;
      if (completedAt) {
        const recentAttempts = await this.getRecentAttempts(input.userId);
        const hasQualifyingSessionEvidence = recentAttempts.some(
          (candidate) => candidate.sessionId === session.id && isQualifyingSessionEvidence({
            completed: candidate.completed ?? true,
            correct: candidate.correct ?? candidate.result.isCorrect,
            evidenceKind: candidate.evidenceKind ?? "controlled",
          }),
        );
        const profile = await this.getProfile(input.userId);
        if (profile && evidenceKind !== "self-report" && hasQualifyingSessionEvidence) {
          const streak = advanceStreak({
            currentStreak: profile.currentStreak,
            streakFreezes: profile.streakFreezes ?? 0,
            lastCompletedAt: profile.lastCompletedAt,
          });
          await this.saveProfile({
            ...profile,
            lastCompletedAt: streak.lastCompletedAt,
            completedSessions: profile.completedSessions + 1,
            currentStreak: streak.currentStreak,
            streakFreezes: streak.streakFreezes,
          });
        }
      }
    }
    return attempt;
  }

  async getProgress(userId: string): Promise<ProgressSnapshot> {
    const profile = await this.getProfile(userId);
    const mission = getSeedMission();
    const [attempts, reviews, mistakes] = await Promise.all([
      this.client.from("activity_attempts").select("activity_id,is_correct,completed,evidence_kind").eq("user_id", userId),
      this.getDueReviews(userId),
      this.client.from("mistake_patterns").select("resolved").eq("user_id", userId),
    ]);
    if (attempts.error || mistakes.error) throw attempts.error ?? mistakes.error;

    return buildProgressSnapshot({
      profile,
      attempts: (attempts.data ?? [])
        .filter((row) => ((row.completed as boolean | undefined) ?? true) && row.evidence_kind !== "self-report")
        .map((row) => ({
          activityId: row.activity_id as string,
          isCorrect: Boolean(row.is_correct),
        })),
      reviews,
      mistakes: (mistakes.data ?? []).map((row) => ({
        resolved: Boolean(row.resolved),
      })),
      missionTitle: mission.title,
      missionActivityCount: mission.activities.length,
    });
  }

  private async ensureSocialProfile(userId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) throw new Error("Finish onboarding before using friends.");
    if (!profile.friendCode) return this.saveProfile({ ...profile, friendCode: friendCodeForUser(userId) });
    return profile;
  }

  private toSocialProfile(profile: LearnerProfile): SocialProfile {
    return {
      userId: profile.userId,
      displayName: profile.displayName,
      friendCode: profile.friendCode,
      currentLevel: profile.currentLevel,
      completedSessions: profile.completedSessions,
      currentStreak: profile.currentStreak,
    };
  }

  private friendshipPair(userId: string, friendUserId: string) {
    const [userOne, userTwo] = [userId, friendUserId].sort();
    return { userOne, userTwo };
  }

  private async socialProfiles(userIds: string[]) {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return new Map<string, SocialProfile>();
    const { data, error } = await this.client
      .from("profiles")
      .select("id,display_name,friend_code,current_level,completed_sessions,current_streak")
      .in("id", ids);
    if (error) throw error;
    return new Map(
      ((data ?? []) as Row[]).map((row) => [
        row.id as string,
        {
          userId: row.id as string,
          displayName: (row.display_name as string) ?? "Learner",
          friendCode: (row.friend_code as string | undefined) ?? friendCodeForUser(row.id as string),
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
      .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`);
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

  private async hasSocialBlock(userId: string, targetUserId: string) {
    const { data, error } = await this.client
      .from("social_blocks")
      .select("blocker_user_id")
      .or(
        `and(blocker_user_id.eq.${userId},blocked_user_id.eq.${targetUserId}),and(blocker_user_id.eq.${targetUserId},blocked_user_id.eq.${userId})`,
      )
      .limit(1);
    if (error) throw error;
    return Boolean(data?.length);
  }

  async getSocialSnapshot(userId: string): Promise<SocialSnapshot> {
    const profile = await this.ensureSocialProfile(userId);
    const { ownBlockedUserIds, blockedEitherDirection } = await this.blockedPairs(userId);
    const [friendshipRows, requestRows, challengeRows] = await Promise.all([
      this.client
        .from("friendships")
        .select("*")
        .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
      this.client
        .from("friend_requests")
        .select("*")
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      this.client
        .from("coop_challenges")
        .select("*")
        .or(`created_by_user_id.eq.${userId},friend_user_id.eq.${userId}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (friendshipRows.error || requestRows.error || challengeRows.error) {
      throw friendshipRows.error ?? requestRows.error ?? challengeRows.error;
    }

    const friendships = ((friendshipRows.data ?? []) as Row[]).filter((row) => {
      const friendUserId = row.user_one_id === userId ? (row.user_two_id as string) : (row.user_one_id as string);
      return !blockedEitherDirection.has(friendUserId);
    });
    const requests = ((requestRows.data ?? []) as Row[]).filter((row) => {
      const otherUserId = row.from_user_id === userId ? (row.to_user_id as string) : (row.from_user_id as string);
      return !blockedEitherDirection.has(otherUserId);
    });
    const challenge = ((challengeRows.data ?? []) as Row[]).find((row) => {
      const friendUserId = row.created_by_user_id === userId ? (row.friend_user_id as string) : (row.created_by_user_id as string);
      return !blockedEitherDirection.has(friendUserId);
    });

    const profileIds = [
      ...friendships.flatMap((row) => [row.user_one_id as string, row.user_two_id as string]),
      ...requests.flatMap((row) => [row.from_user_id as string, row.to_user_id as string]),
      ...(challenge ? [challenge.created_by_user_id as string, challenge.friend_user_id as string] : []),
    ];
    const profiles = await this.socialProfiles(profileIds);
    const fallbackProfile = this.toSocialProfile(profile);
    const getProfile = (id: string) => profiles.get(id) ?? (id === userId ? fallbackProfile : undefined);

    const incomingRequests = requests
      .filter((row) => row.to_user_id === userId)
      .map((row) => ({
        id: row.id as string,
        from: getProfile(row.from_user_id as string)!,
        to: getProfile(row.to_user_id as string)!,
        status: row.status as "pending" | "accepted" | "declined",
        createdAt: row.created_at as string,
        respondedAt: row.responded_at as string | undefined,
      }));
    const outgoingRequests = requests
      .filter((row) => row.from_user_id === userId)
      .map((row) => ({
        id: row.id as string,
        from: getProfile(row.from_user_id as string)!,
        to: getProfile(row.to_user_id as string)!,
        status: row.status as "pending" | "accepted" | "declined",
        createdAt: row.created_at as string,
        respondedAt: row.responded_at as string | undefined,
      }));

    return {
      profile: fallbackProfile,
      friendCode: fallbackProfile.friendCode ?? friendCodeForUser(userId),
      friends: friendships.map((row) => {
        const friendUserId = row.user_one_id === userId ? (row.user_two_id as string) : (row.user_one_id as string);
        return { id: row.id as string, friend: getProfile(friendUserId)!, createdAt: row.created_at as string };
      }),
      incomingRequests,
      outgoingRequests,
      blockedUserIds: ownBlockedUserIds,
      activeChallenge: challenge
        ? {
            id: challenge.id as string,
            friend: getProfile(challenge.created_by_user_id === userId ? (challenge.friend_user_id as string) : (challenge.created_by_user_id as string))!,
            title: challenge.title as string,
            description: "Both learners complete focused sessions. The challenge rewards showing up, not competing on mistakes.",
            targetSessions: (challenge.target_sessions as number) ?? 3,
            yourStartingSessions: ((challenge.starting_sessions as Record<string, number>) ?? {})[userId] ?? 0,
            friendStartingSessions:
              ((challenge.starting_sessions as Record<string, number>) ?? {})[
                challenge.created_by_user_id === userId ? (challenge.friend_user_id as string) : (challenge.created_by_user_id as string)
              ] ?? 0,
            status: challenge.status as "active" | "completed",
            createdAt: challenge.created_at as string,
            completedAt: challenge.completed_at as string | undefined,
          }
        : undefined,
    };
  }

  async sendFriendRequestByCode(userId: string, friendCode: string) {
    await this.ensureSocialProfile(userId);
    const normalizedCode = normalizeFriendCode(friendCode);
    const { data, error } = await this.client.from("profiles").select("id").eq("friend_code", normalizedCode).maybeSingle();
    if (error) throw error;
    const targetUserId = (data as Row | null)?.id as string | undefined;
    if (!targetUserId || targetUserId === userId) throw new Error("That friend code could not be added.");
    if (await this.hasSocialBlock(userId, targetUserId)) throw new Error("This learner cannot be added.");
    const { userOne, userTwo } = this.friendshipPair(userId, targetUserId);
    const { data: existingFriendship, error: friendshipError } = await this.client
      .from("friendships")
      .select("id")
      .eq("user_one_id", userOne)
      .eq("user_two_id", userTwo)
      .maybeSingle();
    if (friendshipError) throw friendshipError;
    if (!existingFriendship) {
      const { error: requestError } = await this.client.from("friend_requests").upsert(
        {
          from_user_id: userId,
          to_user_id: targetUserId,
          status: "pending",
          responded_at: null,
        },
        { onConflict: "from_user_id,to_user_id" },
      );
      if (requestError) throw requestError;
    }
    return this.getSocialSnapshot(userId);
  }

  async respondFriendRequest(userId: string, requestId: string, decision: "accepted" | "declined") {
    const { data, error } = await this.client.from("friend_requests").select("*").eq("id", requestId).maybeSingle();
    if (error) throw error;
    const request = data as Row | null;
    if (!request || request.to_user_id !== userId || request.status !== "pending") throw new Error("That friend request is not available.");
    const respondedAt = new Date().toISOString();
    const { error: updateError } = await this.client
      .from("friend_requests")
      .update({ status: decision, responded_at: respondedAt })
      .eq("id", requestId);
    if (updateError) throw updateError;
    if (decision === "accepted" && !(await this.hasSocialBlock(request.from_user_id as string, request.to_user_id as string))) {
      const { userOne, userTwo } = this.friendshipPair(request.from_user_id as string, request.to_user_id as string);
      const { error: friendshipError } = await this.client.from("friendships").upsert(
        {
          user_one_id: userOne,
          user_two_id: userTwo,
          created_at: respondedAt,
        },
        { onConflict: "user_one_id,user_two_id" },
      );
      if (friendshipError) throw friendshipError;
    }
    return this.getSocialSnapshot(userId);
  }

  async blockSocialUser(userId: string, targetUserId: string) {
    if (targetUserId === userId) throw new Error("You cannot block yourself.");
    const { userOne, userTwo } = this.friendshipPair(userId, targetUserId);
    const { error: blockError } = await this.client.from("social_blocks").upsert({
      blocker_user_id: userId,
      blocked_user_id: targetUserId,
    });
    if (blockError) throw blockError;
    await Promise.all([
      this.client.from("friendships").delete().eq("user_one_id", userOne).eq("user_two_id", userTwo),
      this.client.from("friend_requests").delete().eq("from_user_id", userId).eq("to_user_id", targetUserId),
      this.client.from("friend_requests").delete().eq("from_user_id", targetUserId).eq("to_user_id", userId),
      this.client.from("coop_challenges").update({ status: "completed", completed_at: new Date().toISOString() }).eq("created_by_user_id", userId).eq("friend_user_id", targetUserId),
      this.client.from("coop_challenges").update({ status: "completed", completed_at: new Date().toISOString() }).eq("created_by_user_id", targetUserId).eq("friend_user_id", userId),
    ]);
    return this.getSocialSnapshot(userId);
  }

  async reportSocialUser(userId: string, targetUserId: string, reason: string, details?: string) {
    if (targetUserId === userId) throw new Error("You cannot report yourself.");
    const { error } = await this.client.from("social_reports").insert({
      reporter_user_id: userId,
      reported_user_id: targetUserId,
      reason,
      details: details ?? null,
    });
    if (error) throw error;
    return this.getSocialSnapshot(userId);
  }

  async startCoopChallenge(userId: string, friendUserId: string) {
    const profile = await this.ensureSocialProfile(userId);
    const friend = await this.ensureSocialProfile(friendUserId);
    const { userOne, userTwo } = this.friendshipPair(userId, friendUserId);
    const { data: friendship, error: friendshipError } = await this.client
      .from("friendships")
      .select("id")
      .eq("user_one_id", userOne)
      .eq("user_two_id", userTwo)
      .maybeSingle();
    if (friendshipError) throw friendshipError;
    if (!friendship) throw new Error("Add this learner as a friend before starting a challenge.");
    const { data: existing, error: existingError } = await this.client
      .from("coop_challenges")
      .select("id")
      .or(`and(created_by_user_id.eq.${userId},friend_user_id.eq.${friendUserId}),and(created_by_user_id.eq.${friendUserId},friend_user_id.eq.${userId})`)
      .eq("status", "active")
      .limit(1);
    if (existingError) throw existingError;
    if (!existing?.length) {
      const { error } = await this.client.from("coop_challenges").insert({
        created_by_user_id: userId,
        friend_user_id: friendUserId,
        title: "Three-session co-op",
        target_sessions: 3,
        starting_sessions: {
          [userId]: profile.completedSessions,
          [friendUserId]: friend.completedSessions,
        },
      });
      if (error) throw error;
    }
    return this.getSocialSnapshot(userId);
  }

  async logTutorInteraction(input: { userId: string; contextPack: TutorContextPackV1; feedback: TutorFeedbackV1; provider: "fallback" | "openai" }) {
    const { error } = await this.client.from("ai_interactions").insert({
      id: crypto.randomUUID(), user_id: input.userId, interaction_type: input.contextPack.task,
      context_pack_summary: { activityId: input.contextPack.activity.id, sourceIds: input.contextPack.allowedSourceIds, ruleIds: input.contextPack.ruleNotes.map((note) => note.id) },
      response_summary: input.feedback, provider: input.provider, created_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async exportLearnerData(userId: string) {
    const [profile, sessions, attempts, reviews, mistakes, privacyConsents, friendRequests, friendshipsOne, friendshipsTwo, socialBlocks, socialReports, challengesCreated, challengesJoined] = await Promise.all([
      this.getProfile(userId),
      this.client.from("sessions").select("*").eq("user_id", userId),
      this.client.from("activity_attempts").select("*").eq("user_id", userId),
      this.getDueReviews(userId),
      this.client.from("mistake_patterns").select("*").eq("user_id", userId),
      this.client.from("privacy_consents").select("*").eq("user_id", userId),
      this.client.from("friend_requests").select("*").or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
      this.client.from("friendships").select("*").eq("user_one_id", userId),
      this.client.from("friendships").select("*").eq("user_two_id", userId),
      this.client.from("social_blocks").select("*").or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`),
      this.client.from("social_reports").select("*").or(`reporter_user_id.eq.${userId},reported_user_id.eq.${userId}`),
      this.client.from("coop_challenges").select("*").eq("created_by_user_id", userId),
      this.client.from("coop_challenges").select("*").eq("friend_user_id", userId),
    ]);
    return {
      profile,
      sessions: sessions.data ?? [],
      attempts: attempts.data ?? [],
      reviews,
      mistakes: mistakes.data ?? [],
      privacyConsents: privacyConsents.data ?? [],
      friendRequests: friendRequests.data ?? [],
      friendships: [...(friendshipsOne.data ?? []), ...(friendshipsTwo.data ?? [])],
      socialBlocks: socialBlocks.data ?? [],
      socialReports: socialReports.data ?? [],
      coopChallenges: [...(challengesCreated.data ?? []), ...(challengesJoined.data ?? [])],
    };
  }

  async deleteLearnerData(userId: string) {
    const tables: { table: string; column: string }[] = [
      { table: "ai_interactions", column: "user_id" }, { table: "activity_attempts", column: "user_id" },
      { table: "mistake_events", column: "user_id" }, { table: "mistake_patterns", column: "user_id" },
      { table: "review_items", column: "user_id" }, { table: "sessions", column: "user_id" },
      { table: "privacy_consents", column: "user_id" },
      { table: "friend_requests", column: "from_user_id" }, { table: "friend_requests", column: "to_user_id" },
      { table: "friendships", column: "user_one_id" }, { table: "friendships", column: "user_two_id" },
      { table: "social_blocks", column: "blocker_user_id" }, { table: "social_blocks", column: "blocked_user_id" },
      { table: "social_reports", column: "reporter_user_id" }, { table: "social_reports", column: "reported_user_id" },
      { table: "coop_challenges", column: "created_by_user_id" }, { table: "coop_challenges", column: "friend_user_id" },
      { table: "profiles", column: "id" },
    ];
    for (const { table, column } of tables) {
      const { error } = await this.client.from(table).delete().eq(column, userId);
      if (error) throw error;
    }
  }
}


