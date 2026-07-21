import { getSeedMission } from "@/lib/content/seed";
import { getScoredActivityById } from "@/lib/content/scored-missions";
import type {
  ActivityAttempt,
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
} from "@/lib/domain/types";
import type {
  LearningRepository,
  ProfilePreferenceChanges,
  SessionCreationOptions,
  SubmissionInput,
} from "@/lib/data/repository";
import { buildProgressSnapshot } from "@/lib/learning/progress-summary";
import {
  inferEvidenceKind,
  hasSessionCompletionCredit,
  transitionResponseState,
} from "@/lib/learning/response-transition";
import { advanceStreak } from "@/lib/learning/streak";
import { generateFriendCode, normalizeFriendCode } from "@/lib/social/friend-code";
import { coopChallengeProgress, isFriendRequestRetryCoolingDown } from "@/lib/social/integrity";
import {
  DEFAULT_TIME_ZONE,
  isSameCalendarDay,
  normalizeIanaTimeZone,
} from "@/lib/time/calendar-day";

const DEMO_USER_ID = "demo-learner";
const RESUMABLE_SESSION_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const RESUMABLE_SESSION_LIMIT = 50;
const SOCIAL_FRIEND_LIMIT = 200;
const SOCIAL_PENDING_REQUEST_LIMIT = 100;
const SOCIAL_BLOCK_LIMIT = 500;
const LEARNING_SIGNAL_LIMIT = 200;

type Store = {
  profiles: Map<string, LearnerProfile>;
  sessions: Map<string, SessionRecord>;
  sessionStartRequests: Map<string, {
    userId: string;
    requestId: string;
    sessionId: string;
    createdAt: string;
  }>;
  reviews: Map<string, ReviewItem>;
  mistakes: Map<string, MistakePattern>;
  attempts: ActivityAttempt[];
  privacyConsents: { userId: string; consentType: "terms" | "privacy" | "ai_tutor"; policyVersion: string; granted: boolean; createdAt: string }[];
  tutorLog: { userId: string; contextPack: TutorContextPackV1; feedback: TutorFeedbackV1; provider: string; createdAt: string }[];
  tutorClaims: Map<string, number>;
  friendRequests: Map<string, { id: string; fromUserId: string; toUserId: string; status: "pending" | "accepted" | "declined"; createdAt: string; respondedAt?: string }>;
  friendships: Map<string, { id: string; userA: string; userB: string; createdAt: string }>;
  socialBlocks: { blockerUserId: string; blockedUserId: string; createdAt: string }[];
  socialReports: { id: string; reporterUserId: string; reportedUserId: string; reason: string; details?: string; createdAt: string }[];
  friendCodeRotations: Map<string, {
    userId: string;
    requestId: string;
    rotatedCode: string;
    createdAt: string;
  }>;
  coopChallenges: Map<string, { id: string; userA: string; userB: string; title: string; targetSessions: number; userAStartingSessions: number; userBStartingSessions: number; status: "active" | "completed"; createdAt: string; completedAt?: string }>;
  rateEvents: { userId: string; action: string; requestId?: string; createdAt: string }[];
};

function createStore(): Store {
  return {
    profiles: new Map(),
    sessions: new Map(),
    sessionStartRequests: new Map(),
    reviews: new Map(),
    mistakes: new Map(),
    attempts: [],
    privacyConsents: [],
    tutorLog: [],
    tutorClaims: new Map(),
    friendRequests: new Map(),
    friendships: new Map(),
    socialBlocks: [],
    socialReports: [],
    friendCodeRotations: new Map(),
    coopChallenges: new Map(),
    rateEvents: [],
  };
}

// Next.js development routes can be evaluated in separate module bundles.
// Keep the local-only demo store on the process global so a session created by
// one API route remains available to the lesson route that reads it.
const globalForMock = globalThis as typeof globalThis & { __frenchLearningMockStore?: Store };
const store = globalForMock.__frenchLearningMockStore ?? (globalForMock.__frenchLearningMockStore = createStore());

function defaultProfile(userId: string): LearnerProfile {
  return {
    userId,
    displayName: userId === DEMO_USER_ID ? "Jamie" : "Learner",
    friendCode: generateFriendCode(),
    currentLevel: "A1",
    learningGoals: ["travel"],
    interests: ["music"],
    dailyMinutes: 8,
    preferredMode: "normal",
    timeZone: DEFAULT_TIME_ZONE,
    country: "GB",
    birthDate: "2000-01-01",
    policyVersion: "2026-06-v1",
    completedSessions: 0,
    currentStreak: 0,
    streakFreezes: 0,
  };
}

export class MockLearningRepository implements LearningRepository {
  async getProfile(userId: string) {
    const profile = store.profiles.get(userId) ?? (userId === DEMO_USER_ID ? defaultProfile(userId) : null);
    return profile ? { ...profile, timeZone: normalizeIanaTimeZone(profile.timeZone) } : null;
  }

  async saveProfile(profile: LearnerProfile) {
    const saved = {
      ...profile,
      friendCode: profile.friendCode ?? generateFriendCode(),
      timeZone: normalizeIanaTimeZone(profile.timeZone),
    };
    store.profiles.set(saved.userId, saved);
    return saved;
  }

  async updateProfilePreferences(userId: string, changes: ProfilePreferenceChanges) {
    const existing = await this.getProfile(userId);
    if (!existing) return null;
    return this.saveProfile({ ...existing, ...changes });
  }

  async completeOnboardingProfile(profile: LearnerProfile) {
    const existing = store.profiles.get(profile.userId);
    const saved = {
      ...profile,
      friendCode: existing?.friendCode ?? profile.friendCode ?? generateFriendCode(),
      timeZone: normalizeIanaTimeZone(profile.timeZone),
      lastCompletedAt: existing?.lastCompletedAt ?? profile.lastCompletedAt,
      completedSessions: existing?.completedSessions ?? profile.completedSessions,
      currentStreak: existing?.currentStreak ?? profile.currentStreak,
      streakFreezes: existing?.streakFreezes ?? profile.streakFreezes,
    };
    const createdAt = new Date().toISOString();
    for (const consentType of ["terms", "privacy", "ai_tutor"] as const) {
      const alreadyRecorded = store.privacyConsents.some(
        (consent) =>
          consent.userId === profile.userId &&
          consent.consentType === consentType &&
          consent.policyVersion === profile.policyVersion,
      );
      if (!alreadyRecorded) {
        store.privacyConsents.push({
          userId: profile.userId,
          consentType,
          policyVersion: profile.policyVersion,
          granted: true,
          createdAt,
        });
      }
    }
    store.profiles.set(saved.userId, saved);
    return saved;
  }

  async getMission() {
    return getSeedMission();
  }

  async getDueReviews(userId: string) {
    return [...store.reviews.values()]
      .filter((review) => review.userId === userId)
      .sort((left, right) => left.dueAt.localeCompare(right.dueAt))
      .slice(0, LEARNING_SIGNAL_LIMIT);
  }

  async getOpenMistakes(userId: string) {
    return [...store.mistakes.values()]
      .filter((mistake) => mistake.userId === userId && !mistake.resolved)
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
      .slice(0, LEARNING_SIGNAL_LIMIT);
  }

  async createSession(
    userId: string,
    plan: SessionPlanV1,
    { resumeIfAvailable = false, requestId }: SessionCreationOptions = {},
  ) {
    const requestKey = requestId ? `${userId}:${requestId}` : undefined;
    const requestedSessionId = requestKey
      ? store.sessionStartRequests.get(requestKey)?.sessionId
      : undefined;
    if (requestedSessionId) {
      const requestedSession = store.sessions.get(requestedSessionId);
      if (requestedSession?.userId === userId) return requestedSession;
    }

    if (resumeIfAvailable) {
      const profile = store.profiles.get(userId);
      const focusedReview = plan.missionTitle === "Focused review";
      const existing = [...store.sessions.values()]
        .filter((session) =>
          session.userId === userId &&
          !session.completedAt &&
          session.plan.missionId === plan.missionId &&
          session.plan.mode === plan.mode &&
          (session.plan.missionTitle === "Focused review") === focusedReview &&
          isSameCalendarDay(session.startedAt, new Date(), profile?.timeZone),
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
      if (existing) {
        if (requestKey && requestId) {
          store.sessionStartRequests.set(requestKey, {
            userId,
            requestId,
            sessionId: existing.id,
            createdAt: new Date().toISOString(),
          });
        }
        return existing;
      }
    }

    const session: SessionRecord = {
      id: crypto.randomUUID(),
      userId,
      plan,
      startedAt: new Date().toISOString(),
      currentIndex: 0,
    };
    store.sessions.set(session.id, session);
    if (requestKey && requestId) {
      store.sessionStartRequests.set(requestKey, {
        userId,
        requestId,
        sessionId: session.id,
        createdAt: new Date().toISOString(),
      });
    }
    return session;
  }

  async getSession(userId: string, sessionId: string) {
    const session = store.sessions.get(sessionId);
    return session?.userId === userId ? session : null;
  }

  async getActiveSession(userId: string) {
    return (await this.getActiveSessions(userId))[0] ?? null;
  }

  async getActiveSessions(userId: string) {
    const cutoff = Date.now() - RESUMABLE_SESSION_LOOKBACK_MS;
    return [...store.sessions.values()]
      .filter((session) =>
        session.userId === userId &&
        !session.completedAt &&
        Date.parse(session.startedAt) >= cutoff,
      )
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, RESUMABLE_SESSION_LIMIT);
  }

  async getSessionAttempts(userId: string, sessionId: string) {
    return store.attempts.filter(
      (attempt) => attempt.userId === userId && attempt.sessionId === sessionId,
    );
  }

  async getRecentAttempts(userId: string, limit = 200) {
    return store.attempts.filter((attempt) => attempt.userId === userId).slice(-limit);
  }

  async getAttemptByRequestId(userId: string, requestId: string) {
    return store.attempts.find((attempt) => attempt.userId === userId && attempt.requestId === requestId) ?? null;
  }

  async recordSubmission(input: SubmissionInput) {
    const existingAttempt = await this.getAttemptByRequestId(input.userId, input.requestId);
    if (existingAttempt) return existingAttempt;
    const session = store.sessions.get(input.sessionId);
    if (session && session.currentIndex !== input.expectedCurrentIndex) {
      throw new Error("Learning session step changed before submission.");
    }
    const completed = input.completed ?? true;
    const evidenceKind = input.evidenceKind ?? inferEvidenceKind(input.activity.type);
    const correct = evidenceKind === "self-report" ? false : input.result.isCorrect;
    const attempt: ActivityAttempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      requestId: input.requestId,
      userId: input.userId,
      sessionId: input.sessionId,
      activityId: input.activity.id,
      submittedAnswer: input.submittedAnswer,
      latencyMs: input.latencyMs,
      completed,
      correct,
      evidenceKind,
      result: input.result,
      createdAt: new Date().toISOString(),
    };
    store.attempts.push(attempt);

    const contentItemId = input.activity.contentItemIds[0] ?? input.activity.id;
    const ruleId = input.result.ruleIds[0] ?? input.activity.grammarRuleIds[0] ?? input.activity.id;
    const patternId = `${input.userId}:${ruleId}`;
    const reviewId = `${input.userId}:${contentItemId}:${ruleId}`;
    const existingPattern = [...store.mistakes.values()].find(
      (pattern) => pattern.userId === input.userId && pattern.ruleId === ruleId,
    );
    const transition = transitionResponseState({
      userId: input.userId,
      activity: input.activity,
      result: input.result,
      completed,
      correct,
      evidenceKind,
      latencyMs: input.latencyMs,
      createdAt: attempt.createdAt,
      contentItemId,
      ruleId,
      mistakePatternId: patternId,
      reviewId,
      existingPattern,
      existingReview: store.reviews.get(reviewId),
    });
    if (transition.mistakePattern) {
      store.mistakes.set(transition.mistakePattern.id, transition.mistakePattern);
    }
    if (transition.reviewItem) {
      store.reviews.set(transition.reviewItem.id, transition.reviewItem);
    }

    if (session && completed) {
      const nextIndex = Math.min(session.currentIndex + 1, session.plan.activities.length);
      const isComplete = nextIndex >= session.plan.activities.length;
      store.sessions.set(input.sessionId, {
        ...session,
        currentIndex: nextIndex,
        completedAt: isComplete ? new Date().toISOString() : session.completedAt,
      });
      const hasCompletionCredit = hasSessionCompletionCredit({
        attempts: store.attempts.filter((candidate) => candidate.sessionId === input.sessionId),
        totalActivities: session.plan.activities.length,
      });
      if (isComplete && hasCompletionCredit) {
        const profile = (await this.getProfile(input.userId)) ?? defaultProfile(input.userId);
        const streak = advanceStreak({
          currentStreak: profile.currentStreak,
          streakFreezes: profile.streakFreezes ?? 0,
          lastCompletedAt: profile.lastCompletedAt,
          timeZone: profile.timeZone,
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

    return attempt;
  }

  async getProgress(userId: string): Promise<ProgressSnapshot> {
    const profile = (await this.getProfile(userId)) ?? defaultProfile(userId);
    const attempts = store.attempts
      .filter((attempt) => attempt.userId === userId)
      .map((attempt) => {
        const activity = getScoredActivityById(attempt.activityId);
        return {
          activityId: attempt.activityId,
          isCorrect: attempt.correct ?? attempt.result.isCorrect,
          activity,
          completed: attempt.completed ?? true,
          evidenceKind: attempt.evidenceKind ?? (activity ? inferEvidenceKind(activity.type) : undefined),
        };
      });
    const reviews = await this.getDueReviews(userId);
    const mistakes = [...store.mistakes.values()].filter((mistake) => mistake.userId === userId);
    const mission = getSeedMission();

    return buildProgressSnapshot({
      profile,
      attempts,
      reviews,
      mistakes,
      missionTitle: mission.title,
      missionActivityCount: mission.activities.length,
      sessionCompletionTimes: [...store.sessions.values()]
        .filter((session) => session.userId === userId && session.completedAt)
        .map((session) => session.completedAt as string),
    });
  }

  private async ensureSocialProfile(userId: string) {
    const profile = (await this.getProfile(userId)) ?? defaultProfile(userId);
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

  private friendshipKey(userA: string, userB: string) {
    return [userA, userB].sort().join(":");
  }

  private async socialProfileFor(userId: string) {
    return this.toSocialProfile(await this.ensureSocialProfile(userId));
  }

  private isBlocked(userA: string, userB: string) {
    return store.socialBlocks.some(
      (block) =>
        (block.blockerUserId === userA && block.blockedUserId === userB) ||
        (block.blockerUserId === userB && block.blockedUserId === userA),
    );
  }

  async getSocialSnapshot(userId: string): Promise<SocialSnapshot> {
    const profile = await this.ensureSocialProfile(userId);
    const socialProfile = this.toSocialProfile(profile);
    const blockedUserIds = store.socialBlocks
      .filter((block) => block.blockerUserId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, SOCIAL_BLOCK_LIMIT)
      .map((block) => block.blockedUserId);
    const blockedUsers = blockedUserIds.map((blockedUserId) => ({
      userId: blockedUserId,
      displayName: store.profiles.get(blockedUserId)?.displayName ?? "Blocked learner",
    }));
    const friends = await Promise.all(
      [...store.friendships.values()]
        .filter((friendship) => friendship.userA === userId || friendship.userB === userId)
        .filter((friendship) => !this.isBlocked(friendship.userA, friendship.userB))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, SOCIAL_FRIEND_LIMIT)
        .map(async (friendship) => {
          const friendUserId = friendship.userA === userId ? friendship.userB : friendship.userA;
          return { id: friendship.id, friend: await this.socialProfileFor(friendUserId), createdAt: friendship.createdAt };
        }),
    );
    const incomingRequestToDto = async (request: (typeof store.friendRequests extends Map<string, infer Request> ? Request : never)) => ({
      id: request.id,
      from: {
        userId: request.fromUserId,
        displayName: (await this.ensureSocialProfile(request.fromUserId)).displayName,
      },
      status: request.status,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    });
    const outgoingRequestToDto = async (request: (typeof store.friendRequests extends Map<string, infer Request> ? Request : never)) => ({
      id: request.id,
      to: {
        displayName: (await this.ensureSocialProfile(request.toUserId)).displayName,
      },
      status: request.status,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    });
    const incomingRequests = await Promise.all(
      [...store.friendRequests.values()]
        .filter((request) => request.toUserId === userId && request.status === "pending" && !this.isBlocked(request.fromUserId, request.toUserId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, SOCIAL_PENDING_REQUEST_LIMIT)
        .map(incomingRequestToDto),
    );
    const outgoingRequests = await Promise.all(
      [...store.friendRequests.values()]
        .filter((request) => request.fromUserId === userId && request.status === "pending" && !this.isBlocked(request.fromUserId, request.toUserId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, SOCIAL_PENDING_REQUEST_LIMIT)
        .map(outgoingRequestToDto),
    );
    const challenges = [...store.coopChallenges.values()]
      .filter((entry) => (entry.userA === userId || entry.userB === userId) && !this.isBlocked(entry.userA, entry.userB))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const challenge = challenges.find((entry) => entry.status === "active") ?? challenges[0];
    let activeChallenge: SocialSnapshot["activeChallenge"];
    if (challenge) {
      const friend = await this.socialProfileFor(challenge.userA === userId ? challenge.userB : challenge.userA);
      const yourStartingSessions = challenge.userA === userId ? challenge.userAStartingSessions : challenge.userBStartingSessions;
      const friendStartingSessions = challenge.userA === userId ? challenge.userBStartingSessions : challenge.userAStartingSessions;
      const progress = coopChallengeProgress({
        yourStartingSessions,
        friendStartingSessions,
        yourCompletedSessions: socialProfile.completedSessions,
        friendCompletedSessions: friend.completedSessions,
      });
      if (challenge.status === "active" && progress.combinedProgress >= challenge.targetSessions) {
        challenge.status = "completed";
        challenge.completedAt = new Date().toISOString();
      }
      activeChallenge = {
          id: challenge.id,
          friend,
          title: challenge.title,
          description: "Both learners complete focused sessions. The challenge rewards showing up, not competing on mistakes.",
          targetSessions: challenge.targetSessions,
          yourStartingSessions,
          friendStartingSessions,
          ...progress,
          status: challenge.status,
          createdAt: challenge.createdAt,
          completedAt: challenge.completedAt,
        };
    }

    return {
      profile: socialProfile,
      friendCode: profile.friendCode ?? generateFriendCode(),
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUserIds,
      blockedUsers,
      activeChallenge,
    };
  }

  async rotateFriendCode(userId: string, requestId: string) {
    const operationKey = `${userId}:${requestId}`;
    if (store.friendCodeRotations.has(operationKey)) return this.getSocialSnapshot(userId);
    const profile = await this.ensureSocialProfile(userId);
    const rotatedCode = generateFriendCode();
    await this.saveProfile({ ...profile, friendCode: rotatedCode });
    store.friendCodeRotations.set(operationKey, {
      userId,
      requestId,
      rotatedCode,
      createdAt: new Date().toISOString(),
    });
    return this.getSocialSnapshot(userId);
  }

  async sendFriendRequestByCode(userId: string, friendCode: string) {
    await this.ensureSocialProfile(userId);
    const normalizedCode = normalizeFriendCode(friendCode);
    const target = [...store.profiles.values()].find((profile) => normalizeFriendCode(profile.friendCode ?? "") === normalizedCode);
    if (!target || target.userId === userId) throw new Error("That friend code could not be added.");
    if (this.isBlocked(userId, target.userId)) throw new Error("That friend code could not be added.");
    const friendshipKey = this.friendshipKey(userId, target.userId);
    if (store.friendships.has(friendshipKey)) return this.getSocialSnapshot(userId);
    const requestId = this.friendshipKey(userId, target.userId);
    const existing = store.friendRequests.get(requestId);
    if (existing?.status === "declined" && isFriendRequestRetryCoolingDown(existing.respondedAt)) {
      throw new Error("Wait 7 days before sending another request to this learner.");
    }
    if (!existing || existing.status !== "pending") {
      const pendingForTarget = [...store.friendRequests.values()].filter(
        (request) => request.toUserId === target.userId && request.status === "pending",
      ).length;
      if (pendingForTarget >= SOCIAL_PENDING_REQUEST_LIMIT) {
        throw new Error("That learner has too many pending friend requests.");
      }
      store.friendRequests.set(requestId, {
        id: requestId,
        fromUserId: userId,
        toUserId: target.userId,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }
    return this.getSocialSnapshot(userId);
  }

  async respondFriendRequest(userId: string, requestId: string, decision: "accepted" | "declined") {
    const request = store.friendRequests.get(requestId);
    if (!request || request.toUserId !== userId || request.status !== "pending") throw new Error("That friend request is not available.");
    const respondedAt = new Date().toISOString();
    store.friendRequests.set(requestId, { ...request, status: decision, respondedAt });
    if (decision === "accepted" && !this.isBlocked(request.fromUserId, request.toUserId)) {
      const key = this.friendshipKey(request.fromUserId, request.toUserId);
      store.friendships.set(key, {
        id: key,
        userA: request.fromUserId,
        userB: request.toUserId,
        createdAt: respondedAt,
      });
    }
    return this.getSocialSnapshot(userId);
  }

  async blockSocialUser(userId: string, targetUserId: string) {
    if (targetUserId === userId) throw new Error("You cannot block yourself.");
    if (!store.socialBlocks.some(
      (block) => block.blockerUserId === userId && block.blockedUserId === targetUserId,
    )) {
      store.socialBlocks.push({
        blockerUserId: userId,
        blockedUserId: targetUserId,
        createdAt: new Date().toISOString(),
      });
    }
    store.friendships.delete(this.friendshipKey(userId, targetUserId));
    [...store.friendRequests.entries()].forEach(([id, request]) => {
      if (
        (request.fromUserId === userId && request.toUserId === targetUserId) ||
        (request.fromUserId === targetUserId && request.toUserId === userId)
      ) {
        store.friendRequests.delete(id);
      }
    });
    const completedAt = new Date().toISOString();
    store.coopChallenges.forEach((challenge) => {
      if (
        challenge.status === "active" &&
        ((challenge.userA === userId && challenge.userB === targetUserId) ||
          (challenge.userA === targetUserId && challenge.userB === userId))
      ) {
        challenge.status = "completed";
        challenge.completedAt = completedAt;
      }
    });
    return this.getSocialSnapshot(userId);
  }

  async unblockSocialUser(userId: string, targetUserId: string) {
    store.socialBlocks.splice(
      0,
      store.socialBlocks.length,
      ...store.socialBlocks.filter(
        (block) =>
          block.blockerUserId !== userId ||
          block.blockedUserId !== targetUserId,
      ),
    );
    return this.getSocialSnapshot(userId);
  }

  async reportSocialUser(
    userId: string,
    targetUserId: string,
    reason: string,
    details: string | undefined,
    requestId: string,
  ) {
    const existing = store.socialReports.find((report) => report.id === requestId);
    if (existing) {
      if (
        existing.reporterUserId !== userId ||
        existing.reportedUserId !== targetUserId ||
        existing.reason !== reason ||
        existing.details !== details
      ) {
        throw new Error("That social action could not be completed.");
      }
      return this.getSocialSnapshot(userId);
    }
    store.socialReports.push({
      id: requestId,
      reporterUserId: userId,
      reportedUserId: targetUserId,
      reason,
      details,
      createdAt: new Date().toISOString(),
    });
    return this.getSocialSnapshot(userId);
  }

  async startCoopChallenge(userId: string, friendUserId: string) {
    if (this.isBlocked(userId, friendUserId)) {
      throw new Error("Add this learner as a friend before starting a challenge.");
    }
    const key = this.friendshipKey(userId, friendUserId);
    const friendship = store.friendships.get(key);
    if (!friendship) throw new Error("Add this learner as a friend before starting a challenge.");
    const participantHasActiveChallenge = [...store.coopChallenges.values()].some(
      (challenge) =>
        challenge.status === "active" &&
        [challenge.userA, challenge.userB].some((participant) => participant === userId || participant === friendUserId),
    );
    if (participantHasActiveChallenge) {
      throw new Error("Finish your active co-op challenge before starting another.");
    }
    const [profile, friend] = await Promise.all([this.ensureSocialProfile(userId), this.ensureSocialProfile(friendUserId)]);
    const challengeId = `challenge-${key}`;
    store.coopChallenges.set(challengeId, {
      id: challengeId,
      userA: userId,
      userB: friendUserId,
      title: "Three-session co-op",
      targetSessions: 3,
      userAStartingSessions: profile.completedSessions,
      userBStartingSessions: friend.completedSessions,
      status: "active",
      createdAt: new Date().toISOString(),
    });
    return this.getSocialSnapshot(userId);
  }

  async logTutorInteraction(input: {
    userId: string;
    contextPack: TutorContextPackV1;
    feedback: TutorFeedbackV1;
    provider: "fallback" | "openai";
  }) {
    const existingIndex = store.tutorLog.findIndex(
      (entry) => entry.userId === input.userId && entry.contextPack.attemptId === input.contextPack.attemptId,
    );
    const entry = { ...input, createdAt: new Date().toISOString() };
    if (existingIndex >= 0) store.tutorLog[existingIndex] = entry;
    else store.tutorLog.push(entry);
    store.tutorClaims.delete(`${input.userId}:${input.contextPack.attemptId}`);
  }

  async claimTutorInteraction(userId: string, contextPack: TutorContextPackV1) {
    const key = `${userId}:${contextPack.attemptId}`;
    const claimedAt = store.tutorClaims.get(key);
    if (claimedAt && Date.now() - claimedAt < 30_000) return false;
    if (
      store.tutorLog.some(
        (entry) =>
          entry.userId === userId &&
          entry.contextPack.attemptId === contextPack.attemptId,
      )
    ) {
      return false;
    }
    store.tutorClaims.set(key, Date.now());
    return true;
  }

  async getTutorInteractionForAttempt(userId: string, attemptId: string) {
    const entry = store.tutorLog.find(
      (candidate) => candidate.userId === userId && candidate.contextPack.attemptId === attemptId,
    );
    return entry ? { feedback: entry.feedback, provider: entry.provider as "fallback" | "openai" } : null;
  }

  async countTutorInteractionsSince(userId: string, since: string) {
    return store.tutorLog.filter((entry) => entry.userId === userId && entry.createdAt >= since).length;
  }

  async consumeRateLimit(
    userId: string,
    action: string,
    options: { limit: number; windowSeconds: number },
    requestId?: string,
  ) {
    const now = Date.now();
    const cutoff = now - options.windowSeconds * 1000;
    store.rateEvents.splice(
      0,
      store.rateEvents.length,
      ...store.rateEvents.filter((event) => Date.parse(event.createdAt) >= cutoff),
    );
    if (
      requestId &&
      store.rateEvents.some((event) =>
        event.userId === userId &&
        event.action === action &&
        event.requestId === requestId,
      )
    ) {
      return true;
    }
    const used = store.rateEvents.filter((event) => event.userId === userId && event.action === action).length;
    if (used >= options.limit) return false;
    store.rateEvents.push({ userId, action, requestId, createdAt: new Date(now).toISOString() });
    return true;
  }

  async exportLearnerData(userId: string) {
    return {
      exportedAt: new Date().toISOString(),
      profile: await this.getProfile(userId),
      sessions: [...store.sessions.values()].filter((session) => session.userId === userId),
      sessionStartRequests: [...store.sessionStartRequests.values()]
        .filter((request) => request.userId === userId),
      attempts: store.attempts.filter((attempt) => attempt.userId === userId),
      reviews: await this.getDueReviews(userId),
      mistakes: [...store.mistakes.values()].filter((mistake) => mistake.userId === userId),
      privacyConsents: store.privacyConsents.filter((consent) => consent.userId === userId),
      tutorInteractions: store.tutorLog.filter((entry) => entry.userId === userId),
      friendRequests: [...store.friendRequests.values()].filter((request) => request.fromUserId === userId || request.toUserId === userId),
      friendships: [...store.friendships.values()].filter((friendship) => friendship.userA === userId || friendship.userB === userId),
      socialBlocks: store.socialBlocks.filter((block) => block.blockerUserId === userId),
      socialReports: store.socialReports.filter((report) => report.reporterUserId === userId),
      friendCodeRotationRequests: [...store.friendCodeRotations.values()]
        .filter((request) => request.userId === userId),
      coopChallenges: [...store.coopChallenges.values()].filter((challenge) => challenge.userA === userId || challenge.userB === userId),
      streakEvents: [],
      rewards: [],
      aiSessionSummaries: [],
      contentVersions: [],
      rateLimitEvents: store.rateEvents.filter((event) => event.userId === userId),
      retentionNotice:
        "Rate-limit and abuse-prevention events may remain for up to eight days. Limited blocks and moderation reports may be retained after learner-data deletion to protect other learners and preserve safety investigations.",
    };
  }

  async deleteLearnerData(userId: string) {
    store.profiles.delete(userId);
    [...store.sessions.entries()].forEach(([id, session]) => session.userId === userId && store.sessions.delete(id));
    for (const key of store.sessionStartRequests.keys()) {
      if (key.startsWith(`${userId}:`)) store.sessionStartRequests.delete(key);
    }
    [...store.reviews.entries()].forEach(([id, review]) => review.userId === userId && store.reviews.delete(id));
    [...store.mistakes.entries()].forEach(([id, mistake]) => mistake.userId === userId && store.mistakes.delete(id));
    store.attempts.splice(0, store.attempts.length, ...store.attempts.filter((attempt) => attempt.userId !== userId));
    store.privacyConsents.splice(0, store.privacyConsents.length, ...store.privacyConsents.filter((consent) => consent.userId !== userId));
    store.tutorLog.splice(0, store.tutorLog.length, ...store.tutorLog.filter((entry) => entry.userId !== userId));
    for (const key of store.tutorClaims.keys()) {
      if (key.startsWith(`${userId}:`)) store.tutorClaims.delete(key);
    }
    for (const [key, request] of store.friendCodeRotations) {
      if (request.userId === userId) store.friendCodeRotations.delete(key);
    }
    [...store.friendRequests.entries()].forEach(([id, request]) => (request.fromUserId === userId || request.toUserId === userId) && store.friendRequests.delete(id));
    [...store.friendships.entries()].forEach(([id, friendship]) => (friendship.userA === userId || friendship.userB === userId) && store.friendships.delete(id));
    [...store.coopChallenges.entries()].forEach(([id, challenge]) => (challenge.userA === userId || challenge.userB === userId) && store.coopChallenges.delete(id));
  }
}
