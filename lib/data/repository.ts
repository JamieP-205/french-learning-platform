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

export interface LearningRepository {
  getProfile(userId: string): Promise<LearnerProfile | null>;
  saveProfile(profile: LearnerProfile): Promise<LearnerProfile>;
  recordRequiredPrivacyConsents(userId: string, policyVersion: string): Promise<void>;
  getMission(): Promise<Mission>;
  getDueReviews(userId: string): Promise<ReviewItem[]>;
  getOpenMistakes(userId: string): Promise<MistakePattern[]>;
  createSession(userId: string, plan: SessionPlanV1): Promise<SessionRecord>;
  getSession(userId: string, sessionId: string): Promise<SessionRecord | null>;
  getActiveSession(userId: string): Promise<SessionRecord | null>;
  getRecentAttempts(userId: string, limit?: number): Promise<ActivityAttempt[]>;
  recordSubmission(input: SubmissionInput): Promise<ActivityAttempt>;
  getProgress(userId: string): Promise<ProgressSnapshot>;
  getSocialSnapshot(userId: string): Promise<SocialSnapshot>;
  sendFriendRequestByCode(userId: string, friendCode: string): Promise<SocialSnapshot>;
  respondFriendRequest(userId: string, requestId: string, decision: "accepted" | "declined"): Promise<SocialSnapshot>;
  blockSocialUser(userId: string, targetUserId: string): Promise<SocialSnapshot>;
  reportSocialUser(userId: string, targetUserId: string, reason: string, details?: string): Promise<SocialSnapshot>;
  startCoopChallenge(userId: string, friendUserId: string): Promise<SocialSnapshot>;
  logTutorInteraction(input: {
    userId: string;
    contextPack: TutorContextPackV1;
    feedback: TutorFeedbackV1;
    provider: "fallback" | "openai";
  }): Promise<void>;
  exportLearnerData(userId: string): Promise<Record<string, unknown>>;
  deleteLearnerData(userId: string): Promise<void>;
}
