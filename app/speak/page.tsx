"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ActivityTeachingGate } from "@/components/lesson/activity-teaching-gate";
import { SpeakCheck } from "@/components/speech/speak-check";
import { SpeechPlaybackButton } from "@/components/speech/speech-playback-button";
import { getConceptDefinitionsForActivity } from "@/lib/content/curriculum";
import { MINIMAL_PAIRS, SHADOWING_PHRASES } from "@/lib/content/pronunciation";
import { FRENCH_RATE_SLOW } from "@/lib/speech/speech-rates";

export default function SpeakPage() {
  const [teachingComplete, setTeachingComplete] = useState(false);
  const [shadowIndex, setShadowIndex] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);
  const shadow = SHADOWING_PHRASES[shadowIndex];
  const pair = MINIMAL_PAIRS[pairIndex];
  const speakingConcepts = getConceptDefinitionsForActivity(`speak:${shadow.id}`);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Speak</p>
        <h1 className="mt-2 text-4xl font-black">Say French out loud, without an audience.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          The app does not store voice recordings. If you use speech checking, your browser or its speech provider
          may process the audio. The optional check compares recognised words with the phrase; it does not grade your accent.
        </p>

        <section className="card mt-7">
          {!teachingComplete ? (
            <ActivityTeachingGate
              concepts={speakingConcepts}
              actionLabel="Start speaking check"
              headingLevel={2}
              onComplete={() => setTeachingComplete(true)}
            />
          ) : <>
            <p className="eyebrow">Repeat after me</p>
            <h2 className="mt-2 text-2xl font-black">Say one phrase and check the recognised words.</h2>
            <div className="mt-6 rounded-3xl bg-cream p-6" data-testid="speaking-scored-check">
              <SpeakCheck key={shadow.id} targetText={shadow.french} audioSource={shadow.audioSource} />
              <p className="mt-4 text-sm text-ink/70">
                {shadow.english} · Focus: {shadow.focus}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="button-secondary"
                onClick={() => {
                  setShadowIndex((shadowIndex + 1) % SHADOWING_PHRASES.length);
                  setTeachingComplete(false);
                }}
              >
                Next phrase
              </button>
              <span className="self-center text-sm text-ink/60">
                {shadowIndex + 1} of {SHADOWING_PHRASES.length}
              </span>
            </div>
          </>}
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Sound contrast</p>
          <h2 className="mt-2 text-2xl font-black">{pair.focus}</h2>
          <p className="mt-3 max-w-2xl text-ink/75">{pair.note}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[pair.left, pair.right].map((side, sideIndex) => (
              <div key={side.french} className="rounded-3xl bg-cream p-6 text-center">
                <p className="text-3xl font-black" lang="fr">{side.french}</p>
                <p className="mt-1 text-sm text-ink/70">{side.english}</p>
                <div className="mt-4 flex justify-center">
                  <SpeechPlaybackButton
                    text={side.french}
                    rate={FRENCH_RATE_SLOW}
                    label="Hear it"
                    showUnavailableMessage={sideIndex === 0}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <SpeechPlaybackButton
              key={`${pair.left.french}-${pair.right.french}`}
              text={`${pair.left.french} ... ${pair.right.french}`}
              rate={FRENCH_RATE_SLOW}
              label="Hear them together"
              showUnavailableMessage={false}
            />
            <button className="button-secondary" onClick={() => setPairIndex((pairIndex + 1) % MINIMAL_PAIRS.length)}>
              Next contrast
            </button>
          </div>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">Shadowing</p>
          <h2 className="mt-2 text-2xl font-black">Speak along, not after.</h2>
          <p className="mt-3 max-w-2xl text-ink/75">
            Play a phrase slowly and say it at the same time as the voice. Shadowing trains rhythm and
            confidence. Do each phrase two or three times, no scoring.
          </p>
          <div className="mt-5 flex flex-wrap items-start gap-3">
            {SHADOWING_PHRASES.map((phrase, phraseIndex) => (
              <SpeechPlaybackButton
                key={phrase.id}
                text={phrase.french}
                audioSource={phrase.audioSource}
                rate={FRENCH_RATE_SLOW}
                label={phrase.french}
                replayLabel={phrase.french}
                labelLanguage="fr"
                showUnavailableMessage={phraseIndex === 0}
              />
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
