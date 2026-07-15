"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";

export default function PrivacyPage() {
  const [message, setMessage] = useState<string>();
  const [confirming, setConfirming] = useState(false);

  async function exportData() {
    const response = await fetch("/api/privacy/export", {
      method: "POST",
      headers: await getBrowserAuthHeaders(),
    });

    if (!response.ok) {
      return setMessage("Your export could not be prepared. Sign in again if your session has expired.");
    }

    const text = await response.text();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "learning-data.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Your learning-data export is ready.");
  }

  async function deleteData() {
    const response = await fetch("/api/privacy/delete", {
      method: "POST",
      headers: await getBrowserAuthHeaders(),
    });

    setMessage(
      response.ok
        ? "Your learner data has been deleted from this environment."
        : "Deletion could not be completed. Sign in again if your session has expired.",
    );
    setConfirming(false);
  }

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Privacy centre</p>
        <h1 className="mt-2 text-4xl font-black">Clear choices about your learning data.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Public demo use does not create a learner account or save personal learning data. Account-based learning
          stores the minimum learner state needed for progress, review, tutor safety, and opt-in social features.
        </p>

        <section className="card mt-7 max-w-3xl space-y-6">
          <div>
            <h2 className="font-black">No-account demo</h2>
            <p className="mt-2 text-ink/70">
              The public demo runs in your browser against verified lesson content. It does not create a profile, save
              attempts, or call the AI tutor.
            </p>
          </div>

          <div>
            <h2 className="font-black">What we store for learning</h2>
            <p className="mt-2 text-ink/70">
              Profile preferences, required consents, attempts, mistakes, review timing, streak state, friend-code
              social records, co-op challenges, and concise tutor safety logs. This MVP does not store voice recordings.
            </p>
          </div>

          <div>
            <h2 className="font-black">What we do not do</h2>
            <p className="mt-2 text-ink/70">
              We do not rely on a model to remember you, sell your learning history, store speech recordings in this MVP,
              or use generated content as official course content.
            </p>
          </div>

          <div>
            <h2 className="font-black">AI tutor notice</h2>
            <p className="mt-2 text-ink/70">
              If enabled for an account session, tutor requests receive only compact task context: the current activity,
              submitted answer, deterministic result, relevant verified snippets, and safe constraints.
            </p>
          </div>

          <div>
            <h2 className="font-black">Launch gate</h2>
            <p className="mt-2 text-ink/70">
              Onboarding requires a 13+ self-declaration and required policy consents. Before a broad public launch,
              the consent language, retention approach, support process, and youth safeguards still need formal approval.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="button-secondary" onClick={exportData}>
              Export my data
            </button>
            {confirming ? (
              <>
                <button className="button-primary bg-coral hover:bg-coral/90" onClick={deleteData}>
                  Confirm deletion
                </button>
                <button className="button-secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="button-secondary" onClick={() => setConfirming(true)}>
                Delete my learner data
              </button>
            )}
            <Link className="button-secondary" href="/terms">
              Terms and safety
            </Link>
          </div>

          {message && (
            <p className="status-success" role="status">
              {message}
            </p>
          )}
        </section>
      </main>
    </AppShell>
  );
}
