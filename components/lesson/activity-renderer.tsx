"use client";

import { useState, useSyncExternalStore } from "react";
import { SpeakCheck } from "@/components/speech/speak-check";
import { SpeechPlaybackButton } from "@/components/speech/speech-playback-button";
import { audioSourceForFrench } from "@/lib/content/french-audio";
import { FRENCH_RATE_SLOW } from "@/lib/speech/speech-rates";
import type {
  ActivityDefinition,
  AttemptEvidenceKind,
  LearnerActivityDefinition,
} from "@/lib/domain/types";

export type SubmissionMetadata = {
  completed: boolean;
  correct: boolean;
  evidenceKind: AttemptEvidenceKind;
};

type ActivityRendererProps = {
  activity: ActivityDefinition | LearnerActivityDefinition;
  disabled: boolean;
  onSubmit: (answer: string, metadata?: SubmissionMetadata) => void;
};

export function ActivityRenderer({ activity, disabled, onSubmit }: ActivityRendererProps) {
  return <ActivityRendererFields key={activity.id} activity={activity} disabled={disabled} onSubmit={onSubmit} />;
}

function ActivityRendererFields({ activity, disabled, onSubmit }: ActivityRendererProps) {
  const [answer, setAnswer] = useState("");
  const [orderedTokenIndexes, setOrderedTokenIndexes] = useState<number[]>([]);
  const hydrated = useSyncExternalStore(
    (onStoreChange) => {
      const timeoutId = window.setTimeout(onStoreChange, 0);
      return () => window.clearTimeout(timeoutId);
    },
    () => true,
    () => false,
  );
  const controlsDisabled = disabled || !hydrated;

  if (!hydrated) {
    return <p className="mt-8 rounded-2xl bg-cream p-4 text-sm font-bold text-ink/75">Getting this question ready…</p>;
  }

  if (activity.type === "multiple_choice") {
    return (
      <fieldset className="mt-8">
        <legend className="sr-only">Choose one answer</legend>
        <div className="grid gap-3">
          {activity.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              lang={choice.language}
              disabled={controlsDisabled}
              className="min-h-14 rounded-2xl border border-ink/20 bg-white px-5 py-4 text-left font-bold transition hover:border-ink hover:bg-cream disabled:opacity-60"
              onClick={() => onSubmit(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (activity.type === "sentence_builder") {
    const orderedTokens = orderedTokenIndexes.map((index) => activity.tokens[index]);
    const remainingTokens = activity.tokens
      .map((token, index) => ({ token, index }))
      .filter(({ index }) => !orderedTokenIndexes.includes(index));

    return (
      <div className="mt-8">
        <p className="font-bold">Your sentence</p>
        <div aria-live="polite" className="mt-3 min-h-20 rounded-2xl border border-ink/20 bg-cream p-4">
          {orderedTokens.length === 0 ? (
            <p className="text-ink/70">Choose the words in the right order.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orderedTokens.map((token, position) => (
                <button
                  key={`${orderedTokenIndexes[position]}-${token}`}
                  lang="fr"
                  type="button"
                  className="rounded-xl bg-white px-3 py-2 font-bold shadow-sm"
                  disabled={controlsDisabled}
                  aria-label={`Remove ${token}`}
                  onClick={() => setOrderedTokenIndexes((current) => current.filter((_, index) => index !== position))}
                >
                  {token}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-5 text-sm font-bold text-ink/75">Words to use</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {remainingTokens.map(({ token, index }) => (
            <button
              key={`${index}-${token}`}
              lang="fr"
              type="button"
              disabled={controlsDisabled}
              className="min-h-12 rounded-xl border border-ink/20 bg-white px-4 py-3 font-bold hover:bg-cream disabled:opacity-60"
              onClick={() => setOrderedTokenIndexes((current) => [...current, index])}
            >
              {token}
            </button>
          ))}
        </div>

        <button
          className="button-primary mt-6 w-full"
          type="button"
          disabled={controlsDisabled || orderedTokens.length !== activity.tokens.length}
          onClick={() => onSubmit(orderedTokens.join(" "))}
        >
          Check sentence
        </button>
      </div>
    );
  }

  if (activity.type === "speak_repeat") {
    const targetText = activity.targetText ?? activity.prompt;
    const audioSource = "audioSource" in activity
      ? activity.audioSource
      : audioSourceForFrench(targetText);

    return (
      <div className="mt-8 rounded-2xl bg-cream p-5 sm:p-6">
        <SpeakCheck
          targetText={targetText}
          audioSource={audioSource}
          disabled={controlsDisabled}
          onDone={(outcome) => onSubmit("completed", outcome)}
          doneLabel="I did the speaking self-check"
        />
      </div>
    );
  }

  const answerId = `answer-${activity.id}`;
  const audioHelpId = `audio-help-${activity.id}`;
  const dictationAudioSource = activity.type === "dictation"
    ? "audioSource" in activity
      ? activity.audioSource
      : activity.targetText
        ? audioSourceForFrench(activity.targetText)
        : undefined
    : undefined;

  return (
    <div className="mt-8">
      {activity.type === "dictation" && dictationAudioSource && (
        <div className="rounded-2xl bg-cream p-4 sm:p-5" id={audioHelpId}>
          <p className="font-bold">Listen, then type what you hear.</p>
          <div className="mt-4 flex flex-wrap items-start gap-4">
            <SpeechPlaybackButton
              text=""
              audioSource={dictationAudioSource}
              label="Play the phrase"
              disabled={controlsDisabled}
            />
            <SpeechPlaybackButton
              text=""
              audioSource={dictationAudioSource}
              rate={FRENCH_RATE_SLOW}
              label="Play slowly"
              replayLabel="Play slowly again"
              className="text-sm font-black text-coral underline decoration-2 underline-offset-4 disabled:opacity-60"
              disabled={controlsDisabled}
              showUnavailableMessage={false}
            />
          </div>
          <button
            type="button"
            className="mt-4 text-sm font-black text-coral underline decoration-2 underline-offset-4"
            disabled={controlsDisabled}
            onClick={() => onSubmit("revealed", { completed: true, correct: false, evidenceKind: "self-report" })}
          >
            Show the written answer
          </button>
          <p className="mt-2 text-xs text-ink/75">This won’t count as a correct answer.</p>
        </div>
      )}

      <label className="mt-5 block font-bold" htmlFor={answerId}>Your answer</label>
      <input
        id={answerId}
        lang="fr"
        className="field mt-3 text-lg"
        placeholder={activity.placeholder ?? "Type your answer"}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={controlsDisabled}
        onKeyDown={(event) => {
          if (event.key === "Enter" && answer.trim()) onSubmit(answer);
        }}
        aria-describedby={activity.type === "dictation" ? audioHelpId : undefined}
        autoComplete="off"
      />
      <button
        className="button-primary mt-5 w-full"
        type="button"
        disabled={controlsDisabled || !answer.trim()}
        onClick={() => onSubmit(answer)}
      >
        Check answer
      </button>
    </div>
  );
}
