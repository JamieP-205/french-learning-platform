"use client";

import Link from "next/link";
import { useState } from "react";
import type { TopicPreview } from "@/lib/content/topic-previews";
import { AppShell } from "@/components/app-shell";
import { ScoredMissionStartButton } from "@/components/learn/scored-mission-start-button";
import { TopicPreviewPractice } from "@/components/learn/topic-preview-practice";

export function TopicPreviewPage({ topic }: { topic: TopicPreview }) {
  const hasScoredMission = topic.status === "ready";
  const [previewAttemptActive, setPreviewAttemptActive] = useState(false);

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">{topic.level} practical topic</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">{topic.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-ink/75">{topic.description}</p>
          </div>
          <span className="rounded-full bg-cream px-4 py-2 text-sm font-black text-ink/70">
            {topic.statusLabel}
          </span>
        </div>

        <section className="card mt-8">
          <p className="eyebrow">Outcome</p>
          <h2 className="mt-2 text-2xl font-black">{topic.outcome}</h2>
          <p className="mt-3 text-sm text-ink/65">{topic.sourceNote}</p>
          {hasScoredMission && (
            <div className="mt-6">
              <ScoredMissionStartButton missionSlug={topic.slug} label="Start full lesson" />
            </div>
          )}
          {!hasScoredMission && topic.status === "practice_preview" && (
            <div className="mt-6 rounded-2xl bg-cream p-4 text-sm font-bold text-ink/70">
              Practise these phrases now and choose what should return in Review. The full lesson will become available after its answers and feedback have been reviewed.
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          {!previewAttemptActive && <div className="card">
            <h2 className="text-2xl font-black">Useful phrases</h2>
            <div className="mt-5 space-y-4">
              {topic.phrases.map((phrase) => (
                <article key={phrase.french} className="rounded-2xl bg-cream p-4">
                  <p className="text-xl font-black" lang="fr">{phrase.french}</p>
                  <p className="mt-1 font-bold text-ink/75">{phrase.english}</p>
                  <p className="mt-3 text-sm text-ink/70">{phrase.note}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-wide text-coral">{phrase.register}</p>
                  {phrase.commonTrap && (
                    <p className="mt-3 rounded-xl bg-surface p-3 text-sm text-ink/70">
                      Avoid as a default: <span className="font-black" lang="fr">{phrase.commonTrap}</span>
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>}

          <aside className="space-y-5">
            {topic.selfChecks.length > 0 && (
              <TopicPreviewPractice
                topicSlug={topic.slug}
                selfChecks={topic.selfChecks}
                onScoredStateChange={setPreviewAttemptActive}
              />
            )}

            {!previewAttemptActive && <section className="card">
              <p className="eyebrow">Grammar focus</p>
              <ul className="mt-4 space-y-3">
                {topic.grammarFocus.map((item) => (
                  <li key={item} className="rounded-2xl bg-cream p-3 font-bold">{item}</li>
                ))}
              </ul>
            </section>}

            {!previewAttemptActive && <section className="card">
              <p className="eyebrow">Self-checks</p>
              <div className="mt-4 space-y-3">
                {topic.selfChecks.map((check) => (
                  <details key={check.prompt} className="rounded-2xl bg-cream p-4">
                    <summary className="cursor-pointer font-black">{check.prompt}</summary>
                    <p className="mt-3 text-lg font-black" lang="fr">{check.answer}</p>
                    <p className="mt-1 text-sm text-ink/70">{check.reason}</p>
                  </details>
                ))}
              </div>
            </section>}
          </aside>
        </section>

        <section className="card mt-6">
          <p className="eyebrow">What this prepares you for</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {topic.comingNext.map((item) => (
              <div key={item} className="rounded-2xl bg-cream p-4 font-bold">{item}</div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/learn" className="button-secondary">Back to Learn</Link>
            {hasScoredMission && (
              <ScoredMissionStartButton
                missionSlug={topic.slug}
                label="Start full lesson"
                className="button-primary"
              />
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
