"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProgressSnapshot } from "@/lib/domain/types";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";
import { useLearningMode } from "@/lib/auth/use-learning-mode";

type CompanionChoice = "next" | "encourage" | "phrase" | "streak";
type ProfileSummary = { displayName?: string };

function routePhrase(pathname: string) {
  if (pathname.startsWith("/listen")) {
    return { french: "Pouvez-vous répéter, s'il vous plaît ?", english: "Could you repeat, please?" };
  }
  if (pathname.startsWith("/speak")) {
    return { french: "Encore une fois.", english: "One more time." };
  }
  return { french: "On y va ?", english: "Shall we go?" };
}

function moodFor(progress?: ProgressSnapshot) {
  if (!progress || progress.sessionsCompleted === 0) return { id: "curious", label: "Curious", opener: "We can start very small." };
  if (progress.habit?.tone === "fresh") return { id: "proud", label: "Proud", opener: "You showed up today. I noticed." };
  if (progress.habit?.tone === "comeback") return { id: "cosy", label: "Glad you’re here", opener: "No guilt. We just pick up one useful thread." };
  if (progress.reviewsDue > 0) return { id: "focused", label: "Focused", opener: "There’s one useful thing ready to review." };
  return { id: "ready", label: "Ready", opener: "A little French will travel further than you think." };
}

export function RemyCompanion() {
  const pathname = usePathname();
  const learningMode = useLearningMode();
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<ProgressSnapshot>();
  const [profile, setProfile] = useState<ProfileSummary>();
  const [reply, setReply] = useState<string>();
  const mood = useMemo(() => moodFor(progress), [progress]);

  useEffect(() => {
    if (learningMode !== "account") return;
    let cancelled = false;

    async function loadCompanionContext() {
      try {
        const headers = await getBrowserAuthHeaders();
        const [nextProgress, nextProfile] = await Promise.all([
          fetch("/api/progress", { headers }).then(async (response) => response.ok ? (await response.json()).progress : undefined),
          fetch("/api/profile", { headers }).then(async (response) => response.ok ? (await response.json()).profile : undefined),
        ]);
        if (cancelled) return;
        setProgress(nextProgress as ProgressSnapshot | undefined);
        setProfile(nextProfile as ProfileSummary | undefined);
      } catch {
        // Remy remains useful with route-aware local encouragement.
      }
    }

    void loadCompanionContext();
    return () => {
      cancelled = true;
    };
  }, [learningMode, pathname]);

  function answer(choice: CompanionChoice) {
    if (choice === "next") {
      setReply(progress?.nextAction
        ? `${progress.nextAction.label}. ${progress.nextAction.reason}`
        : pathname.startsWith("/lesson")
          ? "Stay with this one step. Read, answer, notice the feedback—then the next step will feel lighter."
          : "Try one short lesson. You do not need to feel ready before you begin.");
      return;
    }
    if (choice === "encourage") {
      setReply(
        progress?.habit?.tone === "fresh"
          ? "You have already done enough for today. Anything extra is curiosity, not a debt."
          : progress?.habit?.tone === "comeback"
            ? "Being away did not erase what you learned. Let’s wake up one phrase together."
            : "You only need one honest attempt. I’ll stay here for the awkward bit.",
      );
      return;
    }
    if (choice === "streak") {
      setReply(progress
        ? progress.currentStreak > 0
          ? `Your thread is ${progress.currentStreak} day${progress.currentStreak === 1 ? "" : "s"} long. It is proof you returned—not a reason to panic.`
          : "Your streak starts after one completed lesson. We are building a thread, not a trap."
        : "Sign in and finish a lesson to grow a saved streak. No-account practice still counts for you, just on this device.");
      return;
    }
    const phrase = routePhrase(pathname);
    setReply(`${phrase.french} — ${phrase.english} Keep it in your pocket for today.`);
  }

  const greetingName = profile?.displayName?.trim().split(/\s+/)[0];

  return (
    <aside className="remy-dock" data-mood={mood.id}>
      {open && (
        <div aria-label="Chat with Remy" className="remy-panel" role="dialog">
          <div className="flex items-start gap-3">
            <Image alt="" className="h-14 w-14 rounded-2xl object-cover" height={112} src="/images/remy-companion.webp" width={112} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-moss">Remy · {mood.label}</p>
              <p className="mt-1 font-black">{greetingName ? `Salut, ${greetingName}.` : "Salut."} {mood.opener}</p>
            </div>
            <button aria-label="Close Remy" className="ml-auto min-h-11 min-w-11 rounded-xl text-xl hover:bg-cream" onClick={() => setOpen(false)} type="button">×</button>
          </div>

          {reply && <p className="mt-4 rounded-2xl bg-cream p-4 text-sm leading-6" aria-live="polite">{reply}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {([
              ["next", "What next?"],
              ["encourage", "Encourage me"],
              ["phrase", "One phrase"],
              ["streak", "My streak"],
            ] as const).map(([choice, label]) => (
              <button className="remy-choice" key={choice} onClick={() => answer(choice)} type="button">{label}</button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-ink/55">Remy uses your saved progress and reviewed course phrases. He does not invent lessons or judge you.</p>
        </div>
      )}
      <button
        aria-expanded={open}
        aria-label={open ? "Close Remy, your learning companion" : `Talk to Remy. He feels ${mood.label.toLowerCase()}.`}
        className="remy-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Image alt="" className="h-full w-full object-cover" height={160} priority={false} src="/images/remy-companion.webp" width={160} />
        <span className="remy-status" aria-hidden="true" />
      </button>
    </aside>
  );
}
