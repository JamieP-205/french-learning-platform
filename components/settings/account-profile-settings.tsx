"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LearnerProfile } from "@/lib/domain/types";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { syncStoredSpeechSpeed } from "@/lib/speech/speed-preference";
import { syncStoredThemePreference } from "@/lib/theme/theme-preference";
import { detectRuntimeTimeZone } from "@/lib/time/calendar-day";

const focusOptions = [
  { value: "speaking", label: "Speaking" },
  { value: "listening", label: "Listening" },
  { value: "writing", label: "Writing" },
  { value: "review", label: "Review" },
] as const;

const goalOptions = ["travel", "work", "relationships", "exams", "culture", "hobby"] as const;
const levelOptions = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function AccountProfileSettings() {
  const [profile, setProfile] = useState<LearnerProfile>();
  const [state, setState] = useState<"loading" | "signed-out" | "no-profile" | "ready">("loading");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [interestText, setInterestText] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const accessToken = await getBrowserAccessToken();
        if (!accessToken && getBrowserSupabase()) {
          if (!cancelled) setState("signed-out");
          return;
        }
        const response = await fetch("/api/profile", { headers: await getBrowserAuthHeaders() });
        const payload = await response.json();
        if (cancelled) return;
        if (response.status === 409) return setState("no-profile");
        if (!response.ok) {
          setError(payload.error);
          setState("ready");
          return;
        }
        setProfile(payload.profile);
        setInterestText((payload.profile.interests ?? []).join(", "));
        syncStoredSpeechSpeed(payload.profile.speechSpeed);
        syncStoredThemePreference(payload.profile.themePreference);
        setState("ready");
      } catch {
        if (!cancelled) {
          setError("Your settings could not load.");
          setState("ready");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!profile) return;
    const interests = [...new Set(
      interestText
        .split(",")
        .map((interest) => interest.trim().toLowerCase())
        .filter(Boolean),
    )].slice(0, 12);
    setSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify({
          displayName: profile.displayName,
          currentLevel: profile.currentLevel,
          learningGoals: profile.learningGoals,
          interests,
          dailyMinutes: profile.dailyMinutes,
          preferredMode: profile.preferredMode,
          timeZone: detectRuntimeTimeZone(),
          focusPreferences: profile.focusPreferences ?? [],
          speakingConfidence: profile.speakingConfidence ?? "medium",
          speechSpeed: profile.speechSpeed ?? "normal",
          themePreference: profile.themePreference ?? "system",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Your settings could not be saved.");
        return;
      }
      setProfile(payload.profile);
      setInterestText((payload.profile.interests ?? []).join(", "));
      syncStoredSpeechSpeed(payload.profile.speechSpeed);
      syncStoredThemePreference(payload.profile.themePreference);
      setMessage("Saved. Your next session uses these straight away.");
    } catch {
      setError("Your settings could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <div className="card animate-pulse">Loading your learning setup…</div>;

  if (state === "signed-out") {
    return (
      <div className="card">
        <p className="eyebrow">Learning setup</p>
        <h2 className="mt-2 text-2xl font-black">Sign in to change your plan</h2>
        <p className="mt-3 text-ink/75">Account settings cover your name, daily time, session feel, and focus areas.</p>
        <Link className="button-primary mt-6" href="/auth/sign-in?redirectTo=/settings">Sign in</Link>
      </div>
    );
  }

  if (state === "no-profile") {
    return (
      <div className="card">
        <p className="eyebrow">Learning setup</p>
        <h2 className="mt-2 text-2xl font-black">Finish onboarding first</h2>
        <p className="mt-3 text-ink/75">Two minutes of setup builds your first personalised session.</p>
        <Link className="button-primary mt-6" href="/onboarding">Start onboarding</Link>
      </div>
    );
  }

  if (!profile) return error ? <p className="status-error" role="alert">{error}</p> : null;

  return (
    <div className="card">
      <p className="eyebrow">Learning setup</p>
      <h2 className="mt-2 text-2xl font-black">Change your learning plan</h2>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block font-bold">
          Name
          <input
            className="field"
            value={profile.displayName}
            maxLength={60}
            onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
          />
        </label>

        <label className="block font-bold">
          Daily minutes
          <input
            className="field"
            type="number"
            min={2}
            max={60}
            value={profile.dailyMinutes}
            onChange={(event) =>
              setProfile({ ...profile, dailyMinutes: Math.min(60, Math.max(2, Number(event.target.value) || 2)) })
            }
          />
        </label>

        <label className="block font-bold">
          Current level
          <select
            className="field"
            value={profile.currentLevel}
            onChange={(event) => setProfile({ ...profile, currentLevel: event.target.value as LearnerProfile["currentLevel"] })}
          >
            {levelOptions.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>

        <label className="block font-bold">
          Session feel
          <select
            className="field"
            value={profile.preferredMode}
            onChange={(event) => setProfile({ ...profile, preferredMode: event.target.value as "normal" | "short" })}
          >
            <option value="normal">A normal mixed session</option>
            <option value="short">A quick two-minute session</option>
          </select>
        </label>

        <label className="block font-bold">
          Speaking confidence
          <select
            className="field"
            value={profile.speakingConfidence ?? "medium"}
            onChange={(event) =>
              setProfile({ ...profile, speakingConfidence: event.target.value as "low" | "medium" | "high" })
            }
          >
            <option value="low">Nervous — ease me in</option>
            <option value="medium">Okay — normal pace</option>
            <option value="high">Confident — push me</option>
          </select>
        </label>

        <label className="block font-bold">
          Audio speed
          <select
            className="field"
            value={profile.speechSpeed ?? "normal"}
            onChange={(event) =>
              setProfile({ ...profile, speechSpeed: event.target.value as "normal" | "slow" })
            }
          >
            <option value="normal">Normal, tuned for learners</option>
            <option value="slow">Slower, more time to hear each sound</option>
          </select>
        </label>

        <label className="block font-bold">
          Theme
          <select
            className="field"
            value={profile.themePreference ?? "system"}
            onChange={(event) =>
              setProfile({ ...profile, themePreference: event.target.value as "light" | "dark" | "system" })
            }
          >
            <option value="system">Match my device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="font-bold">Goals</legend>
        <p className="mt-1 text-sm text-ink/60">Choose at least one. This guides recommendations and tutor examples.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {goalOptions.map((goal) => {
            const selected = profile.learningGoals.includes(goal);
            return (
              <button
                key={goal}
                type="button"
                aria-pressed={selected}
                className={selected ? "rounded-xl bg-ink px-4 py-2 font-bold capitalize text-white" : "rounded-xl border border-ink/20 bg-white px-4 py-2 font-bold capitalize"}
                onClick={() => setProfile({
                  ...profile,
                  learningGoals: selected
                    ? profile.learningGoals.length > 1
                      ? profile.learningGoals.filter((item) => item !== goal)
                      : profile.learningGoals
                    : [...profile.learningGoals, goal],
                })}
              >
                {goal}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-5 block font-bold">
        Interests
        <span className="mt-1 block text-sm font-normal text-ink/60">Separate interests with commas; up to 12.</span>
        <input
          className="field"
          value={interestText}
          maxLength={360}
          placeholder="music, food, films"
          onChange={(event) => setInterestText(event.target.value)}
        />
      </label>

      <fieldset className="mt-5">
        <legend className="font-bold">Extra focus</legend>
        <p className="mt-1 text-sm text-ink/60">Sessions stay mixed; these areas simply come earlier and more often.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {focusOptions.map((option) => {
            const selected = profile.focusPreferences?.includes(option.value) ?? false;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                className={
                  selected
                    ? "rounded-xl bg-ink px-4 py-2 font-bold text-white"
                    : "rounded-xl border border-ink/20 bg-white px-4 py-2 font-bold"
                }
                onClick={() =>
                  setProfile({
                    ...profile,
                    focusPreferences: selected
                      ? (profile.focusPreferences ?? []).filter((item) => item !== option.value)
                      : [...(profile.focusPreferences ?? []), option.value],
                  })
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && <p className="status-error mt-5" role="alert">{error}</p>}
      {message && <p className="status-success mt-5" role="status">{message}</p>}

      <button className="button-primary mt-6" disabled={saving || !profile.displayName.trim() || profile.learningGoals.length === 0} onClick={save}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
