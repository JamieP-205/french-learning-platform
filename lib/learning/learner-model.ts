import type { ActivityAttempt, ActivityDefinition } from "@/lib/domain/types";

export type SkillKey = "recognition" | "grammar" | "writing" | "listening" | "speaking";

export type SkillStat = {
  attempts: number;
  correct: number;
  accuracy: number;
  averageLatencyMs: number | null;
};

export type LearnerStats = {
  totalAttempts: number;
  skills: Record<SkillKey, SkillStat>;
  // Weakest skill with enough evidence to act on. Undefined until at least
  // three attempts exist for some skill, so one bad answer never flips the mix.
  weakestSkill?: SkillKey;
  // Correct answers that took a long time: recall exists but is fragile.
  slowRecallActivityIds: string[];
  // Activity types already failed per grammar rule, so repair can switch
  // format instead of repeating the same failure.
  failedTypesByRule: Record<string, string[]>;
};

const SLOW_RECALL_MS = 8_000;
const MIN_EVIDENCE = 3;

export function skillForActivityType(type: ActivityDefinition["type"]): SkillKey {
  switch (type) {
    case "multiple_choice":
      return "recognition";
    case "fill_blank":
    case "sentence_builder":
      return "grammar";
    case "typing":
      return "writing";
    case "dictation":
      return "listening";
    case "speak_repeat":
      return "speaking";
  }
}

function emptySkillStat(): SkillStat {
  return { attempts: 0, correct: 0, accuracy: 0, averageLatencyMs: null };
}

export function buildLearnerStats(
  attempts: ActivityAttempt[],
  activityById: Map<string, ActivityDefinition>,
): LearnerStats {
  const skills: Record<SkillKey, SkillStat> = {
    recognition: emptySkillStat(),
    grammar: emptySkillStat(),
    writing: emptySkillStat(),
    listening: emptySkillStat(),
    speaking: emptySkillStat(),
  };
  const latencyTotals: Record<SkillKey, number> = { recognition: 0, grammar: 0, writing: 0, listening: 0, speaking: 0 };
  const slowRecallActivityIds: string[] = [];
  const failedTypesByRule: Record<string, string[]> = {};

  for (const attempt of attempts) {
    const activity = activityById.get(attempt.activityId);
    if (!activity) continue;
    const skill = skillForActivityType(activity.type);
    const stat = skills[skill];
    stat.attempts += 1;
    if (attempt.result.isCorrect) {
      stat.correct += 1;
      if (attempt.latencyMs >= SLOW_RECALL_MS && !slowRecallActivityIds.includes(attempt.activityId)) {
        slowRecallActivityIds.push(attempt.activityId);
      }
    } else {
      for (const ruleId of attempt.result.ruleIds) {
        const failedTypes = failedTypesByRule[ruleId] ?? [];
        if (!failedTypes.includes(activity.type)) failedTypes.push(activity.type);
        failedTypesByRule[ruleId] = failedTypes;
      }
    }
    latencyTotals[skill] += attempt.latencyMs;
  }

  let weakestSkill: SkillKey | undefined;
  for (const key of Object.keys(skills) as SkillKey[]) {
    const stat = skills[key];
    stat.accuracy = stat.attempts > 0 ? stat.correct / stat.attempts : 0;
    stat.averageLatencyMs = stat.attempts > 0 ? Math.round(latencyTotals[key] / stat.attempts) : null;
    if (stat.attempts >= MIN_EVIDENCE && (!weakestSkill || stat.accuracy < skills[weakestSkill].accuracy)) {
      weakestSkill = key;
    }
  }

  return {
    totalAttempts: attempts.length,
    skills,
    weakestSkill: weakestSkill && skills[weakestSkill].accuracy < 0.85 ? weakestSkill : undefined,
    slowRecallActivityIds,
    failedTypesByRule,
  };
}

export const skillLabels: Record<SkillKey, string> = {
  recognition: "recognising meaning",
  grammar: "sentence patterns",
  writing: "typed recall",
  listening: "listening",
  speaking: "speaking",
};
