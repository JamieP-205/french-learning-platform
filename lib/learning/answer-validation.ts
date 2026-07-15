import type { ActivityDefinition, NearMiss, ValidationResultV1 } from "@/lib/domain/types";

const stripAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function normalizeFrenchAnswer(value: string, stripConfiguredAccents = false): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr-FR");

  return stripConfiguredAccents ? stripAccents(normalized) : normalized;
}

function findNearMiss(activity: ActivityDefinition, answer: string): NearMiss | undefined {
  return activity.nearMisses?.find(
    (nearMiss) => normalizeFrenchAnswer(nearMiss.value) === normalizeFrenchAnswer(answer),
  );
}

export function validateActivityAnswer(
  activity: ActivityDefinition,
  submittedAnswer: string,
): ValidationResultV1 {
  const normalizedAnswer = normalizeFrenchAnswer(submittedAnswer);
  const exactMatch = activity.acceptedAnswers.some(
    (answer) => normalizeFrenchAnswer(answer.value) === normalizedAnswer,
  );
  const accentTolerantMatch = activity.acceptedAnswers.some(
    (answer) =>
      answer.allowAccentless === true &&
      normalizeFrenchAnswer(answer.value, true) === normalizeFrenchAnswer(submittedAnswer, true),
  );

  if (exactMatch || accentTolerantMatch) {
    return {
      isCorrect: true,
      isNearMiss: false,
      normalizedAnswer,
      feedback: activity.feedbackCorrect,
      correctAnswer: activity.acceptedAnswers[0]?.value ?? "",
      ruleIds: activity.grammarRuleIds,
      shouldCreateReview: false,
    };
  }

  const nearMiss = findNearMiss(activity, submittedAnswer);
  return {
    isCorrect: false,
    isNearMiss: Boolean(nearMiss),
    normalizedAnswer,
    feedback: nearMiss?.explanation ?? activity.feedbackIncorrect,
    correctAnswer: nearMiss?.correctedAnswer ?? activity.acceptedAnswers[0]?.value ?? "",
    mistakeType: nearMiss?.mistakeType ?? "unknown",
    ruleIds: nearMiss ? [nearMiss.ruleId] : activity.grammarRuleIds,
    shouldCreateReview: true,
  };
}
