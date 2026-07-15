import type { LearnerProfile, ProgressSnapshot, ReviewItem } from "@/lib/domain/types";

type AttemptSignal = {
  activityId: string;
  isCorrect: boolean;
};

type MistakeSignal = {
  resolved: boolean;
};

export function daysSince(iso?: string, now = new Date()) {
  if (!iso) return undefined;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

function habitState(profile: LearnerProfile | null, now = new Date()): ProgressSnapshot["habit"] {
  const elapsedDays = daysSince(profile?.lastCompletedAt, now);

  if (elapsedDays === undefined) {
    return {
      tone: "new",
      headline: "Your first real win is waiting.",
      detail: "Start with one practical mission. The app will track evidence only after you practise.",
    };
  }

  if (elapsedDays === 0) {
    return {
      tone: "fresh",
      headline: "You already showed up today.",
      detail: "Stop here guilt-free, or do a short repair if you want one more useful rep.",
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

function skillScore(base: number, completed: number, attempts: number) {
  return Math.min(100, base + completed * 14 + Math.max(0, attempts - completed) * 3);
}

function levelPathDetail(profile: LearnerProfile | null) {
  if (!profile || profile.currentLevel === "A1") {
    return "Start with the verified A1 mission, then let mistakes and reviews decide what comes next.";
  }

  return `You marked ${profile.currentLevel}. This public release uses the verified A1 mission as a calibration check before recommending harder work.`;
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
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect);
  const correctActivities = new Set(correctAttempts.map((attempt) => attempt.activityId));
  const attemptedActivities = new Set(attempts.map((attempt) => attempt.activityId));
  const completedSteps = Math.min(missionActivityCount, attemptedActivities.size);
  const accuracyPercent = attempts.length ? Math.round((correctAttempts.length / attempts.length) * 100) : 0;
  const mistakesFixed = mistakes.filter((mistake) => mistake.resolved).length;
  const habit = habitState(profile, now);

  const achievements: ProgressSnapshot["achievements"] = [
    {
      id: "first-session",
      title: "First mission record",
      description: "Complete one mixed French session.",
      earned: (profile?.completedSessions ?? 0) >= 1,
      detail: "This proves the app can store real learning evidence.",
    },
    {
      id: "real-recall",
      title: "Real recall",
      description: "Produce French instead of only recognising it.",
      earned: attempts.some((attempt) =>
        ["typing", "fill", "builder", "dictation", "speak"].some((keyword) => attempt.activityId.includes(keyword)),
      ),
      detail: "Output practice is where passive knowledge starts becoming usable.",
    },
    {
      id: "mistake-captured",
      title: "Mistake caught",
      description: "Turn one wrong answer into a review item.",
      earned: mistakes.length > 0 || reviews.length > 0,
      detail: "A useful app remembers weak points without shaming you for them.",
    },
    {
      id: "repair-started",
      title: "Repair loop started",
      description: "Resolve or schedule a weak point.",
      earned: mistakesFixed > 0 || dueReviews.length > 0,
      detail: "Review is the pull to come back: small, specific, and actually useful.",
    },
    {
      id: "spoken-out-loud",
      title: "Said it out loud",
      description: "Complete a speaking step instead of skipping it.",
      earned: correctAttempts.some((attempt) => attempt.activityId.includes("speak")),
      detail: "Speaking early is the habit that separates learners who can talk from learners who can tap.",
    },
    {
      id: "streak-week",
      title: "Seven-day thread",
      description: "Practise seven days in a row and earn a streak freeze.",
      earned: (profile?.currentStreak ?? 0) >= 7,
      detail: "Freezes absorb one missed day, so a normal life never wipes out a real habit.",
    },
    {
      id: "phrases-25",
      title: "25 phrases recalled",
      description: "Recall 25 different activities correctly.",
      earned: correctActivities.size >= 25,
      detail: "Recall — not recognition — is the score that transfers to real conversation.",
    },
  ];

  const recentWins = [
    (profile?.completedSessions ?? 0) > 0 ? `Completed ${profile?.completedSessions} focused session${profile?.completedSessions === 1 ? "" : "s"}.` : undefined,
    correctActivities.size > 0 ? `Recalled ${correctActivities.size} activity${correctActivities.size === 1 ? "" : "ies"} correctly.` : undefined,
    mistakes.length > 0 ? "Captured a real weak point for review instead of losing it." : undefined,
    mistakesFixed > 0 ? `Repaired ${mistakesFixed} weak point${mistakesFixed === 1 ? "" : "s"}.` : undefined,
  ].filter(Boolean) as string[];

  if (recentWins.length === 0) {
    recentWins.push("Your first useful mission is ready to create real progress data.");
  }

  const nextAction =
    dueReviews.length > 0
      ? {
          label: "Repair due review",
          href: "/review",
          reason: "A weak point is due now. Fixing it before new material makes the next session easier.",
        }
      : (profile?.completedSessions ?? 0) === 0
        ? {
            label: "Start first mission",
            href: "/today",
            reason: "One complete mission unlocks progress evidence, review, and the first achievement.",
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
              reason: nextReviewAt ? "Nothing is due yet, so keep the habit warm with a small mixed session." : "Build another useful repetition while the mission is fresh.",
            };

  const recommendations: ProgressSnapshot["recommendations"] = [
    {
      id: "level-path",
      title: profile?.currentLevel === "A1" ? "Build the foundation path" : `${profile?.currentLevel ?? "A1"} calibration path`,
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

  if (attempts.length >= 3 && accuracyPercent < 70) {
    recommendations.push({
      id: "accuracy-repair",
      title: "Slow down for accuracy",
      description: "Your recent evidence suggests repair will help more than speed. Use the short session or review queue first.",
      href: dueReviews.length > 0 ? "/review" : "/today",
      priority: "soon",
    });
  }

  if (!attempts.some((attempt) => attempt.activityId.includes("typing"))) {
    recommendations.push({
      id: "writing-signal",
      title: "Add typed recall",
      description: "The app needs at least one writing signal to recommend weak grammar more reliably.",
      href: "/today",
      priority: "soon",
    });
  }

  if ((profile?.learningGoals ?? []).includes("travel")) {
    recommendations.push({
      id: "travel-next",
      title: "Keep travel French practical",
      description: "After the introduction mission, browse café and travel previews to see the next useful scenarios.",
      href: "/learn",
      priority: "later",
    });
  }

  return {
    sessionsCompleted: profile?.completedSessions ?? 0,
    currentStreak: profile?.currentStreak ?? 0,
    streakFreezes: profile?.streakFreezes ?? 0,
    phrasesLearned: correctActivities.size,
    mistakesFixed,
    reviewsDue: dueReviews.length,
    attemptsCount: attempts.length,
    accuracyPercent,
    nextReviewAt,
    habit,
    nextAction,
    recommendations: recommendations.slice(0, 4),
    mission: {
      title: missionTitle,
      completedSteps,
      totalSteps: missionActivityCount,
      completionPercent: missionActivityCount > 0 ? Math.round((completedSteps / missionActivityCount) * 100) : 0,
    },
    recentWins,
    achievements,
    skills: [
      { label: "Recall", score: skillScore(25, correctActivities.size, attempts.length) },
      { label: "Writing", score: skillScore(20, correctAttempts.filter((attempt) => attempt.activityId.includes("typing")).length, attempts.filter((attempt) => attempt.activityId.includes("typing")).length) },
      { label: "Listening", score: skillScore(15, correctAttempts.filter((attempt) => attempt.activityId.includes("dictation")).length, attempts.filter((attempt) => attempt.activityId.includes("dictation")).length) },
      { label: "Speaking", score: skillScore(15, correctAttempts.filter((attempt) => attempt.activityId.includes("speak")).length, attempts.filter((attempt) => attempt.activityId.includes("speak")).length) },
    ],
  };
}
