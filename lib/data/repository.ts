import type {
  ActivityAttempt,
  ActivityDefinition,
  AttemptEvidenceKind,
  LearnerProfile,
  MistakePattern,
  Mission,
  ProgressSnapshot,
  ReviewItem,
  SessionPlanV1,
  SessionRecord,
  SocialSnapshot,
  TutorContextPackV1,
  TutorFeedbackV1,
  ValidationResultV1,
} from "@/lib/domain/types";

export type SubmissionInput = {
  requestId: string;
  expectedCurrentIndex: number;
  userId: string;
  sessionId: string;
  activity: ActivityDefinition;
  submittedAnswer: string;
  latencyMs: number;
  result: ValidationResultV1;
  completed?: boolean;
  correct?: boolean;
  evidenceKind?: AttemptEvidenceKind;
};

export type StoredTutorFeedback = {
  feedback: TutorFeedbackV1;
  provider: "fallback" | "openai";
};

export type ProfilePreferenceChanges = Partial<Pick<
  LearnerProfile,
  | "displayName"
  | "currentLevel"
  | "learningGoals"
  | "interests"
  | "dailyMinutes"
  | "preferredMode"
  | "timeZone"
  | "focusPreferences"
  | "speakingConfidence"
>>;

export type SessionCreationOptions = {
  resumeIfAvailable?: boolean;
  requestId?: string;
};

export interface LearningRepository {
  getProfile(userId: string): Promise<LearnerProfile | null>;
  saveProfile(profile: LearnerProfile): Promise<LearnerProfile>;
  updateProfilePreferences(userId: string, changes: ProfilePreferenceChanges): Promise<LearnerProfile | null>;
  completeOnboardingProfile(profile: LearnerProfile): Promise<LearnerProfile>;
  getMission(): Promise<Mission>;
  getDueReviews(userId: string): Promise<ReviewItem[]>;
  getOpenMistakes(userId: string): Promise<MistakePattern[]>;
  createSession(
    userId: string,
    plan: SessionPlanV1,
    options?: SessionCreationOptions,
  ): Promise<SessionRecord>;
  getSession(userId: string, sessionId: string): Promise<SessionRecord | null>;
  getActiveSession(userId: string): Promise<SessionRecord | null>;
  getActiveSessions(userId: string): Promise<SessionRecord[]>;
  getSessionAttempts(userId: string, sessionId: string): Promise<ActivityAttempt[]>;
  getRecentAttempts(userId: string, limit?: number): Promise<ActivityAttempt[]>;
  getAttemptByRequestId(userId: string, requestId: string): Promise<ActivityAttempt | null>;
  recordSubmission(input: SubmissionInput): Promise<ActivityAttempt>;
  getProgress(userId: string): Promise<ProgressSnapshot>;
  getSocialSnapshot(userId: string): Promise<SocialSnapshot>;
  rotateFriendCode(userId: string, requestId: string): Promise<SocialSnapshot>;
  sendFriendRequestByCode(userId: string, friendCode: string): Promise<SocialSnapshot>;
  respondFriendRequest(userId: string, requestId: string, decision: "accepted" | "declined"): Promise<SocialSnapshot>;
  blockSocialUser(userId: string, targetUserId: string): Promise<SocialSnapshot>;
  unblockSocialUser(userId: string, targetUserId: string): Promise<SocialSnapshot>;
  reportSocialUser(
    userId: string,
    targetUserId: string,
    reason: string,
    details: string | undefined,
    requestId: string,
  ): Promise<SocialSnapshot>;
  startCoopChallenge(userId: string, friendUserId: string): Promise<SocialSnapshot>;
  logTutorInteraction(input: {
    userId: string;
    contextPack: TutorContextPackV1;
    feedback: TutorFeedbackV1;
    provider: "fallback" | "openai";
  }): Promise<void>;
  claimTutorInteraction(userId: string, contextPack: TutorContextPackV1): Promise<boolean>;
  getTutorInteractionForAttempt(userId: string, attemptId: string): Promise<StoredTutorFeedback | null>;
  countTutorInteractionsSince(userId: string, since: string): Promise<number>;
  consumeRateLimit(
    userId: string,
    action: string,
    options: { limit: number; windowSeconds: number },
    requestId?: string,
  ): Promise<boolean>;
  exportLearnerData(userId: string): Promise<Record<string, unknown>>;
  deleteLearnerData(userId: string): Promise<void>;
}
