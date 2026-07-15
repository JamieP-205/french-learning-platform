import type { RoleplayChoice, RoleplayScenario } from "@/lib/content/roleplay";

export type RoleplayEvaluation = {
  choice: RoleplayChoice;
  score: number;
  nextTurnIndex: number;
  complete: boolean;
};

export function scoreRoleplayChoice(choice: RoleplayChoice) {
  if (choice.outcome === "strong") return 2;
  if (choice.outcome === "safe") return 1;
  return 0;
}

export function evaluateRoleplayChoice(
  scenario: RoleplayScenario,
  turnIndex: number,
  choiceId: string,
): RoleplayEvaluation {
  const turn = scenario.turns[turnIndex];
  if (!turn) throw new Error("That roleplay turn is not available.");
  const choice = turn.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error("That roleplay choice is not available.");
  const nextTurnIndex = Math.min(turnIndex + 1, scenario.turns.length);
  return {
    choice,
    score: scoreRoleplayChoice(choice),
    nextTurnIndex,
    complete: nextTurnIndex >= scenario.turns.length,
  };
}

export function roleplayVerdict(score: number, maxScore: number) {
  if (score >= maxScore) return "Ready for the real exchange.";
  if (score >= Math.ceil(maxScore * 0.6)) return "Safe enough, with one phrase to polish.";
  return "Good practice target. Repeat the safer chunks before trying this live.";
}
