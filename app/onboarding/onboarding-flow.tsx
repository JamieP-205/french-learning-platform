"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { ActivityRenderer } from "@/components/lesson/activity-renderer";
import { validateActivityAnswer } from "@/lib/learning/answer-validation";
import { getConceptDefinitionsForActivity } from "@/lib/content/curriculum";
import { INTRO_MISSION } from "@/lib/content/seed";
import type { CefrLevel } from "@/lib/domain/types";
import { detectRuntimeTimeZone } from "@/lib/time/calendar-day";

const goalOptions = ["travel", "work", "relationships", "exams", "culture", "hobby"];
const interestOptions = [
  "music", "food", "travel", "films & TV", "gaming", "sport",
  "technology", "nature", "books", "fashion", "science", "family",
];
const focusOptions = [
  { value: "speaking", label: "Speaking" },
  { value: "listening", label: "Listening" },
  { value: "writing", label: "Writing" },
  { value: "review", label: "Remembering what I learn" },
] as const;
const cefrLevels = [
  { value: "A1", label: "A1 — new or rusty beginner" },
  { value: "A2", label: "A2 — basic everyday French" },
  { value: "B1", label: "B1 — can handle familiar situations" },
  { value: "B2", label: "B2 — independent user" },
  { value: "C1", label: "C1 — advanced" },
  { value: "C2", label: "C2 — near-native" },
] as const;

const placementActivityIds = ["act-name-meaning-v1", "act-age-fill-v1", "act-age-typing-v1"];

type Step = "name" | "goals" | "level" | "interests" | "rhythm" | "consent";
const steps: Step[] = ["name", "goals", "level", "interests", "rhythm", "consent"];

const stepTitles: Record<Step, string> = {
  name: "Let's start with you",
  goals: "Why French?",
  level: "Where are you now?",
  interests: "What do you enjoy?",
  rhythm: "Your learning rhythm",
  consent: "Last step",
};

export function OnboardingFlow() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [currentLevel, setCurrentLevel] = useState<CefrLevel>("A1");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [dailyTimeChoice, setDailyTimeChoice] = useState("15");
  const [dailyMinutes, setDailyMinutes] = useState(15);
  const [preferredMode, setPreferredMode] = useState<"normal" | "short">("normal");
  const [focusPreferences, setFocusPreferences] = useState<string[]>([]);
  const [speakingConfidence, setSpeakingConfidence] = useState<"low" | "medium" | "high">("medium");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [acceptedRequiredPolicies, setAcceptedRequiredPolicies] = useState(false);
  const [error, setError] = useState<string>();
  const [authError, setAuthError] = useState<string>();
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState<boolean>();
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkIndex, setCheckIndex] = useState(0);
  const [checkCorrect, setCheckCorrect] = useState(0);
  const [checkDone, setCheckDone] = useState(false);
  const [checkResolution, setCheckResolution] = useState<{ correct: boolean; message: string }>();

  const step = steps[stepIndex];
  const placementActivities = useMemo(
    () => placementActivityIds
      .map((id) => INTRO_MISSION.activities.find((activity) => activity.id === id))
      .filter((activity) => activity !== undefined),
    [],
  );
  // Ask for the account before any questions, so nobody fills in the whole
  // flow and only then finds out sign-in is required.
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      setAuthError(undefined);
      try {
        if (!getBrowserSupabase()) {
          if (!cancelled) setNeedsSignIn(false);
          return;
        }
        const token = await getBrowserAccessToken();
        if (!cancelled) setNeedsSignIn(!token);
      } catch {
        if (!cancelled) {
          setNeedsSignIn(undefined);
          setAuthError("We couldn't confirm your sign-in. Check your connection and try again.");
        }
      }
    }

    void checkAuth();
    return () => {
      cancelled = true;
    };
  }, [authCheckAttempt]);

  function toggle(value: string, values: string[], setValues: (next: string[]) => void, max = 12) {
    if (values.includes(value)) return setValues(values.filter((item) => item !== value));
    if (values.length < max) setValues([...values, value]);
  }

  function addCustomInterest() {
    const cleaned = customInterest.trim().toLowerCase().slice(0, 30);
    if (cleaned && !selectedInterests.includes(cleaned) && selectedInterests.length < 12) {
      setSelectedInterests([...selectedInterests, cleaned]);
    }
    setCustomInterest("");
  }

  function submitCheckAnswer(answer: string) {
    const activity = placementActivities[checkIndex];
    if (!activity) return;
    const result = validateActivityAnswer(activity, answer);
    const rule = getConceptDefinitionsForActivity(activity.id).at(-1)?.teachingStep.metalinguisticRule;
    setCheckResolution({
      correct: result.isCorrect,
      message: result.isCorrect
        ? "That foundation looks secure."
        : `Not this time. The answer is ${result.correctAnswer}. ${rule ?? result.feedback}`,
    });
  }

  function revealCheckAnswer() {
    const activity = placementActivities[checkIndex];
    if (!activity) return;
    const result = validateActivityAnswer(activity, "");
    const rule = getConceptDefinitionsForActivity(activity.id).at(-1)?.teachingStep.metalinguisticRule;
    setCheckResolution({
      correct: false,
      message: `The answer is ${result.correctAnswer}. ${rule ?? result.feedback} Shown without placement credit.`,
    });
  }

  function continueCheck() {
    if (!checkResolution) return;
    const correct = checkCorrect + (checkResolution.correct ? 1 : 0);
    setCheckCorrect(correct);
    setCheckResolution(undefined);
    if (checkIndex + 1 >= placementActivities.length) {
      setCheckDone(true);
    } else {
      setCheckIndex(checkIndex + 1);
    }
  }

  const stepValid =
    step === "name" ? displayName.trim().length > 0
    : step === "goals" ? selectedGoals.length > 0
    : step === "consent" ? ageConfirmed && acceptedRequiredPolicies
    : true;

  function next() {
    setError(undefined);
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }

  function back() {
    setError(undefined);
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify({
          displayName: displayName.trim(),
          currentLevel,
          learningGoals: selectedGoals,
          interests: selectedInterests,
          dailyMinutes,
          preferredMode,
          timeZone: detectRuntimeTimeZone(),
          focusPreferences,
          speakingConfidence,
          ageConfirmed,
          acceptedRequiredPolicies,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) setNeedsSignIn(true);
        setError(payload.error ?? "We could not save your learning plan.");
        return;
      }

      router.push("/today?tour=1");
    } catch {
      setError("We could not save your learning plan. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (authError) {
    return (
      <main id="main-content" className="page-shell py-10">
        <section className="card mx-auto max-w-2xl">
          <p className="status-error" role="alert">{authError}</p>
          <button className="button-primary mt-5" type="button" onClick={() => setAuthCheckAttempt((attempt) => attempt + 1)}>
            Try sign-in check again
          </button>
        </section>
      </main>
    );
  }

  if (needsSignIn === undefined) {
    return (
      <main id="main-content" className="page-shell py-10">
        <div className="card mx-auto max-w-2xl animate-pulse">Getting your setup ready…</div>
      </main>
    );
  }

  if (needsSignIn) {
    return (
      <main id="main-content" className="page-shell py-10">
        <section className="card mx-auto max-w-2xl">
          <p className="eyebrow">Before we start</p>
          <h1 className="mt-2 text-3xl font-black">Create your free account first.</h1>
          <p className="mt-3 text-ink/70">
            Your sessions, review timing, and progress are saved to your account, so two minutes of setup means
            nothing you learn gets lost.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="button-primary" href="/auth/sign-in?redirectTo=/onboarding">
              Create account or sign in
            </Link>
            <Link className="button-secondary" href="/demo">
              Try it first without an account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="page-shell py-10">
      <section className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Step {stepIndex + 1} of {steps.length}</p>
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((name, index) => (
              <span key={name} className={`h-1.5 w-6 rounded-full ${index <= stepIndex ? "bg-coral" : "bg-ink/15"}`} />
            ))}
          </div>
        </div>
        <h1 className="mt-2 text-4xl font-black">{stepTitles[step]}</h1>

        <div className="card mt-7 space-y-6">
          {step === "name" && (
            <>
              <label className="block font-bold">
                What should we call you?
                <input
                  className="field"
                  value={displayName}
                  placeholder="Your first name"
                  onChange={(event) => setDisplayName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && stepValid) next(); }}
                  maxLength={60}
                  autoFocus
                  required
                />
              </label>
              <p className="text-sm text-ink/75">Just a name for your sessions — you can change it any time.</p>
            </>
          )}

          {step === "goals" && (
            <fieldset>
              <legend className="font-bold">Why are you learning French?</legend>
              <p className="mt-1 text-sm text-ink/75">
                Pick everything that applies. We use your goals to choose relevant practice recommendations.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {goalOptions.map((goal) => (
                  <button
                    key={goal}
                    className={
                      selectedGoals.includes(goal)
                        ? "rounded-xl bg-ink px-4 py-2 font-bold text-white"
                        : "rounded-xl border border-ink/20 bg-white px-4 py-2 font-bold"
                    }
                    type="button"
                    aria-pressed={selectedGoals.includes(goal)}
                    onClick={() => toggle(goal, selectedGoals, setSelectedGoals, 6)}
                  >
                    {goal}
                  </button>
                ))}
              </div>
              <p className="mt-5 text-sm text-ink/75">
                We’ll start conservatively at A1. You can change your session length and practice focus later in Settings.
              </p>
            </fieldset>
          )}

          {step === "level" && (
            <>
              <label className="block font-bold">
                Current French level
                <select
                  className="field"
                  value={currentLevel}
                  onChange={(event) => setCurrentLevel(event.target.value as CefrLevel)}
                >
                  {cefrLevels.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </label>

              {!checkOpen && !checkDone && (
                <button className="button-secondary" type="button" onClick={() => setCheckOpen(true)}>
                  Not sure? Take a 60-second check
                </button>
              )}

              {checkOpen && !checkDone && placementActivities[checkIndex] && (
                <div className="rounded-2xl bg-cream p-5">
                  <p className="eyebrow">Quick check · {checkIndex + 1} of {placementActivities.length}</p>
                  <p className="mt-2 text-sm text-ink/70">
                    This checks a few A1 foundations without teaching the answer first. It is not a full CEFR placement test.
                  </p>
                  <p className="mt-2 font-black">{placementActivities[checkIndex].prompt}</p>
                  {checkResolution ? (
                    <div className="mt-4" aria-live="polite">
                      <p className={checkResolution.correct ? "status-success" : "status-error"}>{checkResolution.message}</p>
                      <button className="button-primary mt-4" type="button" onClick={continueCheck}>Continue placement check</button>
                    </div>
                  ) : (
                    <>
                      <ActivityRenderer activity={placementActivities[checkIndex]} disabled={false} onSubmit={submitCheckAnswer} />
                      <button className="button-secondary mt-4" type="button" onClick={revealCheckAnswer}>
                        Show answer without placement credit
                      </button>
                    </>
                  )}
                </div>
              )}

              {checkDone && (
                <div className="status-success" aria-live="polite">
                  <p>
                    {checkCorrect === placementActivities.length
                      ? `Those A1 basics look solid. This short check cannot distinguish A2 from higher levels, so your selection remains ${currentLevel}.`
                      : `Some A1 basics need another look. Your selection remains ${currentLevel}; choose A1 only if that better reflects your wider experience.`}
                  </p>
                  {checkCorrect < placementActivities.length && currentLevel !== "A1" && (
                    <button className="mt-3 font-black underline underline-offset-4" type="button" onClick={() => setCurrentLevel("A1")}>
                      Use A1 for my plan
                    </button>
                  )}
                </div>
              )}

              <p className="text-sm text-ink/75">
                The check is optional and covers only A1 foundations. It never changes your selected level automatically.
              </p>
            </>
          )}

          {step === "interests" && (
            <fieldset>
              <legend className="font-bold">What do you enjoy?</legend>
              <p className="mt-1 text-sm text-ink/75">
                Choose a few interests so topic recommendations can feel more relevant. Reviewed lesson wording stays consistent for every learner.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {interestOptions.map((interest) => (
                  <button
                    key={interest}
                    className={
                      selectedInterests.includes(interest)
                        ? "rounded-xl bg-ink px-4 py-2 font-bold text-white"
                        : "rounded-xl border border-ink/20 bg-white px-4 py-2 font-bold"
                    }
                    type="button"
                    aria-pressed={selectedInterests.includes(interest)}
                    onClick={() => toggle(interest, selectedInterests, setSelectedInterests)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  className="field mt-0 flex-1"
                  aria-label="Custom interest"
                  value={customInterest}
                  placeholder="Add your own…"
                  maxLength={30}
                  onChange={(event) => setCustomInterest(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomInterest(); } }}
                />
                <button className="button-secondary" type="button" onClick={addCustomInterest}>Add</button>
              </div>
            </fieldset>
          )}

          {step === "rhythm" && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block font-bold">
                  Daily time
                  <select
                    className="field"
                    value={dailyTimeChoice}
                    onChange={(event) => {
                      setDailyTimeChoice(event.target.value);
                      if (event.target.value !== "custom") setDailyMinutes(Number(event.target.value));
                    }}
                  >
                    <option value="3">2–3 minutes</option>
                    <option value="8">8 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="custom">Custom, 2–60 minutes</option>
                  </select>
                </label>

                <label className="block font-bold">
                  Session feel
                  <select
                    className="field"
                    value={preferredMode}
                    onChange={(event) => setPreferredMode(event.target.value as "normal" | "short")}
                  >
                    <option value="normal">A normal mixed session</option>
                    <option value="short">A quick two-minute session</option>
                  </select>
                </label>
              </div>

              {dailyTimeChoice === "custom" && (
                <label className="block font-bold">
                  Custom daily minutes
                  <input
                    className="field"
                    type="number"
                    min={2}
                    max={60}
                    value={dailyMinutes}
                    onChange={(event) => setDailyMinutes(Math.min(60, Math.max(2, Number(event.target.value) || 2)))}
                  />
                </label>
              )}

              <fieldset>
                <legend className="font-bold">Anything you especially want to work on?</legend>
                <p className="mt-1 text-sm text-ink/75">Optional. Sessions stay mixed, but these get extra weight.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {focusOptions.map((option) => (
                    <button
                      key={option.value}
                      className={
                        focusPreferences.includes(option.value)
                          ? "rounded-xl bg-ink px-4 py-2 font-bold text-white"
                          : "rounded-xl border border-ink/20 bg-white px-4 py-2 font-bold"
                      }
                      type="button"
                      aria-pressed={focusPreferences.includes(option.value)}
                      onClick={() => toggle(option.value, focusPreferences, setFocusPreferences, 4)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block font-bold">
                How confident do you feel saying French out loud?
                <select
                  className="field"
                  value={speakingConfidence}
                  onChange={(event) => setSpeakingConfidence(event.target.value as "low" | "medium" | "high")}
                >
                  <option value="low">Nervous — ease me in</option>
                  <option value="medium">Okay — normal pace</option>
                  <option value="high">Confident — push me</option>
                </select>
              </label>
            </>
          )}

          {step === "consent" && (
            <>
              <label className="flex items-start gap-3 rounded-2xl bg-cream p-4 text-sm text-ink/75">
                <input
                  className="mt-1 size-4 accent-coral"
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(event) => setAgeConfirmed(event.target.checked)}
                />
                <span className="font-bold">I confirm I am 13 or older.</span>
              </label>

              <div className="flex items-start gap-3 rounded-2xl bg-cream p-4 text-sm text-ink/75">
                <input
                  id="required-policies"
                  className="mt-1 size-4 accent-coral"
                  type="checkbox"
                  checked={acceptedRequiredPolicies}
                  aria-describedby="required-policies-links"
                  onChange={(event) => setAcceptedRequiredPolicies(event.target.checked)}
                />
                <div>
                  <label className="font-bold" htmlFor="required-policies">
                    I accept the required privacy notice, terms, and AI-tutor notices.
                  </label>
                  <p id="required-policies-links" className="mt-1">
                    Read the{" "}
                    <Link className="font-black text-coral underline" href="/privacy">privacy notice</Link>
                    {" "}and{" "}
                    <Link className="font-black text-coral underline" href="/terms">terms</Link>.
                    Marketing is always opt-in.
                  </p>
                </div>
              </div>
            </>
          )}

          {error && <p className="status-error" role="alert">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            {stepIndex > 0 ? (
              <button className="button-secondary" type="button" onClick={back}>Back</button>
            ) : <span />}
            {step === "consent" ? (
              <button className="button-primary" type="button" disabled={saving || !stepValid} onClick={submit}>
                {saving ? "Building your plan…" : "Build my first session"}
              </button>
            ) : (
              <button className="button-primary" type="button" disabled={!stepValid} onClick={next}>
                Continue
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
