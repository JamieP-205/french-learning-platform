import type {
  ActivityDefinition,
  AttemptEvidenceKind,
  LearnerProfile,
  ProgressSnapshot,
  ReviewItem,
} from "@/lib/domain/types";
import {
  inferEvidenceKind,
  isProductiveActivityType,
  isQualifyingProductiveSuccess,
} from "@/lib/learning/response-transition";
import { calendarDaysSince } from "@/lib/time/calendar-day";

type AttemptSignal = {
  activityId: string;
  isCorrect: boolean;
  activity?: ActivityDefinition;
  evidenceKind?: AttemptEvidenceKind;
  completed?: boolean;
  count?: number;
};

type MistakeSignal = {
  resolved: boolean;
  count?: number;
};

export function daysSince(iso?: string, now = new Date(), timeZone?: string) {
  return calendarDaysSince(iso, now, timeZone);
}

function habitState(profile: LearnerProfile | null, now = new Date()): ProgressSnapshot["habit"] {
  const elapsedDays = daysSince(profile?.lastCompletedAt, now, profile?.timeZone);

  if (elapsedDays === undefined) {
    return {
      tone: "new",
      headline: "Your first lesson is ready.",
      detail: "Start with one practical lesson. Your progress begins after you practise.",
    };
  }

  if (elapsedDays === 0) {
    return {
      tone: "fresh",
      headline: "You already showed up today.",
      detail: "Stop here guilt-free, or do a short review if you want one more useful attempt.",
      daysSinceLastSession: elapsedDays,
    };
  }

  if (elapsedDays <= 2) {
    return {
      tone: "steady",
      headline: "Keep the thread alive.",
      detail: "A short mixed session is enough to keep yesterday’s French reachable.",
      daysSinceLastSession: elapsedDays,
    };
  }

  return {
    tone: "comeback",
    headline: "Gentle comeback, no streak guilt.",
    detail: "The next session is shorter and confidence-first so restarting feels easy.",
    daysSinceLastSession: elapsedDays,
  };
}

function skillScore(correct: number, attempts: number) {
  if (attempts === 0) return 0;

  // Accuracy matters, but a single answer is deliberately weak evidence. Five
  // clean attempts can reach 100; fewer attempts keep the score provisional.
  const accuracy = correct / attempts;
  const accuracyWeight = Math.min(80, attempts * 16);
  const volumeWeight = Math.min(20, attempts * 4);
  return Math.min(100, Math.round(accuracy * accuracyWeight + volumeWeight));
}

function signalCount(attempt: AttemptSignal) {
  const count = attempt.count ?? 1;
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function totalSignalCount(attempts: AttemptSignal[]) {
  return attempts.reduce((total, attempt) => total + signalCount(attempt), 0);
}

function totalMistakeCount(mistakes: MistakeSignal[]) {
  return mistakes.reduce((total, mistake) => {
    const count = mistake.count ?? 1;
    return total + (Number.isFinite(count) && count > 0 ? Math.floor(count) : 0);
  }, 0);
}

function levelPathDetail(profile: LearnerProfile | null) {
  if (!profile || profile.currentLevel === "A1") {
    return "Start with the A1 foundation lesson, then let mistakes and reviews guide what comes next.";
  }

  return `You selected ${profile.currentLevel}. Begin with a short foundation check before moving to harder work.`;
}

function profileTopicRecommendations(
  profile: LearnerProfile | null,
): ProgressSnapshot["recommendations"] {
  if (!profile) return [];

  const goals = profile.learningGoals.map((goal) => goal.toLowerCase());
  const interests = new Set(profile.interests.map((interest) => interest.toLowerCase()));
  const recommendations: ProgressSnapshot["recommendations"] = [];

  const selectedGoal = goals.find((goal) =>
    ["travel", "work", "relationships", "culture", "hobby", "exams"].includes(goal),
  );

  if (selectedGoal === "travel") {
    recommendations.push({
      id: "goal-travel",
      title: "Preview practical travel French",
      description: "Your travel goal points to station, ticket, and getting-unstuck phrases.",
      href: "/learn/travel-basics",
      priority: "later",
    });
  } else if (selectedGoal === "work") {
    recommendations.push({
      id: "goal-work",
      title: "Preview French for work",
      description: "Your work goal points to introductions, clarification, and polite workplace phrases.",
      href: "/learn/work-basics",
      priority: "later",
    });
  } else if (selectedGoal === "relationships" || selectedGoal === "culture" || selectedGoal === "hobby") {
    recommendations.push({
      id: "goal-conversation",
      title: "Preview everyday conversation",
      description: "Your goal benefits from flexible opinions, reasons, and conversation-repair phrases.",
      href: "/learn/everyday-conversation",
      priority: "later",
    });
  } else if (selectedGoal === "exams") {
    recommendations.push({
      id: "goal-exams",
      title: "Strengthen the checked foundation",
      description: "The reviewed A1 lesson is a useful foundation check, not a complete exam-preparation course.",
      href: "/learn/introduce-yourself",
      priority: "later",
    });
  }

  if (
    interests.has("food") &&
    !recommendations.some((recommendation) => recommendation.href === "/learn/cafe-food")
  ) {
    recommendations.push({
      id: "interest-food",
      title: "Preview café French",
      description: "Food is one of your interests, so polite ordering and bill-paying phrases are a relevant stretch.",
      href: "/learn/cafe-food",
      priority: "later",
    });
  } else if (
    interests.has("travel") &&
    !recommendations.some((recommendation) => recommendation.href === "/learn/travel-basics")
  ) {
    recommendations.push({
      id: "interest-travel",
      title: "Preview practical travel French",
      description: "Travel is one of your interests, so station and repair phrases are a relevant next step.",
      href: "/learn/travel-basics",
      priority: "later",
    });
  }

  return recommendations.slice(0, 2);
}

export function buildProgressSnapshot({
  profile,
  attempts,
  reviews,
  mistakes,
  missionTitle,
  missionActivityCount,
  now = new Date(),
}: {
  profile: LearnerProfile | null;
  attempts: AttemptSignal[];
  reviews: ReviewItem[];
  mistakes: MistakeSignal[];
  missionTitle: string;
  missionActivityCount: number;
  now?: Date;
}): ProgressSnapshot {
  const dueReviews = reviews.filter((review) => new Date(review.dueAt) <= now);
  const nextReviewAt = reviews
    .filter((review) => new Date(review.dueAt) > now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt;
  const scoredAttempts = attempts.filter((attempt) =>
    (attempt.evidenceKind ?? (attempt.activity ? inferEvidenceKind(attempt.activity.type) : undefined)) !== "self-report",
  );
  const selfReportedAttempts = attempts.filter((attempt) => attempt.evidenceKind === "self-report");
  const correctAttempts = scoredAttempts.filter((attempt) => attempt.isCorrect);
  const productiveAttempts = scoredAttempts.filter((attempt) =>
    attempt.activity &&
    isProductiveActivityType(attempt.activity.type) &&
    attempt.completed !== false,
  );
  const productiveSuccesses = productiveAttempts.filter((attempt) =>
    attempt.activity && isQualifyingProductiveSuccess({
      activity: attempt.activity,
      completed: attempt.completed !== false,
      correct: attempt.isCorrect,
      evidenceKind: attempt.evidenceKind ?? inferEvidenceKind(attempt.activity.type),
    }),
  );
  const scoredAttemptCount = totalSignalCount(scoredAttempts);
  const correctAttemptCount = totalSignalCount(correctAttempts);
  const productiveAttemptCount = totalSignalCount(productiveAttempts);
  const productiveSuccessCount = totalSignalCount(productiveSuccesses);
  const recalledContentItems = new Set(
    productiveSuccesses.flatMap((attempt) => attempt.activity?.contentItemIds ?? []),
  );
  const completedActivities = new Set(
    scoredAttempts
      .filter((attempt) => attempt.completed !== false)
      .map((attempt) => attempt.activityId),
  );
  const completedSteps = Math.min(missionActivityCount, completedActivities.size);
  const accuracyPercent = scoredAttemptCount
    ? Math.round((correctAttemptCount / scoredAttemptCount) * 100)
    : 0;
  const mistakesFixed = totalMistakeCount(
    mistakes.filter((mistake) => mistake.resolved),
  );
  const mistakeCount = totalMistakeCount(mistakes);
  const habit = habitState(profile, now);

  const achievements: ProgressSnapshot["achievements"] = [
    {
      id: "first-session",
      title: "First session completed",
      description: "Complete one mixed French session.",
      earned: (profile?.completedSessions ?? 0) >= 1,
      detail: "Your first completed session is saved to your progress.",
    },
    {
      id: "real-recall",
      title: "Real recall",
      description: "Produce French instead of only recognising it.",
      earned: productiveSuccessCount > 0,
      detail: "Output practice is where passive knowledge starts becoming usable.",
    },
    {
      id: "mistake-captured",
      title: "Mistake caught",
      description: "Turn one wrong answer into a review item.",
      earned: mistakeCount > 0 || reviews.length > 0,
      detail: "A useful app remembers weak points without shaming you for them.",
    },
    {
      id: "repair-started",
      title: "Review started",
      description: "Resolve or schedule something you missed.",
      earned: mistakesFixed > 0 || dueReviews.length > 0,
      detail: "Review is the pull to come back: small, specific, and actually useful.",
    },
    {
      id: "steady-start",
      title: "Steady start",
      description: "Complete three French sessions.",
      earned: (profile?.completedSessions ?? 0) >= 3,
      detail: "Three completed sessions are enough to start building a repeatable routine.",
    },
    {
      id: "streak-week",
      title: "Seven-day thread",
      description: "Practise seven days in a row and earn a streak freeze.",
      earned: (profile?.currentStreak ?? 0) >= 7,
      detail: "Freezes absorb one missed day, so a normal life never wipes out a real habit.",
    },
    {
      id: "phrases-2",
      title: "Two phrases recalled",
      description: "Recall two different lesson items through productive practice.",
      earned: recalledContentItems.size >= 2,
      detail: "Recall — not recognition — is the score that transfers to real conversation.",
    },
  ];

  const recentWins = [
    (profile?.completedSessions ?? 0) > 0 ? `Completed ${profile?.completedSessions} focused session${profile?.completedSessions === 1 ? "" : "s"}.` : undefined,
    recalledContentItems.size > 0
      ? `Recalled ${recalledContentItems.size} content item${recalledContentItems.size === 1 ? "" : "s"} through productive practice.`
      : undefined,
    mistakeCount > 0 ? "Saved something you missed so it can return in Review." : undefined,
    mistakesFixed > 0 ? `Completed ${mistakesFixed} focused review${mistakesFixed === 1 ? "" : "s"}.` : undefined,
  ].filter(Boolean) as string[];

  if (recentWins.length === 0) {
    recentWins.push("Your first lesson is ready when you are.");
  }

  const nextAction =
    dueReviews.length > 0
      ? {
          label: "Start due review",
          href: "/review",
          reason: "A weak point is due now. Fixing it before new material makes the next session easier.",
        }
      : (profile?.completedSessions ?? 0) === 0
        ? {
            label: "Start first lesson",
            href: "/today",
            reason: "One completed lesson starts your progress, reviews, and first achievement.",
          }
        : habit.tone === "comeback"
          ? {
              label: "Restart gently",
              href: "/today",
              reason: "Your next session is designed as a short confidence-first comeback.",
            }
          : {
              label: "Do today’s mixed session",
              href: "/today",
              reason: nextReviewAt ? "Nothing is due yet, so keep the habit warm with a small mixed session." : "Try another useful repetition while the lesson is fresh.",
            };

  const recommendations: ProgressSnapshot["recommendations"] = [
    {
      id: "level-path",
      title: profile?.currentLevel === "A1" ? "Build the foundation path" : `${profile?.currentLevel ?? "A1"} starting path`,
      description: levelPathDetail(profile),
      href: "/today",
      priority: (profile?.completedSessions ?? 0) === 0 ? "now" : "later",
    },
  ];

  if (dueReviews.length > 0) {
    recommendations.unshift({
      id: "due-review",
      title: "Repair what is due now",
      description: "A scheduled weak point is ready. Review it before adding new material.",
      href: "/review",
      priority: "now",
    });
  }

  if (habit.tone === "comeback") {
    recommendations.unshift({
      id: "comeback",
      title: "Take the gentle comeback route",
      description: "Restart with a shorter session that protects confidence and rebuilds momentum.",
      href: "/today",
      priority: "now",
    });
  }

  if (scoredAttemptCount >= 3 && accuracyPercent < 70) {
    recommendations.push({
      id: "accuracy-repair",
      title: "Slow down for accuracy",
      description: "Recent answers suggest accuracy will help more than speed. Start with a short session or something due in Review.",
      href: dueReviews.length > 0 ? "/review" : "/today",
      priority: "soon",
    });
  }

  if (!scoredAttempts.some((attempt) => attempt.activity?.type === "typing")) {
    recommendations.push({
      id: "writing-signal",
      title: "Add typed recall",
      description: "Complete one writing activity so future grammar practice can respond to your answers.",
      href: "/today",
      priority: "soon",
    });
  }

  recommendations.push(...profileTopicRecommendations(profile));

  const writingAttempts = scoredAttempts.filter((attempt) => attempt.activity?.type === "typing");
  const listeningAttempts = scoredAttempts.filter((attempt) => attempt.activity?.type === "dictation");
  const speakingPracticeAttempts = selfReportedAttempts.filter(
    (attempt) => attempt.activity?.type === "speak_repeat",
  );
  const writingAttemptCount = totalSignalCount(writingAttempts);
  const correctWritingAttemptCount = totalSignalCount(
    writingAttempts.filter((attempt) => attempt.isCorrect),
  );
  const listeningAttemptCount = totalSignalCount(listeningAttempts);
  const correctListeningAttemptCount = totalSignalCount(
    listeningAttempts.filter((attempt) => attempt.isCorrect),
  );
  const speakingPracticeAttemptCount = totalSignalCount(speakingPracticeAttempts);
  const orderedRecommendations = [
    ...recommendations.filter((recommendation) => recommendation.priority === "now"),
    ...recommendations.filter(
      (recommendation) =>
        recommendation.id.startsWith("goal-") || recommendation.id.startsWith("interest-"),
    ),
    ...recommendations.filter(
      (recommendation) =>
        recommendation.priority === "soon" &&
        !recommendation.id.startsWith("goal-") &&
        !recommendation.id.startsWith("interest-"),
    ),
    ...recommendations.filter(
      (recommendation) =>
        recommendation.priority === "later" &&
        !recommendation.id.startsWith("goal-") &&
        !recommendation.id.startsWith("interest-"),
    ),
  ];

  return {
    sessionsCompleted: profile?.completedSessions ?? 0,
    currentStreak: profile?.currentStreak ?? 0,
    streakFreezes: profile?.streakFreezes ?? 0,
    phrasesLearned: recalledContentItems.size,
    mistakesFixed,
    reviewsDue: dueReviews.length,
    attemptsCount: scoredAttemptCount,
    accuracyPercent,
    nextReviewAt,
    habit,
    nextAction,
    recommendations: orderedRecommendations.slice(0, 4),
    mission: {
      title: missionTitle,
      completedSteps,
      totalSteps: missionActivityCount,
      completionPercent: missionActivityCount > 0 ? Math.round((completedSteps / missionActivityCount) * 100) : 0,
    },
    recentWins,
    achievements,
    skills: [
      {
        label: "Recall",
        score: skillScore(productiveSuccessCount, productiveAttemptCount),
        practiceAttempts: productiveAttemptCount,
        measuredAttempts: productiveAttemptCount,
      },
      {
        label: "Writing",
        score: skillScore(
          correctWritingAttemptCount,
          writingAttemptCount,
        ),
        practiceAttempts: writingAttemptCount,
        measuredAttempts: writingAttemptCount,
      },
      {
        label: "Listening",
        score: skillScore(
          correctListeningAttemptCount,
          listeningAttemptCount,
        ),
        practiceAttempts: listeningAttemptCount,
        measuredAttempts: listeningAttemptCount,
      },
      {
        label: "Speaking",
        score: null,
        practiceAttempts: speakingPracticeAttemptCount,
        measuredAttempts: 0,
      },
    ],
  };
}
