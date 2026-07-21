"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bonjour:first-run-tour";

const tourSteps = [
  {
    title: "Today gives you a clear next step",
    body: "Your recommended session puts due review first, then useful lesson work. You can follow it immediately or browse another topic from Learn.",
  },
  {
    title: "Wrong answers become focused practice",
    body: "A checked mistake is saved with an explanation and scheduled to return. The Review tab shows exactly what is ready and why.",
  },
  {
    title: "Progress shows what you actually practised",
    body: "See completed sessions, phrases recalled from memory, repaired mistakes, and the skills you have practised.",
  },
  {
    title: "Start small",
    body: "Two minutes still counts. There is always a short session option. Ready? Start your first session below.",
  },
];

// Lightweight coach-marks shown when explicitly requested with ?tour=1;
// onboarding links here after a new learner finishes setup. Completion is
// remembered locally so a stale ?tour=1 URL does not repeat it.
export function FirstRunTour() {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const done = window.localStorage.getItem(STORAGE_KEY) === "done";
        const requested = new URLSearchParams(window.location.search).get("tour") === "1";
        setVisible(requested && !done);
      } catch {
        setVisible(false);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function finish() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // Remembering the dismissal is best-effort only.
    }
    setVisible(false);
  }

  if (!visible) return null;

  const step = tourSteps[stepIndex];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Quick app tour"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-xl rounded-3xl border border-ink/15 bg-ink p-6 text-cream shadow-2xl md:bottom-6"
    >
      <p className="text-xs font-black uppercase tracking-wide text-amber">
        Quick tour · {stepIndex + 1} of {tourSteps.length}
      </p>
      <h2 className="mt-2 text-xl font-black">{step.title}</h2>
      <p className="mt-2 text-sm leading-6 text-cream/80">{step.body}</p>
      <div className="mt-5 flex items-center justify-between">
        <button className="text-sm font-bold text-cream/70 underline hover:text-cream" onClick={finish}>
          Skip tour
        </button>
        {stepIndex < tourSteps.length - 1 ? (
          <button
            className="rounded-xl bg-coral px-4 py-2 text-sm font-black hover:bg-coral/90"
            onClick={() => setStepIndex(stepIndex + 1)}
          >
            Next
          </button>
        ) : (
          <button className="rounded-xl bg-coral px-4 py-2 text-sm font-black hover:bg-coral/90" onClick={finish}>
            Let&rsquo;s go
          </button>
        )}
      </div>
    </div>
  );
}
