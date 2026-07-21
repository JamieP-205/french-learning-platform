"use client";

import { useState } from "react";
import Link from "next/link";
import { RemyArt } from "@/components/companion/remy-art";
import { useCompanionQuiet } from "@/lib/companion/quiet-preference";
import { shouldOfferHelp, type LessonRemyState } from "@/lib/companion/lesson-remy-triggers";
import { getConceptDefinitionsForActivity } from "@/lib/content/curriculum";
import type { ActivityDefinition, LearnerActivityDefinition } from "@/lib/domain/types";

// Remy in the lesson: he notices a struggle, asks before helping, and only
// ever restates material the teaching step already showed. The answer string
// never appears here; the recast path owns that.
export function LessonRemy({
  activity,
  state,
  celebrationOpen,
  onNotNow,
}: {
  activity: ActivityDefinition | LearnerActivityDefinition;
  state: LessonRemyState;
  celebrationOpen: boolean;
  onNotNow: () => void;
}) {
  const quiet = useCompanionQuiet();
  const [helpLevel, setHelpLevel] = useState<0 | 1 | 2>(0);
  const offer = shouldOfferHelp(state, { quiet, celebrationOpen });

  if (!offer) return null;

  const step = getConceptDefinitionsForActivity(activity.id).at(-1)?.teachingStep;
  const example = step?.positiveExamples[0];

  return (
    <aside aria-label="Remy offers help" className="remy-dock">
      <div className="remy-panel">
        {helpLevel === 0 ? (
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate/15">
              <RemyArt pose="thinking" size={44} />
            </span>
            <p className="text-sm font-black">Want a hint from Remy?</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate/15">
                <RemyArt pose="idle" size={44} />
              </span>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">Remy · A nudge</p>
            </div>
            <div aria-live="polite" className="mt-3 space-y-3 rounded-2xl bg-cream p-4 text-sm leading-6">
              {step ? (
                <p>
                  <span className="font-black">The pattern: </span>
                  {step.metalinguisticRule}
                </p>
              ) : (
                <p>Take one more look at the teaching card. The shape you need is in there.</p>
              )}
              {helpLevel === 2 && step && (
                <>
                  {example && (
                    <p>
                      <span className="font-black">Say it like: </span>
                      <span lang="fr">{example}</span>
                    </p>
                  )}
                  {step.registerNote && <p>{step.registerNote}</p>}
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {helpLevel === 0 && (
            <>
              <button className="remy-choice" onClick={() => setHelpLevel(1)} type="button">
                Yes, help me
              </button>
              <button className="remy-choice" onClick={onNotNow} type="button">
                Not now
              </button>
            </>
          )}
          {helpLevel === 1 && (
            <>
              <button className="remy-choice" onClick={() => setHelpLevel(2)} type="button">
                Another nudge
              </button>
              <button className="remy-choice" onClick={onNotNow} type="button">
                Merci, Remy
              </button>
            </>
          )}
          {helpLevel === 2 && (
            <>
              <Link className="remy-choice content-center" href="/roleplay">
                Practise a real exchange
              </Link>
              <button className="remy-choice" onClick={onNotNow} type="button">
                Merci, Remy
              </button>
            </>
          )}
        </div>
        {helpLevel > 0 && (
          <p className="mt-3 text-xs leading-5 text-ink/55">
            Remy repeats what the lesson taught. He never gives the answer away.
          </p>
        )}
      </div>
    </aside>
  );
}
