// The garden grows from durable learning signals. Time away can soften the
// light, but it never removes anything the learner earned.

export type GardenProgress = {
  sessionsCompleted: number;
  currentStreak: number;
  phrasesLearned: number;
  mistakesFixed: number;
  habit: { tone: "new" | "fresh" | "steady" | "comeback" };
};

type GardenUnlock = {
  id: string;
  label: string;
  earnedBy: string;
  earned: boolean;
  current: number;
  target: number;
};

export function gardenUnlocks(progress: GardenProgress): GardenUnlock[] {
  return [
    { id: "sprout", label: "First sprout", earnedBy: "Complete your first session", earned: progress.sessionsCompleted >= 1, current: progress.sessionsCompleted, target: 1 },
    { id: "flowers", label: "Wildflower bed", earnedBy: "Recall your first phrase", earned: progress.phrasesLearned >= 1, current: progress.phrasesLearned, target: 1 },
    { id: "bench", label: "Garden bench", earnedBy: "Repair a mistake through review", earned: progress.mistakesFixed >= 1, current: progress.mistakesFixed, target: 1 },
    { id: "path", label: "Stepping stones", earnedBy: "Complete 3 sessions", earned: progress.sessionsCompleted >= 3, current: progress.sessionsCompleted, target: 3 },
    { id: "sun", label: "Morning light", earnedBy: "Reach a 3-day streak", earned: progress.currentStreak >= 3, current: progress.currentStreak, target: 3 },
    { id: "cafe", label: "Little café cart", earnedBy: "Complete 5 sessions", earned: progress.sessionsCompleted >= 5, current: progress.sessionsCompleted, target: 5 },
    { id: "lanterns", label: "Evening lanterns", earnedBy: "Reach a 7-day streak", earned: progress.currentStreak >= 7, current: progress.currentStreak, target: 7 },
    { id: "tree", label: "Young chestnut tree", earnedBy: "Complete 10 sessions", earned: progress.sessionsCompleted >= 10, current: progress.sessionsCompleted, target: 10 },
    { id: "canopy", label: "Chestnut canopy", earnedBy: "Complete 20 sessions", earned: progress.sessionsCompleted >= 20, current: progress.sessionsCompleted, target: 20 },
  ];
}

function GardenScene({ earned, away }: { earned: Set<string>; away: boolean }) {
  return (
    <div className={`garden-scene ${away ? "garden-away" : ""}`}>
      <svg
        aria-hidden="true"
        className="garden-growth"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 640 300"
      >
        {earned.has("sun") && (
          <g className="garden-sun">
            <circle cx="554" cy="50" fill="#f0bd4f" opacity="0.9" r="24" />
            {[0, 45, 90, 135].map((angle) => (
              <rect fill="#f0bd4f" height="14" key={angle} rx="3" transform={`rotate(${angle} 554 50)`} width="6" x="551" y="11" />
            ))}
          </g>
        )}

        {earned.has("path") && (
          <g className="garden-rise" fill="#d6c4a1" stroke="#fff8e9" strokeWidth="2">
            <ellipse cx="282" cy="249" rx="24" ry="8" />
            <ellipse cx="335" cy="228" rx="21" ry="7" />
            <ellipse cx="380" cy="210" rx="18" ry="6" />
          </g>
        )}

        {earned.has("sprout") && (
          <g className="garden-grow">
            <path d="M111 238c0-17 2-27 8-38" fill="none" stroke="#316b4c" strokeLinecap="round" strokeWidth="5" />
            <ellipse cx="108" cy="211" fill="#4f9464" rx="13" ry="7" transform="rotate(25 108 211)" />
            <ellipse cx="126" cy="199" fill="#64a773" rx="13" ry="7" transform="rotate(-24 126 199)" />
          </g>
        )}

        {earned.has("flowers") && (
          <g className="garden-grow">
            {[154, 177, 201, 224].map((x, index) => (
              <g key={x}>
                <path d={`M${x} 239c0-14 1-23 3-34`} fill="none" stroke="#3f7856" strokeWidth="3" />
                <g fill={index % 2 ? "#d75e4c" : "#d98ea0"}>
                  <circle cx={x - 4} cy="202" r="6" />
                  <circle cx={x + 4} cy="202" r="6" />
                  <circle cx={x} cy="196" r="6" />
                  <circle cx={x} cy="208" r="6" />
                </g>
                <circle cx={x} cy="202" fill="#f3c45b" r="3" />
              </g>
            ))}
          </g>
        )}

        {earned.has("bench") && (
          <g className="garden-rise" filter="url(#garden-shadow)">
            <path d="M294 213h76v10h-76zM301 194h62v10h-62z" fill="#8a5e42" rx="3" />
            <path d="M302 222h7v22h-7zM356 222h7v22h-7zM300 202h6v14h-6zM356 202h6v14h-6z" fill="#60402f" />
          </g>
        )}

        {earned.has("cafe") && (
          <g className="garden-rise" filter="url(#garden-shadow)">
            <path d="M413 205h84v42h-84z" fill="#f7eddb" />
            <path d="M408 190h94l-8 19h-78z" fill="#b84a3b" />
            <path d="M423 190h13l-4 19h-13zM450 190h13l1 19h-13zM478 190h13l4 19h-13z" fill="#fff8e9" />
            <path d="M428 219h22v28h-22z" fill="#6e4a35" />
            <circle cx="425" cy="252" fill="#253a49" r="7" />
            <circle cx="482" cy="252" fill="#253a49" r="7" />
            <path d="M462 217c10 0 15 5 15 13h-30c0-8 5-13 15-13z" fill="#d8a949" />
          </g>
        )}

        {earned.has("lanterns") && (
          <g className="garden-lanterns">
            {[72, 252, 400, 530].map((x) => (
              <g key={x}>
                <path d={`M${x} 92v46`} stroke="#203444" strokeWidth="2" />
                <rect fill="#f1bd52" height="13" rx="3" width="9" x={x - 4.5} y="132" />
                <circle cx={x} cy="138" fill="#fff2b6" opacity="0.5" r="12" />
              </g>
            ))}
          </g>
        )}

        {earned.has("tree") && (
          <g className="garden-grow" filter="url(#garden-shadow)">
            <path d="M555 239c10-36 4-67 13-99 5 32 7 64 10 99z" fill="#72503a" />
            <circle cx="567" cy="136" fill="#4d8c60" r={earned.has("canopy") ? 52 : 34} />
            <circle cx={earned.has("canopy") ? 535 : 548} cy="151" fill="#5c9b6b" r={earned.has("canopy") ? 36 : 24} />
            <circle cx={earned.has("canopy") ? 599 : 587} cy="151" fill="#467f58" r={earned.has("canopy") ? 38 : 24} />
          </g>
        )}

        <defs>
          <filter height="160%" id="garden-shadow" width="160%" x="-30%" y="-30%">
            <feDropShadow dx="0" dy="4" floodColor="#10233f" floodOpacity="0.18" stdDeviation="3" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

export function LearningGarden({ progress }: { progress: GardenProgress }) {
  const unlocks = gardenUnlocks(progress);
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
