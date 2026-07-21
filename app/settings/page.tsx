"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AccountProfileSettings } from "@/components/settings/account-profile-settings";
import { LocalLearningDataControls } from "@/components/settings/local-learning-data-controls";
import { LocalLearningPreferences } from "@/components/settings/local-learning-preferences";
import { LearningModeUnavailable } from "@/components/learning-mode-unavailable";
import { useLearningMode } from "@/lib/auth/use-learning-mode";
import { contentStatus } from "@/lib/content/content-status";

export default function SettingsPage() {
  const learningMode = useLearningMode();
  const status = contentStatus();

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Settings</p>
        <h1 className="mt-2 text-4xl font-black">Your profile and learning controls.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Set the pace, goals, and practice focus that should shape your next session.
        </p>

        {learningMode === "loading" && (
          <div className="card mt-7" role="status">Loading your settings...</div>
        )}
        {learningMode === "unavailable" && <LearningModeUnavailable />}
        {learningMode === "account" && (
          <section className="mt-7">
            <AccountProfileSettings />
          </section>
        )}
        {learningMode === "local" && (
          <section className="mt-7">
            <LocalLearningPreferences />
          </section>
        )}
        {(learningMode === "local" || learningMode === "account") && (
          <section className="mt-7">
            <LocalLearningDataControls />
          </section>
        )}

        <section className="mt-7 grid gap-5 lg:grid-cols-2">
          <div className="card">
            <p className="eyebrow">Learning setup</p>
            <h2 className="mt-2 text-2xl font-black">Keep setup lightweight</h2>
            <p className="mt-3 text-ink/75">
              {learningMode === "account"
                ? "Name, level, goals, session length, speaking confidence, and practice focus can be changed above without repeating onboarding."
                : learningMode === "local"
                  ? "Name, level, main goal, daily time, and session feel can be changed above whenever your routine changes."
                  : "Learning controls will appear after the app confirms whether this is an account or device-only session."}
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Speaking</p>
            <h2 className="mt-2 text-2xl font-black">Speech practice on supported browsers</h2>
            <p className="mt-3 text-ink/75">
              Where supported, Speak compares recognised words with the target phrase. The app does not store recordings,
              but your browser or speech provider may process audio. You can still complete a self-check without automatic matching.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Data</p>
            <h2 className="mt-2 text-2xl font-black">Account data controls</h2>
            <p className="mt-3 text-ink/75">
              {learningMode === "account"
                ? "Account-linked learner-data export and deletion live in the privacy centre. Browser-only data controls remain above because data saved on this device stays separate from your account."
                : learningMode === "local"
                  ? "Browser-only progress can be exported or reset above; it never leaves this device."
                  : "Data controls will appear after the app confirms whether this is an account or device-only session."}
            </p>
            <p className="mt-3 text-sm text-ink/65">
              A short technical log that protects the service from abuse clears itself within eight days. If a safety
              report or block involved your account, that record can outlive a data deletion. Credits for reviewed
              course content are kept under their own policy.
            </p>
            <Link className="button-secondary mt-6" href="/privacy">
              Open privacy centre
            </Link>
          </div>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">What you have now</p>
          <h2 className="mt-2 text-2xl font-black">The course, honestly counted.</h2>
          <p className="mt-3 text-ink/75">
            {status.publishedMissionCount} reviewed scored {status.publishedMissionCount === 1 ? "lesson" : "lessons"},{" "}
            {status.roleplayScenarioCount} roleplay scenarios with {status.registerComparisonCount} register
            comparisons, topic badges earned by real production, and a schedule view of your last two weeks.
            {status.inReviewMissionCount > 0 && (
              <> {status.inReviewMissionCount} more {status.inReviewMissionCount === 1 ? "lesson is" : "lessons are"} written
              and waiting on content review: {status.inReviewMissionTitles.join(" and ")}.</>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="button-secondary" href="/schedule">Your schedule</Link>
            <Link className="button-secondary" href="/progress">Topic badges</Link>
            <Link className="button-secondary" href="/roleplay">Roleplay practice</Link>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
