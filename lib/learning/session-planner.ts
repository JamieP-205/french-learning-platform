import type {
  ActivityDefinition,
  LearnerProfile,
  MistakePattern,
  Mission,
  PlannedActivity,
  ReviewItem,
  SessionMode,
  SessionPlanV1,
} from "@/lib/domain/types";
import { skillForActivityType, skillLabels, type LearnerStats, type SkillKey } from "@/lib/learning/learner-model";

const focusPreferenceSkills: Record<string, SkillKey> = {
  speaking: "speaking",
  listening: "listening",
  writing: "writing",
};

const daysSince = (iso?: string, now = new Date()) => {
  if (!iso) return 0;
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
};

export function selectSessionMode(profile: LearnerProfile, requestedMode?: "normal" | "short", now = new Date()): SessionMode {
  if (daysSince(profile.lastCompletedAt, now) >= 3) return "comeback";
  if (requestedMode === "short" || profile.dailyMinutes <= 3) return "two_minute";
  return "normal";
}

const activityForReview = (mission: Mission, review: ReviewItem) =>
  mission.activities.find((activity) => activity.id === review.activityId) ?? mission.activities[0];

const outputTypes = new Set(["typing", "fill_blank", "sentence_builder", "speak_repeat"]);

export function buildSessionPlan({
  profile,
  mission,
  dueReviews,
  mistakes,
  stats,
  requestedMode,
  now = new Date(),
}: {
  profile: LearnerProfile;
  mission: Mission;
  dueReviews: ReviewItem[];
  mistakes: MistakePattern[];
  stats?: LearnerStats;
  requestedMode?: "normal" | "short";
  now?: Date;
}): SessionPlanV1 {
  const mode = selectSessionMode(profile, requestedMode, now);
  const wantsReviewFocus = profile.focusPreferences?.includes("review") ?? false;
  const due = dueReviews
    .filter((item) => new Date(item.dueAt) <= now)
    .sort((a, b) => b.priority - a.priority || a.dueAt.localeCompare(b.dueAt));
  const repair = mistakes.filter((pattern) => !pattern.resolved).sort((a, b) => b.repeatCount - a.repeatCount)[0];
  const activities: PlannedActivity[] = [];
  const push = (activity: ActivityDefinition | undefined, kind: PlannedActivity["kind"], rationale: string) => {
    if (activity && !activities.some((entry) => entry.activity.id === activity.id)) {
      activities.push({ activity, kind, rationale });
    }
  };

  due.slice(0, mode === "normal" ? (wantsReviewFocus ? 3 : 2) : 1).forEach((review) =>
    push(activityForReview(mission, review), "review", "A due review keeps this useful phrase available when you need it."),
  );

  const missionActivities = mission.activities;
  push(missionActivities.find((activity) => activity.id === "act-name-meaning-v1") ?? missionActivities.find((activity) => activity.type === "multiple_choice"), "mission", "A quick meaning check builds confidence before production.");

  if (repair) {
    // Switch to an activity format the learner has not already failed for this
    // rule; repeating the same failing format rarely fixes anything.
    const repairCandidates = missionActivities.filter((activity) => activity.grammarRuleIds.includes(repair.ruleId));
    const failedTypes = stats?.failedTypesByRule[repair.ruleId] ?? [];
    const freshFormat = repairCandidates.find((activity) => !failedTypes.includes(activity.type));
    push(
      freshFormat ?? repairCandidates[0],
      "repair",
      freshFormat && failedTypes.length > 0 && freshFormat !== repairCandidates[0]
        ? "Same weak point, new format — a different activity type beats repeating the one that failed."
        : "This repairs a pattern that has appeared more than once.",
    );
  }

  if (mode === "normal") {
    push(missionActivities.find((activity) => activity.type === "fill_blank"), "mission", "A short gap-fill turns recognition into recall.");
    push(missionActivities.find((activity) => activity.type === "typing"), "mission", "Typed recall checks that you can produce the sentence, not only recognise it.");
    push(missionActivities.find((activity) => activity.type === "sentence_builder"), "mission", "Reordering the phrase strengthens the sentence pattern.");
    push(missionActivities.find((activity) => activity.type === "dictation"), "mission", "A text-ready dictation step connects sound, spelling, and meaning.");
    push(missionActivities.find((activity) => activity.type === "speak_repeat"), "mission", "A confidence-first spoken repetition completes the mixed-skill session.");
    push(missionActivities.find((activity) => activity.id === "act-register-v1"), "mission", "A register check keeps relaxed spoken French in the right context.");
  } else if (mode === "two_minute") {
    push(missionActivities.find((activity) => activity.type === "fill_blank"), "mission", "One useful recall keeps the session real, even when time is short.");
    push(missionActivities.find((activity) => activity.type === "speak_repeat"), "mission", "Finish with one sentence you can say today.");
  } else {
    push(missionActivities.find((activity) => activity.type === "fill_blank"), "mission", "A familiar recall step makes this a low-pressure return.");
    push(missionActivities.find((activity) => activity.type === "typing"), "mission", "A short written sentence restores confidence.");
  }

  if (!activities.some((entry) => outputTypes.has(entry.activity.type))) {
    push(missionActivities.find((activity) => activity.type === "fill_blank"), "mission", "One short recall task makes this a real learning session.");
  }

  if (mode === "comeback") {
    activities.splice(4);
  }

  // Adaptive emphasis: the weakest evidenced skill (or the learner's chosen
  // focus) moves to the front of the mission work so it is never skipped.
  const emphasisSkill: SkillKey | undefined =
    stats?.weakestSkill ??
    profile.focusPreferences?.map((preference) => focusPreferenceSkills[preference]).find(Boolean);
  if (mode === "normal" && emphasisSkill) {
    const emphasisIndex = activities.findIndex(
      (entry) => entry.kind === "mission" && skillForActivityType(entry.activity.type) === emphasisSkill,
    );
    const firstMissionIndex = activities.findIndex((entry) => entry.kind === "mission");
    if (emphasisIndex > firstMissionIndex && firstMissionIndex >= 0) {
      const [entry] = activities.splice(emphasisIndex, 1);
      activities.splice(firstMissionIndex, 0, {
        ...entry,
        rationale:
          stats?.weakestSkill === emphasisSkill
            ? `Recent answers show ${skillLabels[emphasisSkill]} slipping, so it comes early while you are fresh.`
            : `You asked to work on ${skillLabels[emphasisSkill]}, so it gets the freshest part of the session.`,
      });
    }
  }

  const adaptiveNote =
    mode === "normal" && stats?.weakestSkill
      ? `Recent sessions show ${skillLabels[stats.weakestSkill]} needs attention, so today leans that way. `
      : "";
  const weakFocus =
    adaptiveNote +
    (repair
      ? `Repair: ${repair.explanation}`
      : due.length > 0
        ? "Keep your due phrases fresh before adding more."
        : profile.currentLevel === "A1"
          ? mission.description
          : `Calibration for ${profile.currentLevel}: confirm the verified foundations first, then the app can recommend what to strengthen next.`);

  return {
    id: `plan-${profile.userId}-${now.getTime()}`,
    userId: profile.userId,
    missionId: mission.id,
    missionTitle: mission.title,
    mode,
    estimatedMinutes: mode === "normal" ? mission.estimatedMinutes : mode === "comeback" ? 4 : 2,
    weakFocus,
    activities,
    completionReward:
      mode === "comeback"
        ? "Welcome back—one useful sentence is a real restart."
        : profile.currentLevel === "A1"
          ? "A practical French win, earned through recall."
          : "Calibration evidence saved. The app now has a safer signal for what to recommend next.",
  };
}

