import { getSeedMission } from "@/lib/content/seed";
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
import type { LearningRepository, SubmissionInput } from "@/lib/data/repository";
import { buildProgressSnapshot } from "@/lib/learning/progress-summary";
import {
  inferEvidenceKind,
  isQualifyingSessionEvidence,
  transitionResponseState,
} from "@/lib/learning/response-transition";
import { advanceStreak } from "@/lib/learning/streak";
import { friendCodeForUser, normalizeFriendCode } from "@/lib/social/friend-code";

const DEMO_USER_ID = "demo-learner";

type Store = {
  profiles: Map<string, LearnerProfile>;
  sessions: Map<string, SessionRecord>;
  reviews: Map<string, ReviewItem>;
  mistakes: Map<string, MistakePattern>;
  attempts: ActivityAttempt[];
  privacyConsents: { userId: string; consentType: "terms" | "privacy" | "ai_tutor"; policyVersion: string; granted: boolean; createdAt: string }[];
  tutorLog: { userId: string; contextPack: TutorContextPackV1; feedback: TutorFeedbackV1; provider: string; createdAt: string }[];
  friendRequests: Map<string, { id: string; fromUserId: string; toUserId: string; status: "pending" | "accepted" | "declined"; createdAt: string; respondedAt?: string }>;
  friendships: Map<string, { id: string; userA: string; userB: string; createdAt: string }>;
  socialBlocks: { blockerUserId: string; blockedUserId: string; createdAt: string }[];
  socialReports: { id: string; reporterUserId: string; reportedUserId: string; reason: string; details?: string; createdAt: string }[];
  coopChallenges: Map<string, { id: string; userA: string; userB: string; title: string; targetSessions: number; userAStartingSessions: number; userBStartingSessions: number; status: "active" | "completed"; createdAt: string; completedAt?: string }>;
};

function createStore(): Store {
  return {
    profiles: new Map(),
    sessions: new Map(),
    reviews: new Map(),
    mistakes: new Map(),
    attempts: [],
    privacyConsents: [],
    tutorLog: [],
    friendRequests: new Map(),
    friendships: new Map(),
    socialBlocks: [],
    socialReports: [],
    coopChallenges: new Map(),
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
    friendCode: friendCodeForUser(userId),
    currentLevel: "A1",
    learningGoals: ["travel"],
    interests: ["music"],
    dailyMinutes: 8,
    preferredMode: "normal",
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
    return store.profiles.get(userId) ?? (userId === DEMO_USER_ID ? defaultProfile(userId) : null);
  }

  async saveProfile(profile: LearnerProfile) {
    const saved = { ...profile, friendCode: profile.friendCode ?? friendCodeForUser(profile.userId) };
    store.profiles.set(saved.userId, saved);
    return saved;
  }

  async recordRequiredPrivacyConsents(userId: string, policyVersion: string) {
    const createdAt = new Date().toISOString();
    for (const consentType of ["terms", "privacy", "ai_tutor"] as const) {
      store.privacyConsents.push({ userId, consentType, policyVersion, granted: true, createdAt });
    }
  }

  async getMission() {
    return getSeedMission();
  }

  async getDueReviews(userId: string) {
    return [...store.reviews.values()].filter((review) => review.userId === userId);
  }

  async getOpenMistakes(userId: string) {
    return [...store.mistakes.values()].filter((mistake) => mistake.userId === userId && !mistake.resolved);
  }

  async createSession(userId: string, plan: SessionPlanV1) {
    const session: SessionRecord = {
      id: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId,
      plan,
      startedAt: new Date().toISOString(),
      currentIndex: 0,
    };
    store.sessions.set(session.id, session);
    return session;
  }

  async getSession(userId: string, sessionId: string) {
    const session = store.sessions.get(sessionId);
    return session?.userId === userId ? session : null;
  }

  async getActiveSession(userId: string) {
    const active = [...store.sessions.values()]
      .filter((session) => session.userId === userId && !session.completedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return active[0] ?? null;
  }

  async getRecentAttempts(userId: string, limit = 200) {
    return store.attempts.filter((attempt) => attempt.userId === userId).slice(-limit);
  }

  async recordSubmission(input: SubmissionInput) {
    const completed = input.completed ?? true;
    const evidenceKind = input.evidenceKind ?? inferEvidenceKind(input.activity.type);
    const correct = evidenceKind === "self-report" ? false : input.result.isCorrect;
    const attempt: ActivityAttempt = {
      id: `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

    const session = store.sessions.get(input.sessionId);
    if (session && completed) {
      const nextIndex = Math.min(session.currentIndex + 1, session.plan.activities.length);
      const isComplete = nextIndex >= session.plan.activities.length;
      store.sessions.set(input.sessionId, {
        ...session,
        currentIndex: nextIndex,
        completedAt: isComplete ? new Date().toISOString() : session.completedAt,
      });
      const hasQualifyingSessionEvidence = store.attempts.some(
        (candidate) => candidate.sessionId === input.sessionId && isQualifyingSessionEvidence({
          completed: candidate.completed ?? true,
          correct: candidate.correct ?? candidate.result.isCorrect,
          evidenceKind: candidate.evidenceKind ?? "controlled",
        }),
      );
      if (isComplete && evidenceKind !== "self-report" && hasQualifyingSessionEvidence) {
        const profile = (await this.getProfile(input.userId)) ?? defaultProfile(input.userId);
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

    return attempt;
  }

  async getProgress(userId: string): Promise<ProgressSnapshot> {
    const profile = (await this.getProfile(userId)) ?? defaultProfile(userId);
    const attempts = store.attempts
      .filter((attempt) => attempt.userId === userId)
      .filter((attempt) => (attempt.completed ?? true) && attempt.evidenceKind !== "self-report")
      .map((attempt) => ({
        activityId: attempt.activityId,
        isCorrect: attempt.correct ?? attempt.result.isCorrect,
      }));
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
    });
  }

  private async ensureSocialProfile(userId: string) {
    const profile = (await this.getProfile(userId)) ?? defaultProfile(userId);
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
      .map((block) => block.blockedUserId);
    const friends = await Promise.all(
      [...store.friendships.values()]
        .filter((friendship) => friendship.userA === userId || friendship.userB === userId)
        .filter((friendship) => !this.isBlocked(friendship.userA, friendship.userB))
        .map(async (friendship) => {
          const friendUserId = friendship.userA === userId ? friendship.userB : friendship.userA;
          return { id: friendship.id, friend: await this.socialProfileFor(friendUserId), createdAt: friendship.createdAt };
        }),
    );
    const requestToDto = async (request: (typeof store.friendRequests extends Map<string, infer Request> ? Request : never)) => ({
      id: request.id,
      from: await this.socialProfileFor(request.fromUserId),
      to: await this.socialProfileFor(request.toUserId),
      status: request.status,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    });
    const incomingRequests = await Promise.all(
      [...store.friendRequests.values()]
        .filter((request) => request.toUserId === userId && request.status === "pending" && !this.isBlocked(request.fromUserId, request.toUserId))
        .map(requestToDto),
    );
    const outgoingRequests = await Promise.all(
      [...store.friendRequests.values()]
        .filter((request) => request.fromUserId === userId && request.status === "pending" && !this.isBlocked(request.fromUserId, request.toUserId))
        .map(requestToDto),
    );
    const challenge = [...store.coopChallenges.values()].find(
      (entry) => entry.status === "active" && (entry.userA === userId || entry.userB === userId) && !this.isBlocked(entry.userA, entry.userB),
    );
    const activeChallenge = challenge
      ? {
          id: challenge.id,
          friend: await this.socialProfileFor(challenge.userA === userId ? challenge.userB : challenge.userA),
          title: challenge.title,
          description: "Both learners complete focused sessions. The challenge rewards showing up, not competing on mistakes.",
          targetSessions: challenge.targetSessions,
          yourStartingSessions: challenge.userA === userId ? challenge.userAStartingSessions : challenge.userBStartingSessions,
          friendStartingSessions: challenge.userA === userId ? challenge.userBStartingSessions : challenge.userAStartingSessions,
          status: challenge.status,
          createdAt: challenge.createdAt,
          completedAt: challenge.completedAt,
        }
      : undefined;

    return {
      profile: socialProfile,
      friendCode: socialProfile.friendCode ?? friendCodeForUser(userId),
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUserIds,
      activeChallenge,
    };
  }

  async sendFriendRequestByCode(userId: string, friendCode: string) {
    await this.ensureSocialProfile(userId);
    const normalizedCode = normalizeFriendCode(friendCode);
    const target = [...store.profiles.values()].find((profile) => normalizeFriendCode(profile.friendCode ?? "") === normalizedCode);
    if (!target || target.userId === userId) throw new Error("That friend code could not be added.");
    if (this.isBlocked(userId, target.userId)) throw new Error("This learner cannot be added.");
    const friendshipKey = this.friendshipKey(userId, target.userId);
    if (store.friendships.has(friendshipKey)) return this.getSocialSnapshot(userId);
    const requestId = this.friendshipKey(userId, target.userId);
    const existing = store.friendRequests.get(requestId);
    if (!existing || existing.status !== "pending") {
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
    store.socialBlocks.push({ blockerUserId: userId, blockedUserId: targetUserId, createdAt: new Date().toISOString() });
    store.friendships.delete(this.friendshipKey(userId, targetUserId));
    [...store.friendRequests.entries()].forEach(([id, request]) => {
      if (
        (request.fromUserId === userId && request.toUserId === targetUserId) ||
        (request.fromUserId === targetUserId && request.toUserId === userId)
      ) {
        store.friendRequests.delete(id);
      }
    });
    return this.getSocialSnapshot(userId);
  }

  async reportSocialUser(userId: string, targetUserId: string, reason: string, details?: string) {
    store.socialReports.push({
      id: `report-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      reporterUserId: userId,
      reportedUserId: targetUserId,
      reason,
      details,
      createdAt: new Date().toISOString(),
    });
    return this.getSocialSnapshot(userId);
  }

  async startCoopChallenge(userId: string, friendUserId: string) {
    const key = this.friendshipKey(userId, friendUserId);
    const friendship = store.friendships.get(key);
    if (!friendship) throw new Error("Add this learner as a friend before starting a challenge.");
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
    store.tutorLog.push({ ...input, createdAt: new Date().toISOString() });
  }

  async exportLearnerData(userId: string) {
    return {
      profile: await this.getProfile(userId),
      sessions: [...store.sessions.values()].filter((session) => session.userId === userId),
      attempts: store.attempts.filter((attempt) => attempt.userId === userId),
      reviews: await this.getDueReviews(userId),
      mistakes: [...store.mistakes.values()].filter((mistake) => mistake.userId === userId),
      privacyConsents: store.privacyConsents.filter((consent) => consent.userId === userId),
      tutorLog: store.tutorLog.filter((entry) => entry.userId === userId),
      friendRequests: [...store.friendRequests.values()].filter((request) => request.fromUserId === userId || request.toUserId === userId),
      friendships: [...store.friendships.values()].filter((friendship) => friendship.userA === userId || friendship.userB === userId),
      socialBlocks: store.socialBlocks.filter((block) => block.blockerUserId === userId || block.blockedUserId === userId),
      socialReports: store.socialReports.filter((report) => report.reporterUserId === userId || report.reportedUserId === userId),
      coopChallenges: [...store.coopChallenges.values()].filter((challenge) => challenge.userA === userId || challenge.userB === userId),
    };
  }

  async deleteLearnerData(userId: string) {
    store.profiles.delete(userId);
    [...store.sessions.entries()].forEach(([id, session]) => session.userId === userId && store.sessions.delete(id));
    [...store.reviews.entries()].forEach(([id, review]) => review.userId === userId && store.reviews.delete(id));
    [...store.mistakes.entries()].forEach(([id, mistake]) => mistake.userId === userId && store.mistakes.delete(id));
    store.attempts.splice(0, store.attempts.length, ...store.attempts.filter((attempt) => attempt.userId !== userId));
    store.privacyConsents.splice(0, store.privacyConsents.length, ...store.privacyConsents.filter((consent) => consent.userId !== userId));
    store.tutorLog.splice(0, store.tutorLog.length, ...store.tutorLog.filter((entry) => entry.userId !== userId));
    [...store.friendRequests.entries()].forEach(([id, request]) => (request.fromUserId === userId || request.toUserId === userId) && store.friendRequests.delete(id));
    [...store.friendships.entries()].forEach(([id, friendship]) => (friendship.userA === userId || friendship.userB === userId) && store.friendships.delete(id));
    store.socialBlocks.splice(0, store.socialBlocks.length, ...store.socialBlocks.filter((block) => block.blockerUserId !== userId && block.blockedUserId !== userId));
    store.socialReports.splice(0, store.socialReports.length, ...store.socialReports.filter((report) => report.reporterUserId !== userId && report.reportedUserId !== userId));
    [...store.coopChallenges.entries()].forEach(([id, challenge]) => (challenge.userA === userId || challenge.userB === userId) && store.coopChallenges.delete(id));
  }
}
