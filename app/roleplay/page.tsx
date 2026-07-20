"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityTeachingGate } from "@/components/lesson/activity-teaching-gate";
import { getRoleplayTeachingStep, ROLEPLAY_CONCEPTS } from "@/lib/content/curriculum";
import { registerComparisons, roleplayScenarios } from "@/lib/content/roleplay";
import { evaluateRoleplayChoice, roleplayVerdict } from "@/lib/learning/roleplay";

function outcomeTone(outcome?: string) {
  if (outcome === "strong") return "status-success";
  if (outcome === "safe") return "rounded-2xl border border-amber/30 bg-amber/20 px-4 py-3 text-sm text-ink";
  return "status-error";
}

export default function RoleplayPage() {
  const [teachingComplete, setTeachingComplete] = useState(false);
  const [scoredAttemptActive, setScoredAttemptActive] = useState(false);
  const [scenarioId, setScenarioId] = useState(roleplayScenarios[0].id);
  const [turnIndex, setTurnIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; outcome: string; nextTurnIndex?: number }>();
  const [missCount, setMissCount] = useState(0);
  const scenario = roleplayScenarios.find((candidate) => candidate.id === scenarioId) ?? roleplayScenarios[0];
  const turn = scenario.turns[turnIndex];
  const complete = !turn;
  const maxScore = scenario.turns.length * 2;

  function reset(nextScenarioId = scenarioId) {
    setScenarioId(nextScenarioId);
    setTurnIndex(0);
    setScore(0);
    setFeedback(undefined);
    setMissCount(0);
    setScoredAttemptActive(teachingComplete);
  }

  function choose(choiceId: string) {
    const result = evaluateRoleplayChoice(scenario, turnIndex, choiceId);
    if (result.choice.outcome === "repair" && missCount === 0) {
      setMissCount(1);
      setFeedback({
        text: "Almost — try once more. Which option fits the situation and register better?",
        outcome: "prompt",
      });
      return;
    }
    const teachingStep = getRoleplayTeachingStep(scenario.id, turn.id);
    const strongestChoice = turn.choices.find((choice) => choice.outcome === "strong");
    const correction = result.choice.outcome === "repair" && strongestChoice
      ? ` Correct answer: ${strongestChoice.text} Rule: ${teachingStep?.metalinguisticRule ?? "Choose the form that fits the relationship and setting."}`
      : "";
    setScore((current) => current + result.score);
    setScoredAttemptActive(false);
    setFeedback({ text: `${result.choice.feedback}${correction}`, outcome: result.choice.outcome, nextTurnIndex: result.nextTurnIndex });
  }

  function revealRoleplayAnswer() {
    const strongestChoice = turn.choices.find((choice) => choice.outcome === "strong");
    const teachingStep = getRoleplayTeachingStep(scenario.id, turn.id);
    setFeedback({
      outcome: "reveal",
      text: `Best option: ${strongestChoice?.text ?? "Use the safest option shown."} Why: ${teachingStep?.metalinguisticRule ?? "Match the form to the relationship and setting."} Showing the answer does not add to your score.`,
      nextTurnIndex: turnIndex + 1,
    });
    setScoredAttemptActive(false);
  }

  function continueRoleplay() {
    if (feedback?.nextTurnIndex === undefined) return;
    setTurnIndex(feedback.nextTurnIndex);
    setFeedback(undefined);
    setMissCount(0);
    setScoredAttemptActive(feedback.nextTurnIndex < scenario.turns.length);
  }

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Real French</p>
        <h1 className="mt-2 text-4xl font-black">Choose French that fits the situation.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Each choice explains its tone and level of formality, so you know when a phrase is appropriate.
        </p>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="card">
            <p className="eyebrow">Scenarios</p>
            <div className="mt-4 space-y-3">
              {roleplayScenarios.map((candidate) => (
                <button
                  key={candidate.id}
                  className={`w-full rounded-2xl p-4 text-left font-bold transition ${candidate.id === scenario.id ? "bg-ink text-cream" : "bg-cream hover:bg-ink/10"}`}
                  onClick={() => reset(candidate.id)}
                >
                  <span className="block">{candidate.title}</span>
                  <span className={`mt-1 block text-sm ${candidate.id === scenario.id ? "text-cream/70" : "text-ink/65"}`}>
                    {candidate.level} - {candidate.goal}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="card">
            <p className="eyebrow">{scenario.setting}</p>
            <h2 className="mt-2 text-3xl font-black">{scenario.title}</h2>
            <p className="mt-3 text-ink/75">{scenario.goal}</p>

            {!teachingComplete ? (
              <div className="mt-6">
                <ActivityTeachingGate
                  concepts={ROLEPLAY_CONCEPTS}
                  actionLabel="Start roleplay"
                  headingLevel={2}
                  onComplete={() => {
                    setTeachingComplete(true);
                    setScoredAttemptActive(true);
                  }}
                />
              </div>
            ) : !complete && (
              <div className="mt-6 rounded-3xl bg-cream p-5">
                <p className="text-xs font-black uppercase tracking-wide text-coral">
                  Turn {turnIndex + 1} of {scenario.turns.length}
                </p>
                <p className="mt-3 rounded-2xl bg-surface p-4 font-bold">
                  Other person: <span lang="fr">{turn.npcLine}</span>
                </p>
                <h3 className="mt-5 text-xl font-black">{turn.task}</h3>
                {!feedback && <div className="mt-4 grid gap-3">
                  {turn.choices.map((choice) => (
                    <button
                      key={choice.id}
                      className="rounded-2xl bg-surface p-4 text-left font-bold transition hover:bg-moss/10 disabled:opacity-60"
                      disabled={Boolean(feedback)}
                      onClick={() => choose(choice.id)}
                    >
                      <span className="block" lang="fr">{choice.text}</span>
                      <span className="mt-1 block text-xs uppercase tracking-wide text-ink/50">{choice.register.replace("_", " ")}</span>
                    </button>
                  ))}
                </div>}
                {feedback?.outcome === "prompt" && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button className="button-primary" type="button" onClick={() => setFeedback(undefined)}>Try again</button>
                    <button className="button-secondary" type="button" onClick={revealRoleplayAnswer}>Show me the answer</button>
                  </div>
                )}
              </div>
            )}

            {feedback && (
              <div className={`${outcomeTone(feedback.outcome)} mt-5`} aria-live="polite">
                <p className="font-black">{feedback.outcome === "strong" ? "Best choice" : feedback.outcome === "safe" ? "Safe choice" : feedback.outcome === "prompt" ? "Almost — try once more" : "Repair this"}</p>
                <p className="mt-2">{feedback.text}</p>
                {feedback.nextTurnIndex !== undefined && (
                  <button className="button-primary mt-4" type="button" onClick={continueRoleplay}>Continue roleplay</button>
                )}
              </div>
            )}

            {complete && (
              <div className="mt-6 rounded-3xl bg-moss/10 p-6">
                <p className="eyebrow">Roleplay complete</p>
                <h3 className="mt-2 text-3xl font-black">{roleplayVerdict(score, maxScore)}</h3>
                <p className="mt-3 text-ink/75">
                  Score: {score} / {maxScore}. Repeat the scenario until the safer phrases feel automatic, then use the
                  same chunks in the real situation.
                </p>
                <button className="button-primary mt-5" onClick={() => reset()}>
                  Try again
                </button>
              </div>
            )}

            <p className="mt-5 text-sm font-bold text-ink/60">{scenario.sourceNote}</p>
          </section>
        </section>

        {!scoredAttemptActive && <section className="card mt-8">
          <p className="eyebrow">Tone and formality</p>
          <h2 className="mt-2 text-2xl font-black">See how the same message changes by situation.</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {registerComparisons.map((comparison) => (
              <article key={comparison.id} className="rounded-2xl bg-cream p-4">
                <p className="text-xs font-black uppercase tracking-wide text-coral">{comparison.context}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="font-black">Formal</dt>
                    <dd>{comparison.formal}</dd>
                  </div>
                  <div>
                    <dt className="font-black">Neutral</dt>
                    <dd>{comparison.neutral}</dd>
                  </div>
                  <div>
                    <dt className="font-black">Casual</dt>
                    <dd>{comparison.casual}</dd>
                  </div>
                  <div className="rounded-xl bg-coral/10 p-3">
                    <dt className="font-black">Avoid as default</dt>
                    <dd>{comparison.avoid}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm text-ink/70">{comparison.explanation}</p>
              </article>
            ))}
          </div>
        </section>}
      </main>
    </AppShell>
  );
}
