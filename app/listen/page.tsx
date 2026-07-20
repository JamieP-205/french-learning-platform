"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityTeachingGate } from "@/components/lesson/activity-teaching-gate";
import { SpeechPlaybackButton } from "@/components/speech/speech-playback-button";
import { getListeningTeachingStep, LISTENING_CONCEPTS } from "@/lib/content/curriculum";
import { SHADOWING_PHRASES } from "@/lib/content/pronunciation";
import { normalizeFrenchAnswer } from "@/lib/learning/answer-validation";
import { playTextAudio, stopTextAudio } from "@/lib/speech/audio-playback";
import { speechSupport } from "@/lib/speech/browser-speech";
import { ENGLISH_RATE, FRENCH_RATE_NORMAL, FRENCH_RATE_SLOW } from "@/lib/speech/speech-rates";

const DICTATION_PHRASES = SHADOWING_PHRASES;

export default function ListenPage() {
  const [teachingComplete, setTeachingComplete] = useState(false);
  const [support, setSupport] = useState({ canSpeak: false, canListen: false });
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "close" | "prompt" | "wrong" | "revealed">();
  const [missCount, setMissCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [walking, setWalking] = useState(false);
  const [walkingNotice, setWalkingNotice] = useState<string>();
  const walkingRef = useRef(false);
  const walkingAudioOwner = useRef(Symbol("walking-mode-audio"));

  const phrase = DICTATION_PHRASES[index];
  const listeningConcept = LISTENING_CONCEPTS[index] ?? LISTENING_CONCEPTS[0]!;

  useEffect(() => {
    const playbackOwner = walkingAudioOwner.current;
    const timeoutId = window.setTimeout(() => setSupport(speechSupport()), 0);
    return () => {
      window.clearTimeout(timeoutId);
      walkingRef.current = false;
      stopTextAudio(playbackOwner);
    };
  }, []);

  function check() {
    const target = normalizeFrenchAnswer(phrase.french);
    const typed = normalizeFrenchAnswer(answer);
    const accentless = normalizeFrenchAnswer(phrase.french, true) === normalizeFrenchAnswer(answer, true);
    if (typed === target) return setResult("correct");
    if (accentless) return setResult("close");
    if (missCount === 0) {
      setMissCount(1);
      setResult("prompt");
      return;
    }
    setResult("wrong");
  }

  function next() {
    setIndex((index + 1) % DICTATION_PHRASES.length);
    setTeachingComplete(false);
    setAnswer("");
    setResult(undefined);
    setMissCount(0);
    setRevealed(false);
  }

  // Hands-free loop: English meaning → pause to say it → French answer.
  // Uses plain timers so stopping is instant.
  async function startWalkingMode() {
    walkingRef.current = true;
    setWalking(true);
    setWalkingNotice("Walking mode started. Keep this tab open and your device volume on.");
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    for (const item of DICTATION_PHRASES) {
      if (!walkingRef.current) break;
      const promptOutcome = await playTextAudio({
        text: `Say in French: ${item.english}`,
        language: "en-GB",
        rate: ENGLISH_RATE,
        owner: walkingAudioOwner.current,
      });
      if (promptOutcome.status === "failed" || promptOutcome.status === "unavailable") {
        walkingRef.current = false;
        setWalkingNotice("Audio could not play. Check that this tab is not muted, then try again.");
        break;
      }
      if (promptOutcome.status === "cancelled" || !walkingRef.current) {
        const wasStopped = !walkingRef.current;
        walkingRef.current = false;
        if (!wasStopped) setWalkingNotice("Walking mode was interrupted. Start it again when you are ready.");
        break;
      }
      await wait(5_000);
      if (!walkingRef.current) break;
      const answerOutcome = await playTextAudio({
        text: item.french,
        language: "fr-FR",
        rate: FRENCH_RATE_SLOW,
        audioSource: item.audioSource,
        owner: walkingAudioOwner.current,
      });
      if (answerOutcome.status === "failed" || answerOutcome.status === "unavailable") {
        walkingRef.current = false;
        setWalkingNotice("The French audio could not play. Check your sound settings, then try again.");
        break;
      }
      if (answerOutcome.status === "cancelled" || !walkingRef.current) {
        const wasStopped = !walkingRef.current;
        walkingRef.current = false;
        if (!wasStopped) setWalkingNotice("Walking mode was interrupted. Start it again when you are ready.");
        break;
      }
      await wait(1_000);
    }
    const completed = walkingRef.current;
    walkingRef.current = false;
    setWalking(false);
    if (completed) setWalkingNotice("Walking mode finished.");
  }

  function stopWalkingMode() {
    walkingRef.current = false;
    setWalking(false);
    setWalkingNotice("Walking mode stopped.");
    stopTextAudio(walkingAudioOwner.current);
  }

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Listen</p>
        <h1 className="mt-2 text-4xl font-black">Build confidence understanding spoken French.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Start slowly, replay as often as you need, and reveal the text after you have tried to identify the phrase.
        </p>

        <section className="card mt-7">
          {!teachingComplete ? (
            <ActivityTeachingGate
              concepts={[listeningConcept]}
              actionLabel="Start listening check"
              headingLevel={2}
              onComplete={() => setTeachingComplete(true)}
            />
          ) : <>
          <p className="eyebrow">Dictation · {index + 1} of {DICTATION_PHRASES.length}</p>
          <h2 className="mt-2 text-2xl font-black">Type what you hear.</h2>

          <div className="mt-5 flex flex-wrap items-start gap-3">
              <SpeechPlaybackButton
                key={`${phrase.id}-normal`}
                text={phrase.french}
                audioSource={phrase.audioSource}
                rate={FRENCH_RATE_NORMAL}
                label="Play"
              />
              <SpeechPlaybackButton
                key={`${phrase.id}-slow`}
                text={phrase.french}
                audioSource={phrase.audioSource}
                rate={FRENCH_RATE_SLOW}
                label="Play slowly"
                replayLabel="Play slowly again"
                showUnavailableMessage={false}
              />
              <button className="button-secondary" onClick={() => { setAnswer(""); setRevealed(true); setResult("revealed"); }}>Reveal text without credit</button>
          </div>

          {revealed && (
            <p className="mt-4 rounded-2xl bg-cream p-4 font-bold">
              <span lang="fr">{phrase.french}</span>{" "}
              <span className="font-normal text-ink/60">— {phrase.english}</span>
            </p>
          )}

          {result !== "revealed" && <label className="mt-5 block font-bold">
            Your answer
            <input
              className="field text-lg"
              lang="fr"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && answer.trim()) check(); }}
              autoComplete="off"
            />
          </label>}

          {result && (
            <p className={`${result === "wrong" || result === "prompt" || result === "revealed" ? "status-error" : "status-success"} mt-4`} aria-live="polite">
              {result === "correct"
                ? "Exact, including accents. Excellent ear."
                : result === "close"
                  ? `So close — only accents differ. It is written: ${phrase.french}`
                  : result === "prompt"
                    ? "Almost — try once more. Listen again and self-correct before seeing the text."
                    : result === "revealed"
                      ? "Here is the written phrase. Revealing it does not count as a listening answer."
                      : `Not this time. It was: ${phrase.french} (${phrase.english}). Rule: ${getListeningTeachingStep(phrase.id)?.metalinguisticRule ?? "Match each sound to the written phrase."}`}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {result === "prompt" ? (
              <>
                <button className="button-primary" type="button" onClick={() => { setAnswer(""); setResult(undefined); }}>Try again</button>
                <button className="button-secondary" type="button" onClick={() => { setAnswer(""); setRevealed(true); setResult("revealed"); }}>Show me the answer</button>
              </>
            ) : result !== "revealed" ? (
              <button className="button-primary" disabled={!answer.trim()} onClick={check}>Check</button>
            ) : null}
            <button className="button-secondary" onClick={next}>Next phrase</button>
          </div>
          </>}
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Walking mode</p>
          <h2 className="mt-2 text-2xl font-black">Hands-free practice for a walk or commute.</h2>
          <p className="mt-3 max-w-2xl text-ink/75">
            You hear the English meaning, get a few seconds to say the French out loud, then hear the answer. No
            screen needed once it starts.
          </p>
          {support.canSpeak ? (
            <button className="button-primary mt-5" onClick={walking ? stopWalkingMode : startWalkingMode}>
              {walking ? "Stop walking mode" : "Start walking mode"}
            </button>
          ) : (
            <p className="mt-5 text-sm text-ink/60">Walking mode needs browser audio, which is unavailable here.</p>
          )}
          {walkingNotice && <p className="mt-4 text-sm font-bold text-ink/75" aria-live="polite">{walkingNotice}</p>}
        </section>
      </main>
    </AppShell>
  );
}
