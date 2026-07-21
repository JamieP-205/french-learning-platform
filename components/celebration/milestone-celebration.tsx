"use client";

import { useEffect, useMemo, useRef } from "react";
import { RemyArt } from "@/components/companion/remy-art";
import type { ProgressSnapshot } from "@/lib/domain/types";

function celebrationCopy(progress?: ProgressSnapshot) {
  if (progress?.sessionsCompleted === 1) {
    return {
      eyebrow: "Your first milestone",
      title: "You’ve taken your first real step.",
      detail: "You finished a complete French lesson, recalled useful language, and gave your garden its first bit of life.",
    };
  }
  if ((progress?.currentStreak ?? 0) >= 7 && progress!.currentStreak % 7 === 0) {
    return {
      eyebrow: "A full week",
      title: `${progress!.currentStreak} days. Your French has a rhythm now.`,
      detail: "A streak freeze is there to protect this habit when real life interrupts.",
    };
  }
  if ((progress?.sessionsCompleted ?? 0) === 5) {
    return {
      eyebrow: "Garden milestone",
      title: "Five sessions, and the garden has somewhere to gather.",
      detail: "You have returned often enough for your learning space to feel lived in.",
    };
  }
  if ((progress?.sessionsCompleted ?? 0) === 10) {
    return {
      eyebrow: "Ten sessions",
      title: "Look how much you’ve grown.",
      detail: "Ten finished lessons means ten times you chose to make your French more usable.",
    };
  }
  return {
    eyebrow: "Lesson complete",
    title: "That was a real piece of progress.",
    detail: "Your useful answers are saved, weak points can return in review, and the next lesson will adapt.",
  };
}

export function MilestoneCelebration({
  open,
  progress,
  onContinue,
}: {
  open: boolean;
  progress?: ProgressSnapshot;
  onContinue: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const copy = useMemo(() => celebrationCopy(progress), [progress]);

  useEffect(() => {
    if (open) window.setTimeout(() => buttonRef.current?.focus(), 0);
  }, [open]);

  if (!open) return null;

  return (
    <div className="celebration-backdrop">
      <div aria-labelledby="celebration-title" aria-modal="true" className="celebration-card" role="dialog">
        <div className="celebration-burst" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--piece": index } as React.CSSProperties} />)}
        </div>
        <span className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-surface bg-cream shadow-lg">
          <RemyArt pose="celebrating" size={96} />
        </span>
        <p className="eyebrow mt-5">{copy.eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black leading-tight" id="celebration-title">{copy.title}</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-ink/70">{copy.detail}</p>
        {progress && (
          <div className="mt-5 flex justify-center gap-2 text-sm font-black">
            <span className="rounded-full bg-moss/10 px-3 py-2">{progress.currentStreak}-day streak</span>
            <span className="rounded-full bg-coral/10 px-3 py-2">{progress.sessionsCompleted} session{progress.sessionsCompleted === 1 ? "" : "s"}</span>
          </div>
        )}
        <button className="button-primary mt-7 w-full" onClick={onContinue} ref={buttonRef} type="button">
          See what grew
        </button>
      </div>
    </div>
  );
}
