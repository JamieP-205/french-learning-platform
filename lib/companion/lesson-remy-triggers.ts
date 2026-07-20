// When should Remy offer help in a lesson? A pure reducer so the answer is
// unit-testable: after a scored miss (the learner is in their retry window,
// where a nudge is most useful and the recast has not yet revealed anything)
// or after a long visible idle. Never twice for the same activity once
// declined, never while the celebration is up, never when asked to be quiet.

export type LessonRemyState = {
  misses: number;
  idleFired: boolean;
  dismissed: boolean;
};

export const initialLessonRemyState: LessonRemyState = {
  misses: 0,
  idleFired: false,
  dismissed: false,
};

export type LessonRemyEvent = "scored-miss" | "idle" | "not-now" | "activity-advanced";

export function reduceLessonRemy(state: LessonRemyState, event: LessonRemyEvent): LessonRemyState {
  switch (event) {
    case "scored-miss":
      return { ...state, misses: state.misses + 1 };
    case "idle":
      return { ...state, idleFired: true };
    case "not-now":
      return { ...state, dismissed: true };
    case "activity-advanced":
      return initialLessonRemyState;
  }
}

export function shouldOfferHelp(
  state: LessonRemyState,
  options: { quiet: boolean; celebrationOpen: boolean },
): boolean {
  if (options.quiet || options.celebrationOpen || state.dismissed) return false;
  return state.misses >= 1 || state.idleFired;
}

// Long enough that a thinking learner is never interrupted mid-thought.
export const LESSON_REMY_IDLE_MS = 50_000;
