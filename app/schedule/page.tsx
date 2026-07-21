"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LearningScheduleCard } from "@/components/schedule/learning-schedule-card";
import { LearningModeUnavailable } from "@/components/learning-mode-unavailable";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";
import { useLearningMode } from "@/lib/auth/use-learning-mode";
import { localLearningStorageKey } from "@/lib/local-learning/progress";
import { calendarDayKey } from "@/lib/time/calendar-day";

function lastFourteenDays(now = new Date()) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (13 - index));
    return date;
  });
}

function readLocalActiveDates(): string[] {
  try {
    const raw = window.localStorage.getItem(localLearningStorageKey);
    const parsed = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(parsed?.activeDates) ? parsed.activeDates : [];
  } catch {
    return [];
  }
}

export default function SchedulePage() {
  const learningMode = useLearningMode();
  const [practisedDays, setPractisedDays] = useState<Set<string>>();

  useEffect(() => {
    if (learningMode === "loading" || learningMode === "unavailable") return;
    let cancelled = false;

    async function load() {
      if (learningMode === "local") {
        if (!cancelled) setPractisedDays(new Set(readLocalActiveDates()));
        return;
      }
      try {
        const response = await fetch("/api/progress", { headers: await getBrowserAuthHeaders() });
        const payload = await response.json();
        if (!cancelled) {
          setPractisedDays(new Set(response.ok ? payload.progress.recentSessionDays ?? [] : []));
        }
      } catch {
        if (!cancelled) setPractisedDays(new Set());
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [learningMode]);

  const days = lastFourteenDays();
  const today = calendarDayKey(new Date());

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Schedule</p>
        <h1 className="mt-2 text-4xl font-black">Your learning rhythm.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Pick the days that fit your life, get reminded the way you prefer, and see the last two
          weeks at a glance.
        </p>

        {learningMode === "unavailable" && <LearningModeUnavailable />}

        {learningMode !== "loading" && learningMode !== "unavailable" && (
          <>
            <section aria-label="The last two weeks" className="card mt-7">
              <p className="eyebrow">The last two weeks</p>
              <h2 className="mt-2 text-2xl font-black">Days you practised.</h2>
              <div className="mt-5 grid grid-cols-7 gap-2">
                {days.map((date) => {
                  const key = calendarDayKey(date);
                  const practised = practisedDays?.has(key) ?? false;
                  const isToday = key === today;
                  return (
                    <div
                      key={key}
                      className={`flex min-h-14 flex-col items-center justify-center rounded-xl border text-xs font-black ${
                        practised
                          ? "border-moss/40 bg-moss/15 text-moss"
                          : "border-ink/10 bg-surface text-ink/55"
                      } ${isToday ? "outline outline-2 outline-amber" : ""}`}
                      title={practised ? `Practised on ${key}` : key}
                    >
                      <span>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                      <span className="mt-0.5">{date.getDate()}</span>
                      <span aria-hidden="true">{practised ? "✓" : "·"}</span>
                      <span className="sr-only">{practised ? "practised" : "no session"}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-sm text-ink/70">
                A quiet day is fine. Your streak earns a freeze every seven days, and one absorbs a
                single missed day on its own. The garden never loses anything either way.
              </p>
            </section>

            <div className="mt-7">
              <LearningScheduleCard />
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
