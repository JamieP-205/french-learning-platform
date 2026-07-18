import type { ProgressSnapshot } from "@/lib/domain/types";

// The learning garden grows only from real mastery signals; nothing here
// unlocks by simply opening the app. When the learner is away the scene dims;
// it never decays or dies.

type GardenUnlock = {
  id: string;
  label: string;
  earnedBy: string;
  earned: boolean;
};

export function gardenUnlocks(progress: ProgressSnapshot): GardenUnlock[] {
  return [
    { id: "sprout", label: "First sprout", earnedBy: "Complete your first session", earned: progress.sessionsCompleted >= 1 },
    { id: "flowers", label: "Flower bed", earnedBy: "Recall your first phrase", earned: progress.phrasesLearned >= 1 },
    { id: "bench", label: "Repaired bench", earnedBy: "Fix a mistake through review", earned: progress.mistakesFixed >= 1 },
    { id: "sun", label: "Morning sun", earnedBy: "Reach a 3-day streak", earned: progress.currentStreak >= 3 },
    { id: "cafe", label: "Cafe stall", earnedBy: "Complete 5 sessions", earned: progress.sessionsCompleted >= 5 },
    { id: "tree", label: "Chestnut tree", earnedBy: "Complete 10 sessions", earned: progress.sessionsCompleted >= 10 },
  ];
}

export function LearningGarden({ progress }: { progress: ProgressSnapshot }) {
  const unlocks = gardenUnlocks(progress);
  const earned = new Set(unlocks.filter((unlock) => unlock.earned).map((unlock) => unlock.id));
  const away = progress.habit.tone === "comeback";
  const nextUnlock = unlocks.find((unlock) => !unlock.earned);

  return (
    <div>
      <svg
        viewBox="0 0 640 240"
        role="img"
        aria-label={`Your learning garden with ${earned.size} of ${unlocks.length} features grown`}
        className={`w-full rounded-3xl transition-opacity ${away ? "opacity-60" : "opacity-100"}`}
      >
        <rect width="640" height="240" fill={away ? "#dfe7ee" : "#e8f1f8"} rx="24" />
        <rect y="170" width="640" height="70" fill="#8fbf9f" rx="24" />
        <rect y="170" width="640" height="18" fill="#7cb08c" />

        {earned.has("sun") && (
          <g>
            <circle cx="560" cy="58" r="26" fill="#f4c95d" />
            {[0, 45, 90, 135].map((angle) => (
              <rect key={angle} x="556" y="16" width="8" height="14" rx="4" fill="#f4c95d" transform={`rotate(${angle} 560 58)`} />
            ))}
          </g>
        )}

        {earned.has("sprout") && (
          <g>
            <rect x="86" y="150" width="6" height="26" rx="3" fill="#3e7d4f" />
            <ellipse cx="80" cy="150" rx="10" ry="6" fill="#57a06a" />
            <ellipse cx="98" cy="146" rx="10" ry="6" fill="#57a06a" />
          </g>
        )}

        {earned.has("flowers") && (
          <g>
            {[150, 178, 206].map((x, index) => (
              <g key={x}>
                <rect x={x} y="152" width="4" height="24" rx="2" fill="#3e7d4f" />
                <circle cx={x + 2} cy="148" r="8" fill={index === 1 ? "#e2725b" : "#e8a1b0"} />
                <circle cx={x + 2} cy="148" r="3" fill="#f4c95d" />
              </g>
            ))}
          </g>
        )}

        {earned.has("bench") && (
          <g>
            <rect x="270" y="150" width="70" height="8" rx="3" fill="#9c6b4f" />
            <rect x="276" y="158" width="8" height="20" fill="#7d543e" />
            <rect x="326" y="158" width="8" height="20" fill="#7d543e" />
            <rect x="270" y="138" width="70" height="7" rx="3" fill="#9c6b4f" />
          </g>
        )}

        {earned.has("cafe") && (
          <g>
            <rect x="390" y="120" width="90" height="58" rx="6" fill="#f7ede2" />
            <rect x="386" y="106" width="98" height="20" rx="6" fill="#e2725b" />
            {[392, 412, 432, 452].map((x) => (
              <rect key={x} x={x} y="106" width="10" height="20" fill="#fdf6ee" />
            ))}
            <rect x="424" y="146" width="22" height="32" rx="3" fill="#7d543e" />
            <text x="399" y="141" fontSize="13" fontWeight="700" fill="#2f2a26">
              CAFE
            </text>
          </g>
        )}

        {earned.has("tree") && (
          <g>
            <rect x="540" y="130" width="12" height="48" rx="4" fill="#7d543e" />
            <circle cx="546" cy="112" r="34" fill="#4f9464" />
            <circle cx="522" cy="126" r="22" fill="#57a06a" />
            <circle cx="570" cy="126" r="22" fill="#57a06a" />
          </g>
        )}

        {earned.size === 0 && (
          <text x="320" y="120" textAnchor="middle" fontSize="15" fontWeight="700" fill="#5b6672">
            Your garden grows when your French does.
          </text>
        )}
      </svg>

      <div className="mt-4 flex flex-wrap gap-2">
        {unlocks.map((unlock) => (
          <span
            key={unlock.id}
            title={unlock.earnedBy}
            className={`rounded-full px-3 py-1 text-xs font-black ${unlock.earned ? "bg-moss/15 text-ink" : "bg-ink/5 text-ink/45"}`}
          >
            {unlock.earned ? unlock.label : `Locked: ${unlock.label}`}
          </span>
        ))}
      </div>
      {nextUnlock && (
        <p className="mt-3 text-sm text-ink/70">
          Next to grow: <span className="font-black">{nextUnlock.label}</span> - {nextUnlock.earnedBy.toLowerCase()}.
        </p>
      )}
      {away && <p className="mt-2 text-sm text-ink/70">The garden is quiet while you are away. It brightens the moment you return; nothing is lost.</p>}
    </div>
  );
}
