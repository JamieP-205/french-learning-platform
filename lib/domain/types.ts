export const activityTypes = [
  "multiple_choice",
  "fill_blank",
  "typing",
  "sentence_builder",
  "dictation_placeholder",
  "speak_repeat_placeholder",
] as const;

export type ActivityType = (typeof activityTypes)[number];
export type Register = "formal" | "neutral" | "casual" | "slang" | "regional";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type SessionMode = "normal" | "two_minute" | "comeback";
export type AttemptEvidenceKind = "recognition" | "controlled" | "free-production" | "self-report";
export type MistakeType =
  | "grammar"
  | "spelling"
  | "word_order"
  | "register"
  | "listening"
  | "gender-agreement"
  | "article-elision"
  | "partitive"
  | "tu-vous"
  | "pc-vs-imparfait"
  | "subjunctive-trigger"
  | "liaison"
  | "silent-final"
  | "faux-ami"
  | "y-vs-u"
  | "nasal-denasalised"
  | "nasal-plus-n"
  | "r-anterior"
  | "front-rounded-unrounded"
  | "liaison-missing"
  | "final-consonant-voiced"
  | "e-open-vs-closed"
  | "stress-misplaced"
  | "unknown";

export type VocabularyEntry = {
  /** Written form learners encounter; lemma metadata is checked against FLELex. */
  form: string;
  lemma: string;
  pos: string;
  cefrLevel: CefrLevel;
  meaning: string;
};

export type InlineGloss = {
  form: string;
  meaning: string;
};

export type InputSegment = {
  text: string;
  inlineGlosses: InlineGloss[];
};

export type TeachingStep = {
  form: string;
  /** Plain-English meaning shown before grammatical detail. */
  meaning?: string;
  metalinguisticRule: string;
  positiveExamples: string[];
  contrastExamples: string[];
  function: string;
  registerNote?: string;
  inputSegment: InputSegment;
};

export type ConceptDefinition = {
  id: string;
  prerequisiteConceptIds: string[];
  teachingStep: TeachingStep;
  vocabulary: VocabularyEntry[];
};

export type ScoredSegment = {
  source: "prompt" | "choice" | "target" | "token" | "accepted-answer";
  text: string;
  inlineGlosses: InlineGloss[];
};

export type ActivityCurriculumRequirement = {
  activityId: string;
  requiredConceptIds: string[];
  scoredSegments: ScoredSegment[];
};

export type MissionCurriculum = {
  missionId: string;
  concepts: ConceptDefinition[];
  activities: ActivityCurriculumRequirement[];
};

export type AcceptedAnswer = {
  value: string;
  register?: Register;
  allowAccentless?: boolean;
};

export type NearMiss = {
  value: string;
  mistakeType: MistakeType;
  ruleId: string;
  explanation: string;
  correctedAnswer: string;
};

export type ContentSource = {
  id: string;
  title: string;
  reference: string;
  trustLevel: "primary" | "editorial" | "reference";
};

export type ContentItem = {
  id: string;
  version: number;
  type: "phrase" | "grammar" | "dialogue";
  frenchText: string;
  englishMeaning: string;
  literalMeaning?: string;
  register: Register;
  usageContext: string;
  cefrLevel: "A1";
  grammarTags: string[];
  sourceIds: string[];
  verificationStatus: "source_validated";
  publicationStatus: "published";
  reviewerNotes?: string;
};

export type BaseActivity = {
  id: string;
  type: ActivityType;
  prompt: string;
  // Exact French substrings rendered inside `prompt`. An empty array is an
  // explicit declaration that the prompt contains no French; verification
  // never guesses language from accents or a probabilistic word list.
  promptFrenchSegments: string[];
  helperText?: string;
  contentItemIds: string[];
  grammarRuleIds: string[];
  estimatedSeconds: number;
  acceptedAnswers: AcceptedAnswer[];
  nearMisses?: NearMiss[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
};

export type ChoiceActivity = BaseActivity & {
  type: "multiple_choice";
  choices: { id: string; label: string; language: "fr" | "en" }[];
};

export type SentenceBuilderActivity = BaseActivity & {
  type: "sentence_builder";
  tokens: string[];
};

export type InputActivity = BaseActivity & {
  type: "fill_blank" | "typing" | "dictation_placeholder" | "speak_repeat_placeholder";
  placeholder?: string;
  targetText?: string;
};

export type ActivityDefinition = ChoiceActivity | SentenceBuilderActivity | InputActivity;

export type Mission = {
  id: string;
  slug: string;
  title: string;
  description: string;
  outcome: string;
  estimatedMinutes: number;
  cefrLevel: "A1";
  activities: ActivityDefinition[];
  contentItems: ContentItem[];
  sources: ContentSource[];
};

export type LearnerProfile = {
  userId: string;
  displayName: string;
  friendCode?: string;
  currentLevel: CefrLevel;
  learningGoals: string[];
  interests: string[];
  dailyMinutes: number;
  preferredMode: "normal" | "short";
  // Which practice types the learner wants emphasised. The planner still covers
  // weak skills; this only tilts the mix.
  focusPreferences?: string[];
  speakingConfidence?: "low" | "medium" | "high";
  // Signup uses a 13+ self-declaration instead of per-country birth-date policies.
  ageConfirmed?: boolean;
  country?: string;
  birthDate?: string;
  policyVersion: string;
  lastCompletedAt?: string;
  completedSessions: number;
  currentStreak: number;
  streakFreezes?: number;
};

export type ReviewItem = {
  id: string;
  userId: string;
  contentItemId: string;
  activityId: string;
  ruleId?: string;
  prompt: string;
  expectedAnswers: AcceptedAnswer[];
  stage: number;
  dueAt: string;
  successCount: number;
  failureCount: number;
  priority: number;
};

export type MistakePattern = {
  id: string;
  userId: string;
  ruleId: string;
  mistakeType: MistakeType;
  correctedAnswer: string;
  explanation: string;
  repeatCount: number;
  separateProductionSuccesses: number;
  resolved: boolean;
  lastSeenAt: string;
};

export type ValidationResultV1 = {
  isCorrect: boolean;
  isNearMiss: boolean;
  normalizedAnswer: string;
  feedback: string;
  correctAnswer: string;
  mistakeType?: MistakeType;
  ruleIds: string[];
  shouldCreateReview: boolean;
};

export type PlannedActivity = {
  activity: ActivityDefinition;
  kind: "review" | "mission" | "repair";
  rationale: string;
};

export type SessionPlanV1 = {
  id: string;
  userId: string;
  missionId: string;
  // Optional so session records stored before this field existed still parse.
  missionTitle?: string;
  mode: SessionMode;
  estimatedMinutes: number;
  weakFocus: string;
  activities: PlannedActivity[];
  completionReward: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  plan: SessionPlanV1;
  startedAt: string;
  completedAt?: string;
  currentIndex: number;
};

export type ActivityAttempt = {
  id: string;
  userId: string;
  sessionId: string;
  activityId: string;
  submittedAnswer: string;
  latencyMs: number;
  // Optional while records written before attempt-evidence migration remain readable.
  completed?: boolean;
  correct?: boolean;
  evidenceKind?: AttemptEvidenceKind;
  result: ValidationResultV1;
  createdAt: string;
};

export type ProgressSnapshot = {
  sessionsCompleted: number;
  currentStreak: number;
  streakFreezes: number;
  phrasesLearned: number;
  mistakesFixed: number;
  reviewsDue: number;
  attemptsCount: number;
  accuracyPercent: number;
  nextReviewAt?: string;
  habit: {
    tone: "new" | "fresh" | "steady" | "comeback";
    headline: string;
    detail: string;
    daysSinceLastSession?: number;
  };
  nextAction: {
    label: string;
    href: string;
    reason: string;
  };
  recommendations: {
    id: string;
    title: string;
    description: string;
    href: string;
    priority: "now" | "soon" | "later";
  }[];
  mission: {
    title: string;
    completedSteps: number;
    totalSteps: number;
    completionPercent: number;
  };
  recentWins: string[];
  achievements: {
    id: string;
    title: string;
    description: string;
    earned: boolean;
    detail: string;
  }[];
  skills: { label: string; score: number }[];
};

export type TutorContextPackV1 = {
  task: "explain_mistake" | "safe_standard";
  learner: { level: string; goal: string; weakRuleIds: string[] };
  activity: { id: string; prompt: string; type: ActivityType };
  submittedAnswer: string;
  deterministicResult: ValidationResultV1;
  verifiedContent: Pick<ContentItem, "id" | "frenchText" | "englishMeaning" | "register" | "usageContext">[];
  ruleNotes: { id: string; text: string; examples: string[] }[];
  allowedSourceIds: string[];
};

export type TutorFeedbackV1 = {
  status: "supported" | "safe_standard" | "out_of_scope";
  headline: string;
  explanation: string;
  sourceIds: string[];
  followUp: string;
};

export type SocialProfile = {
  userId: string;
  displayName: string;
  friendCode?: string;
  currentLevel: CefrLevel;
  completedSessions: number;
  currentStreak: number;
};

export type FriendRequest = {
  id: string;
  from: SocialProfile;
  to: SocialProfile;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  respondedAt?: string;
};

export type FriendConnection = {
  id: string;
  friend: SocialProfile;
  createdAt: string;
};

export type CoopChallenge = {
  id: string;
  friend: SocialProfile;
  title: string;
  description: string;
  targetSessions: number;
  yourStartingSessions: number;
  friendStartingSessions: number;
  status: "active" | "completed";
  createdAt: string;
  completedAt?: string;
};

export type SocialSnapshot = {
  profile: SocialProfile;
  friendCode: string;
  friends: FriendConnection[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  blockedUserIds: string[];
  activeChallenge?: CoopChallenge;
};
