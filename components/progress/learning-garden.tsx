// The garden grows from durable learning signals. Time away can soften the
// light, but it never removes anything the learner earned. Milestone
// definitions live in lib/progress/milestones; the painted growth pieces
// live in garden-art.

import { GardenScene } from "@/components/progress/garden-art";
import { gardenMilestones, type GardenProgress } from "@/lib/progress/milestones";

export type { GardenProgress };

export function LearningGarden({ progress }: { progress: GardenProgress }) {
  const unlocks = gardenMilestones(progress);
  const earned = new Set(unlocks.filter((unlock) => unlock.earned).map((unlock) => unlock.id));
  const away = progress.habit.tone === "comeback";
  const nextUnlock = unlocks.find((unlock) => !unlock.earned);
  const nextProgress = nextUnlock
    ? Math.min(100, Math.round((nextUnlock.current / nextUnlock.target) * 100))
    : 100;

  return (
    <div>
      <div
        aria-label={`Your learning garden with ${earned.size} of ${unlocks.length} features grown`}
        role="img"
      >
        <GardenScene away={away} earned={earned} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {unlocks.map((unlock) => (
          <span
            className={`garden-badge ${unlock.earned ? "garden-badge-earned" : ""}`}
            key={unlock.id}
            title={unlock.earnedBy}
          >
            <span aria-hidden="true">{unlock.earned ? "✓" : "·"}</span>
            {unlock.label}
          </span>
        ))}
      </div>

      {nextUnlock ? (
        <div className="mt-5 rounded-2xl border border-ink/10 bg-surface/80 p-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <p>
              Next to grow: <strong>{nextUnlock.label}</strong>
            </p>
            <span className="font-black text-moss">{Math.min(nextUnlock.current, nextUnlock.target)}/{nextUnlock.target}</span>
          </div>
          <div aria-label={`${nextUnlock.label} progress`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={nextProgress} className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar">
            <div className="h-full rounded-full bg-moss transition-all" style={{ width: `${nextProgress}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink/60">{nextUnlock.earnedBy}.</p>
        </div>
      ) : (
        <p className="mt-4 font-black text-moss">Every current garden feature is flourishing. New chapters will add more.</p>
      )}
      {away && <p className="mt-3 text-sm text-ink/70">The garden is resting, not fading. It brightens as soon as you return; nothing is lost.</p>}
    </div>
  );
}
