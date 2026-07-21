type LessonStage = "learn" | "answer" | "feedback";

const stages: Array<{ id: LessonStage; label: string }> = [
  { id: "learn", label: "Learn" },
  { id: "answer", label: "Answer" },
  { id: "feedback", label: "Feedback" },
];

type LessonStageProgressProps = {
  current: number;
  total: number;
  stage: LessonStage;
};

export function LessonStageProgress({ current, total, stage }: LessonStageProgressProps) {
  const completedQuestions = Math.max(0, Math.min(total, current - (stage === "feedback" ? 0 : 1)));
  const progress = total > 0 ? Math.round((completedQuestions / total) * 100) : 0;

  return (
    <div aria-label={`Lesson progress: step ${current} of ${total}`}>
      <div className="flex items-center justify-between gap-3 text-sm font-bold text-ink/75">
        <span>Step {current} of {total}</span>
        <span>{completedQuestions} complete</span>
      </div>
      <div
        aria-label={`${completedQuestions} of ${total} questions complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
      >
        <div className="h-full bg-coral transition-all" style={{ width: `${progress}%` }} />
      </div>
      <ol aria-label="Current step" className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold sm:text-sm">
        {stages.map((item, index) => {
          const active = item.id === stage;
          return (
            <li
              aria-current={active ? "step" : undefined}
              className={`rounded-xl border px-2 py-2 ${
                active ? "border-ink bg-ink text-cream" : "border-ink/10 bg-cream text-ink/65"
              }`}
              key={item.id}
            >
              {index + 1}. {item.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
