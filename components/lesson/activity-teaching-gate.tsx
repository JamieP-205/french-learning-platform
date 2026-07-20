"use client";

import type { ConceptDefinition } from "@/lib/domain/types";
import { SpeechPlaybackButton } from "@/components/speech/speech-playback-button";
import { audioSourceForFrench } from "@/lib/content/french-audio";

type ActivityTeachingGateProps = {
  concepts: ConceptDefinition[];
  onComplete: () => void;
  actionLabel?: string;
  headingLevel?: 1 | 2 | 3;
};

type WordMeaning = {
  form: string;
  meaning: string;
};

function uniqueWordMeanings(concept: ConceptDefinition) {
  const seen = new Set<string>();
  const words: WordMeaning[] = [];
  const source = concept.teachingStep.inputSegment.inlineGlosses.length
    ? concept.teachingStep.inputSegment.inlineGlosses
    : concept.vocabulary;

  for (const item of source) {
    const key = `${item.form.trim().toLocaleLowerCase("fr")}\u0000${item.meaning.trim().toLocaleLowerCase("en")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    words.push({ form: item.form, meaning: item.meaning });
  }

  return words;
}

export function ActivityTeachingGate({
  concepts,
  onComplete,
  actionLabel = "Try this question",
  headingLevel = 1,
}: ActivityTeachingGateProps) {
  const seenConceptIds = new Set<string>();
  const uniqueConcepts = concepts.filter((concept) => {
    if (seenConceptIds.has(concept.id)) return false;
    seenConceptIds.add(concept.id);
    return true;
  });
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h1";
  const ConceptHeading = headingLevel === 1 ? "h2" : headingLevel === 2 ? "h3" : "h4";

  if (uniqueConcepts.length === 0) {
    return (
      <div className="status-error" role="alert">
        This question isn’t ready yet. Please choose another activity.
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">First: learn</p>
      <Heading className="mt-3 text-3xl font-black leading-tight">Learn this first</Heading>
      <p className="mt-3 max-w-2xl leading-7 text-ink/70">
        Read the meaning and when to use it. The question comes next.
      </p>

      <div className="mt-6 space-y-5">
        {uniqueConcepts.map((concept) => {
          const step = concept.teachingStep;
          const words = uniqueWordMeanings(concept);
          const normalisedInput = step.inputSegment.text.trim().toLocaleLowerCase("fr");
          const firstExample = step.positiveExamples.find(
            (example) => example.trim().toLocaleLowerCase("fr") !== normalisedInput,
          );
          const firstContrast = step.contrastExamples[0];
          const moreExamples = step.positiveExamples.filter(
            (example) => example !== firstExample && example.trim().toLocaleLowerCase("fr") !== normalisedInput,
          );
          const moreContrasts = step.contrastExamples.slice(1);

          return (
            <article key={concept.id} className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
              <ConceptHeading lang="fr" className="text-2xl font-black leading-tight">{step.inputSegment.text}</ConceptHeading>
              {step.meaning && <p className="mt-2 text-lg font-bold text-ink">{step.meaning}</p>}
              <div className="mt-4">
                <SpeechPlaybackButton
                  audioSource={audioSourceForFrench(step.inputSegment.text)}
                  label="Hear the phrase clearly"
                  rate={1}
                  showUnavailableMessage={false}
                  text={step.inputSegment.text}
                />
              </div>
              <p className="mt-4 max-w-2xl leading-6 text-ink/75">
                <span className="font-black text-ink">Use it when: </span>
                {step.function}
              </p>

              <div className="mt-5 rounded-xl border border-ink/10 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-ink/70">Word by word</p>
                {words.length > 0 && (
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    {words.map((item, index) => (
                      <div key={`${item.form}-${item.meaning}-${index}`} className="flex gap-2">
                        <dt lang="fr" className="font-black">{item.form}</dt>
                        <dd className="text-ink/70">— {item.meaning}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              <details className="mt-4 rounded-xl border border-ink/10 bg-white p-4">
                <summary className="cursor-pointer font-black">Grammar and more examples</summary>
                <div className="mt-3 space-y-4 text-sm leading-6">
                  <p>
                    <span className="font-black">The phrase:</span> {step.form}
                  </p>
                  <p>
                    <span className="font-black">The pattern:</span> {step.metalinguisticRule}
                  </p>
                  {step.registerNote && (
                    <p>
                      <span className="font-black">When to use it:</span> {step.registerNote}
                    </p>
                  )}
                  {firstExample && (
                    <p>
                      <span className="font-black">Another example:</span>{" "}
                      <span lang="fr">{firstExample}</span>
                    </p>
                  )}
                  {firstContrast && (
                    <p>
                      <span className="font-black">Compare:</span> {firstContrast}
                    </p>
                  )}
                  {moreExamples.length > 0 && (
                    <div>
                      <p className="font-black">More examples</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {moreExamples.map((example) => (
                            <li lang="fr" key={example}>{example}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {moreContrasts.length > 0 && (
                    <div>
                      <p className="font-black">More comparisons</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {moreContrasts.map((example) => (
                          <li key={example}>{example}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            </article>
          );
        })}
      </div>

      <button className="button-primary mt-7 w-full" type="button" onClick={onComplete}>
        {actionLabel}
      </button>
    </div>
  );
}
