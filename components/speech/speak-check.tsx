"use client";

import { useEffect, useState } from "react";
import { SpeechPlaybackButton } from "@/components/speech/speech-playback-button";
import { listenOnceInFrench, speechSupport } from "@/lib/speech/browser-speech";
import { scorePronunciation, type PronunciationFeedback } from "@/lib/speech/scoring";

export type SpeechAttemptOutcome = {
  completed: true;
  correct: boolean;
  evidenceKind: "controlled" | "self-report";
};

// Microphone-backed repeat-after-me check. Recognition quality varies by
// browser and accent, so feedback stays gentle and never blocks progress —
// the learner can always mark the attempt done.
export function SpeakCheck({
  targetText,
  audioSource,
  acceptedPhrases,
  disabled,
  onDone,
  doneLabel = "I said it — continue",
}: {
  targetText: string;
  audioSource?: string;
  acceptedPhrases?: string[];
  disabled?: boolean;
  onDone?: (outcome: SpeechAttemptOutcome) => void;
  doneLabel?: string;
}) {
  const [support, setSupport] = useState({ canSpeak: false, canListen: false });
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState<PronunciationFeedback>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSupport(speechSupport()), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  async function record() {
    setListening(true);
    setNotice(undefined);
    setFeedback(undefined);
    const outcome = await listenOnceInFrench();
    setListening(false);
    if (outcome.status === "result") {
      setFeedback(scorePronunciation(outcome.transcript, acceptedPhrases?.length ? acceptedPhrases : [targetText]));
    } else if (outcome.status === "denied") {
      setNotice("Microphone access was blocked. You can still say it out loud and continue.");
    } else if (outcome.status === "no-speech") {
      setNotice("Nothing was picked up. Try again a little closer to the microphone.");
    } else {
      setNotice("Speech recognition is unavailable right now. Say it out loud and continue.");
    }
  }

  return (
    <div>
      <p className="text-xl font-black" lang="fr">{targetText}</p>
      <div className="mt-5 flex flex-wrap items-start gap-3">
        <SpeechPlaybackButton
          text={targetText}
          audioSource={audioSource}
          label="Hear it in French"
          disabled={disabled}
        />
        {support.canListen && (
          <button type="button" className="button-secondary" disabled={disabled || listening} onClick={record}>
            {listening ? "Listening…" : feedback || notice ? "Try again" : "Say it — check me"}
          </button>
        )}
        {onDone && (
          <button
            type="button"
            className="button-primary"
            disabled={disabled}
            onClick={() => {
              const correct = feedback?.verdict === "match";
              onDone({
                completed: true,
                correct,
                evidenceKind: correct ? "controlled" : "self-report",
              });
            }}
          >
            {doneLabel}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-2xl p-4 text-sm ${feedback.verdict === "match" ? "bg-moss/10" : "bg-amber/20"}`}
          aria-live="polite"
        >
          <p className="font-black">
            {feedback.verdict === "match"
              ? "That was clearly understandable. Nice."
              : feedback.verdict === "close"
                ? "Close — most of it came through."
                : "Worth another go, slower this time."}
          </p>
          <p className="mt-1 text-ink/70">Heard: “{feedback.heard}”</p>
          {feedback.verdict !== "match" && feedback.missingWords.length > 0 && (
            <p className="mt-1 text-ink/70">Give extra care to: {feedback.missingWords.join(", ")}</p>
          )}
        </div>
      )}
      {notice && <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-ink/70" aria-live="polite">{notice}</p>}
      {!support.canListen && (
        <p className="mt-4 text-sm text-ink/60">
          This browser cannot check speech, so this stays an honest self-check. Chrome or Edge can score it.
        </p>
      )}
    </div>
  );
}
