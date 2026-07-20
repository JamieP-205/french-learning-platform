import {
  calendarDayKey,
  calendarDaysSince,
  detectRuntimeTimeZone,
} from "@/lib/time/calendar-day";

export const localLearningStorageKey = "bonjour:public-demo-progress-v1";
export const localProgressUpdatedEvent = "bonjour-local-progress-updated";

export type LocalTopicPreviewProgress = {
  confidentPrompts: string[];
  needsReviewPrompts: string[];
  lastPractisedAt?: string;
};

export type LocalSkillKey =
  | "meaning"
  | "grammar"
  | "sentence_building"
  | "listening"
  | "speaking"
  | "register"
  | "preview_recall";

export type LocalSkillSignal = {
  attempts: number;
  correct: number;
  needsReview: number;
  lastPractisedAt?: string;
};

export type LocalLearnerPreferences = {
  displayName: string;
  currentLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  primaryGoal: "travel" | "work" | "relationships" | "hobby" | "food";
  dailyMinutes: number;
  sessionEnergy: "low" | "normal" | "challenge";
  speechSpeed: "normal" | "slow";
  themePreference: "light" | "dark" | "system";
  companionQuiet: boolean;
  updatedAt?: string;
};

export type LocalLearningProgress = {
  sessionsCompleted: number;
  attemptsCount: number;
  correctCount: number;
  mistakesCaptured: number;
  repairsCompleted: number;
  mistakePrompts: string[];
  weakActivityIds: string[];
  topicPreviewStats: Record<string, LocalTopicPreviewProgress>;
  skillSignals: Partial<Record<LocalSkillKey, LocalSkillSignal>>;
  activeDates: string[];
  preferences: LocalLearnerPreferences;
  lastCompletedAt?: string;
};

export type LocalLearningAchievement = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
};

export type LocalLearningPathStep = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  current: boolean;
};

export type LocalLearningNextAction = {
  label: string;
  title: string;
  reason: string;
  href: string;
  tone: "start" | "repair" | "comeback" | "continue";
};

export type LocalSkillReadiness = {
  key: LocalSkillKey;
  label: string;
  attempts: number;
  accuracy: number;
  needsReview: number;
  status: "new" | "repair" | "building" | "strong";
};

export type LocalLevelRoadmapStep = {
  level: LocalLearnerPreferences["currentLevel"];
  title: string;
  status: "calibrate" | "active" | "preview" | "later";
  description: string;
};

export type LocalDailyPlanStep = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  href: string;
  label: string;
  estimatedMinutes: number;
};

export const defaultLocalLearnerPreferences: LocalLearnerPreferences = {
  displayName: "there",
  currentLevel: "A1",
  primaryGoal: "travel",
  dailyMinutes: 8,
  sessionEnergy: "normal",
  speechSpeed: "normal",
  themePreference: "system",
  companionQuiet: false,
};

export const emptyLocalLearningProgress: LocalLearningProgress = {
  sessionsCompleted: 0,
  attemptsCount: 0,
  correctCount: 0,
  mistakesCaptured: 0,
  repairsCompleted: 0,
  mistakePrompts: [],
  weakActivityIds: [],
  topicPreviewStats: {},
  skillSignals: {},
  activeDates: [],
  preferences: defaultLocalLearnerPreferences,
};

export function loadLocalLearningProgress(): LocalLearningProgress {
  if (typeof window === "undefined") return emptyLocalLearningProgress;

  try {
    const stored = window.localStorage.getItem(localLearningStorageKey);
    if (!stored) return emptyLocalLearningProgress;
    const parsed = JSON.parse(stored);
    return {
      ...emptyLocalLearningProgress,
      ...parsed,
      topicPreviewStats: parsed.topicPreviewStats ?? {},
      skillSignals: parsed.skillSignals ?? {},
      activeDates: parsed.activeDates ?? [],
      preferences: {
        ...defaultLocalLearnerPreferences,
        ...(parsed.preferences ?? {}),
      },
    };
  } catch {
    return emptyLocalLearningProgress;
  }
}

export function saveLocalLearningProgress(progress: LocalLearningProgress) {
  try {
    window.localStorage.setItem(localLearningStorageKey, JSON.stringify(progress));
    window.dispatchEvent(new Event(localProgressUpdatedEvent));
  } catch {
    // Local progress is a convenience only. The public learner path still works without storage.
  }
}

export function resetLocalLearningProgress() {
  try {
    window.localStorage.removeItem(localLearningStorageKey);
    window.dispatchEvent(new Event(localProgressUpdatedEvent));
  } catch {
    // Ignore storage errors.
  }
}

export function localLearningAccuracy(progress: LocalLearningProgress) {
  return progress.attemptsCount > 0 ? Math.round((progress.correctCount / progress.attemptsCount) * 100) : 0;
}

export function localLearningDaysSince(
  iso?: string,
  now = new Date(),
  timeZone = detectRuntimeTimeZone(),
) {
  return calendarDaysSince(iso, now, timeZone);
}

export function localLearningStreak(
  progress: LocalLearningProgress,
  now = new Date(),
  timeZone = detectRuntimeTimeZone(),
) {
  const activeDates = new Set(progress.activeDates ?? []);
  const cursor = new Date(now);
  if (!activeDates.has(calendarDayKey(cursor, timeZone))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (activeDates.has(calendarDayKey(cursor, timeZone)) && streak <= 365) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function skillLabel(key: LocalSkillKey) {
  return {
    meaning: "Understanding",
    grammar: "Grammar accuracy",
    sentence_building: "Sentence building",
    listening: "Listening / dictation",
    speaking: "Speaking self-check",
    register: "Register choice",
    preview_recall: "Preview recall",
  }[key];
}

export function recordLocalActiveDate(
  progress: LocalLearningProgress,
  now = new Date(),
  timeZone = detectRuntimeTimeZone(),
): LocalLearningProgress {
  return {
    ...progress,
    activeDates: unique([calendarDayKey(now, timeZone), ...(progress.activeDates ?? [])]).slice(0, 30),
  };
}

export function recordLocalSkillAttempt({
  progress,
  skill,
  correct,
  now = new Date(),
}: {
  progress: LocalLearningProgress;
  skill: LocalSkillKey;
  correct: boolean;
  now?: Date;
}): LocalLearningProgress {
  const current = progress.skillSignals[skill] ?? { attempts: 0, correct: 0, needsReview: 0 };

  return recordLocalActiveDate(
    {
      ...progress,
      skillSignals: {
        ...progress.skillSignals,
        [skill]: {
          attempts: current.attempts + 1,
          correct: current.correct + (correct ? 1 : 0),
          needsReview: Math.max(0, current.needsReview + (correct ? -1 : 1)),
          lastPractisedAt: now.toISOString(),
        },
      },
    },
    now,
  );
}

export function skillForLocalActivity(activity: {
  type: string;
  prompt: string;
  grammarRuleIds?: string[];
}): LocalSkillKey {
  if (activity.type === "fill_blank" || activity.type === "typing") return "grammar";
  if (activity.type === "sentence_builder") return "sentence_building";
  if (activity.type === "dictation") return "listening";
  if (activity.type === "speak_repeat") return "speaking";
  if (/casual|formal|register|spoken/i.test(activity.prompt)) return "register";
  return "meaning";
}

export function recordLocalTopicPreviewCheck({
  progress,
  topicSlug,
  prompt,
  confident,
  now = new Date(),
}: {
  progress: LocalLearningProgress;
  topicSlug: string;
  prompt: string;
  confident: boolean;
  now?: Date;
}): LocalLearningProgress {
  const current = progress.topicPreviewStats[topicSlug] ?? {
    confidentPrompts: [],
    needsReviewPrompts: [],
  };

  const nextProgress = {
    ...progress,
    topicPreviewStats: {
      ...progress.topicPreviewStats,
      [topicSlug]: {
        confidentPrompts: confident
          ? unique([prompt, ...current.confidentPrompts])
          : current.confidentPrompts.filter((item) => item !== prompt),
        needsReviewPrompts: confident
          ? current.needsReviewPrompts.filter((item) => item !== prompt)
          : unique([prompt, ...current.needsReviewPrompts]),
        lastPractisedAt: now.toISOString(),
      },
    },
  };

  return recordLocalSkillAttempt({
    progress: nextProgress,
    skill: "preview_recall",
    correct: confident,
    now,
  });
}

export function localTopicPreviewSummary(progress: LocalLearningProgress, topicSlug: string) {
  const topic = progress.topicPreviewStats[topicSlug];
  const confidentPrompts = topic?.confidentPrompts ?? [];
  const needsReviewPrompts = topic?.needsReviewPrompts ?? [];
  const seenPrompts = unique([...confidentPrompts, ...needsReviewPrompts]);

  return {
    seenCount: seenPrompts.length,
    confidentCount: confidentPrompts.length,
    needsReviewCount: needsReviewPrompts.length,
    needsReviewPrompts,
    lastPractisedAt: topic?.lastPractisedAt,
  };
}

function firstTopicNeedingPreviewReview(progress: LocalLearningProgress) {
  return Object.entries(progress.topicPreviewStats).find(([, stats]) => stats.needsReviewPrompts.length > 0);
}

function localGoalTopic(progress: LocalLearningProgress) {
  const goal = progress.preferences.primaryGoal;

  if (goal === "travel") {
    return {
      href: "/learn/travel-basics",
      title: "Travel basics",
      reason: "Travel is your main goal, so station and rescue phrases should stay visible.",
    };
  }

  if (goal === "work") {
    return {
      href: "/learn/work-basics",
      title: "Work basics",
      reason: "Work is your main goal, so polite clarification and role phrases are worth warming up.",
    };
  }

  if (goal === "food") {
    return {
      href: "/learn/cafe-food",
      title: "Cafe and food",
      reason: "Food is your main goal, so polite ordering phrases are a practical next stretch.",
    };
  }

  return {
    href: "/learn/everyday-conversation",
    title: "Everyday conversation",
    reason:
      goal === "relationships"
        ? "Relationships need simple opinions, reasons, and repair phrases."
        : "Your hobby goal benefits from flexible everyday conversation frames.",
  };
}

export function updateLocalLearnerPreferences(
  progress: LocalLearningProgress,
  preferences: Partial<LocalLearnerPreferences>,
  now = new Date(),
): LocalLearningProgress {
  return {
    ...progress,
    preferences: {
      ...progress.preferences,
      ...preferences,
      dailyMinutes: Math.min(60, Math.max(2, preferences.dailyMinutes ?? progress.preferences.dailyMinutes)),
      updatedAt: now.toISOString(),
    },
  };
}

export function localLearnerPreferenceSummary(progress: LocalLearningProgress) {
  const { currentLevel, primaryGoal, dailyMinutes, sessionEnergy } = progress.preferences;
  const energyLabel =
    sessionEnergy === "low" ? "gentle" : sessionEnergy === "challenge" ? "challenge-ready" : "balanced";

  return {
    headline: `${currentLevel} · ${primaryGoal} · ${dailyMinutes} min`,
    detail: `Your sessions will feel ${energyLabel}, with more ${primaryGoal} examples when they fit the lesson.`,
  };
}

export function localLearningAchievements(progress: LocalLearningProgress): LocalLearningAchievement[] {
  const accuracy = localLearningAccuracy(progress);

  return [
    {
      id: "first-session",
      title: "First useful session",
      description: "You completed your first introduction lesson.",
      earned: progress.sessionsCompleted > 0,
    },
    {
      id: "mistake-captured",
      title: "Mistake caught",
      description: "Something you missed was saved so it can return in Review.",
      earned: progress.mistakesCaptured > 0 || progress.mistakePrompts.length > 0,
    },
    {
      id: "repair-loop",
      title: "Focused practice ready",
      description: "A missed answer was saved for focused practice or has already been reviewed.",
      earned: progress.repairsCompleted > 0 || progress.weakActivityIds.length > 0,
    },
    {
      id: "steady-recall",
      title: "Steady recall",
      description: "Reach 80%+ accuracy after at least one full session on this device.",
      earned: progress.sessionsCompleted > 0 && accuracy >= 80,
    },
    {
      id: "topic-explorer",
      title: "Practical explorer",
      description: "Try a café or travel self-check without creating an account.",
      earned: Object.keys(progress.topicPreviewStats).length > 0,
    },
    {
      id: "three-active-days",
      title: "Reliable comeback",
      description: "Practise on three separate days without any streak pressure.",
      earned: (progress.activeDates ?? []).length >= 3,
    },
    {
      id: "skill-balanced",
      title: "Mixed-skill learner",
      description: "Practise at least four skill areas, not just one answer type.",
      earned: Object.values(progress.skillSignals ?? {}).filter((signal) => signal.attempts > 0).length >= 4,
    },
  ];
}

export function localLearningPath(progress: LocalLearningProgress): LocalLearningPathStep[] {
  const hasSession = progress.sessionsCompleted > 0;
  const hasMistake = progress.mistakesCaptured > 0 || progress.mistakePrompts.length > 0;
  const hasWeakPoint = progress.weakActivityIds.length > 0;

  return [
    {
      id: "start",
      title: "Start with practical A1 French",
      description: "Complete the guided introduction lesson and check each answer as you go.",
      complete: hasSession,
      current: !hasSession,
    },
    {
      id: "capture",
      title: "Save checked answers",
      description: hasMistake
        ? "A missed answer is saved so it can come back as useful practice."
        : "Correct and incorrect answers both shape what the app recommends next.",
      complete: hasSession,
      current: false,
    },
    {
      id: "repair",
      title: "Review mistakes first",
      description: "Your next session prioritises missed activities before adding more work.",
      complete: hasSession && !hasWeakPoint,
      current: hasWeakPoint,
    },
    {
      id: "expand",
      title: "Expand into new situations",
      description: "Use the topic map to preview café, travel, and later casual French.",
      complete: Object.keys(progress.topicPreviewStats).length > 0,
      current: hasSession && !hasWeakPoint && Object.keys(progress.topicPreviewStats).length === 0,
    },
  ];
}

export function localSkillReadiness(progress: LocalLearningProgress): LocalSkillReadiness[] {
  const skillOrder: LocalSkillKey[] = [
    "meaning",
    "grammar",
    "sentence_building",
    "listening",
    "speaking",
    "register",
    "preview_recall",
  ];

  return skillOrder.map((key) => {
    const signal = progress.skillSignals[key] ?? { attempts: 0, correct: 0, needsReview: 0 };
    const accuracy = signal.attempts > 0 ? Math.round((signal.correct / signal.attempts) * 100) : 0;
    const status =
      signal.attempts === 0
        ? "new"
        : signal.needsReview > 0 || accuracy < 70
          ? "repair"
          : signal.attempts >= 2 && accuracy >= 80
            ? "strong"
            : "building";

    return {
      key,
      label: skillLabel(key),
      attempts: signal.attempts,
      accuracy,
      needsReview: signal.needsReview,
      status,
    };
  });
}

export function localLevelRoadmap(progress: LocalLearningProgress): LocalLevelRoadmapStep[] {
  const selectedLevel = progress.preferences.currentLevel;
  const levels: LocalLearnerPreferences["currentLevel"][] = ["A1", "A2", "B1", "B2", "C1", "C2"];

  return levels.map((level) => {
    const status =
      level === "A1" && progress.sessionsCompleted > 0
        ? "active"
        : level === selectedLevel
          ? "calibrate"
          : level === "A1"
        ? "preview"
        : "later";

    return {
      level,
      status,
      title:
        level === "A1"
          ? "Survive first conversations"
          : level === "A2"
            ? "Handle everyday situations"
            : level === "B1"
              ? "Explain, narrate, and fill gaps"
              : level === "B2"
                ? "Discuss with confidence"
                : level === "C1"
                  ? "Use nuance and register"
                  : "Polish near-native precision",
      description:
        status === "active"
          ? "Your completed practice is from the reviewed A1 introduction lesson."
          : status === "calibrate"
            ? level === "A1"
              ? "This is your selected level; the reviewed introduction lesson is available now."
              : `You selected ${level}. The available A1 check cannot confirm this level, and a full ${level} course is not available yet.`
            : status === "preview"
              ? "The reviewed A1 introduction can be used as a foundation check; it does not confirm a higher level."
              : "Full reviewed lessons at this level are not available yet.",
    };
  });
}

export function localDailyPlan(progress: LocalLearningProgress): LocalDailyPlanStep[] {
  const preferences = progress.preferences;
  const shortLesson = preferences.sessionEnergy === "low" || preferences.dailyMinutes <= 3;
  const lessonHref = shortLesson ? "/demo?mode=short" : "/demo";
  const totalMinutes =
    preferences.sessionEnergy === "low"
      ? Math.min(5, preferences.dailyMinutes)
      : preferences.sessionEnergy === "challenge"
        ? Math.min(18, Math.max(10, preferences.dailyMinutes))
        : preferences.dailyMinutes;
  const firstTopicReview = firstTopicNeedingPreviewReview(progress);
  const goalTopic = localGoalTopic(progress);
  const firstStep =
    progress.weakActivityIds.length > 0
      ? {
          id: "repair-lesson",
          kicker: "Review first",
          title: "Revisit the thing that tripped you up.",
          description: progress.mistakePrompts[0] ?? "Your introduction lesson has a weak point ready to practise.",
          href: lessonHref,
          label: "Start review",
        }
      : firstTopicReview
        ? {
            id: "repair-preview",
            kicker: "Recall first",
            title: "Bring back a preview phrase.",
            description: `${firstTopicReview[1].needsReviewPrompts.length} phrase${firstTopicReview[1].needsReviewPrompts.length === 1 ? "" : "s"} need another look before new material.`,
            href: "/review",
            label: "Start review",
          }
        : {
            id: "foundation",
            kicker: progress.sessionsCompleted > 0 ? "Warm up" : "Start here",
            title:
              preferences.currentLevel === "A1"
                ? "Build a strong introduction foundation."
                : "Use the A1 introduction as a foundation check.",
            description:
              preferences.currentLevel === "A1"
                ? shortLesson
                  ? "Use two quick checks for phrase meaning and a basic sentence pattern."
                  : "Use a short lesson with meaning, grammar, listening, speaking, and formality checks."
                : `This lesson covers A1 basics only. It does not assess or teach a full ${preferences.currentLevel} course.`,
            href: lessonHref,
            label: progress.sessionsCompleted > 0 ? "Warm up" : "Start",
          };

  const lessonStep: LocalDailyPlanStep = {
    ...firstStep,
    // Describe the lesson that actually opens instead of assigning it an
    // arbitrary fraction of the learner's daily target.
    estimatedMinutes: shortLesson ? 2 : 10,
  };
  const goalStep: LocalDailyPlanStep = {
    id: "goal-stretch",
    kicker: "Goal stretch",
    title: goalTopic.title,
    description: goalTopic.reason,
    href: goalTopic.href,
    label: "Open goal topic",
    estimatedMinutes: shortLesson ? Math.max(1, totalMinutes - 3) : Math.max(2, Math.round(totalMinutes * 0.35)),
  };
  const finishStep: LocalDailyPlanStep = {
    id: "finish",
    kicker: "Finish well",
    title: preferences.sessionEnergy === "low" ? "Stop after one clear win." : "End with a win, not guilt.",
    description:
      preferences.sessionEnergy === "challenge"
        ? "Finish by checking Progress and choosing one extra review only if it still feels useful."
        : "Check what improved, then stop while the session still feels successful.",
    href: "/progress",
    label: "See progress",
    estimatedMinutes: 1,
  };

  if (!shortLesson) return [lessonStep, goalStep, finishStep];
  if (totalMinutes <= 2) return [lessonStep];
  if (totalMinutes === 3) return [lessonStep, finishStep];
  return [lessonStep, goalStep, finishStep];
}

export function localLearningNextAction(progress: LocalLearningProgress): LocalLearningNextAction {
  const daysAway = localLearningDaysSince(progress.lastCompletedAt);
  const topicNeedingReview = firstTopicNeedingPreviewReview(progress);
  const preferences = progress.preferences;
  const lessonHref =
    preferences.sessionEnergy === "low" || preferences.dailyMinutes <= 3
      ? "/demo?mode=short"
      : "/demo";

  if (daysAway !== undefined && daysAway >= 3) {
    return {
      label: "Restart gently",
      title: "Come back with one small win.",
      reason: "You have been away for a few days, so the best next session should feel confidence-first.",
      href: lessonHref,
      tone: "comeback",
    };
  }

  if (progress.weakActivityIds.length > 0) {
    return {
      label: "Review weak point",
      title: "Start with what tripped you up.",
      reason: "A missed answer is saved in this browser, so another try comes before new material.",
      href: lessonHref,
      tone: "repair",
    };
  }

  if (topicNeedingReview) {
    const [topicSlug, stats] = topicNeedingReview;
    return {
      label: "Review preview phrase",
      title: "Bring back a practical phrase you marked for review.",
      reason: `${stats.needsReviewPrompts.length} preview self-check${stats.needsReviewPrompts.length === 1 ? "" : "s"} need another look.`,
      href: `/learn/${topicSlug}`,
      tone: "repair",
    };
  }

  if (progress.sessionsCompleted > 0) {
    return {
      label: "Continue the path",
      title: "Keep the foundation warm.",
      reason: `You have a completed session; another ${preferences.sessionEnergy === "low" ? "gentle" : "short"} pass will strengthen recall for your ${preferences.primaryGoal} goal.`,
      href: lessonHref,
      tone: "continue",
    };
  }

  return {
    label: "Start lesson",
    title: preferences.currentLevel === "A1" ? "Begin with the introduction lesson." : "Use the A1 introduction as a foundation check.",
    reason:
      preferences.currentLevel === "A1"
        ? "No account is needed. This session and its review reminders stay in this browser."
        : `You selected ${preferences.currentLevel}. This reviewed lesson covers A1 basics and does not confirm your wider level.`,
    href: lessonHref,
    tone: "start",
  };
}
