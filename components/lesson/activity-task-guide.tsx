import type { ActivityType } from "@/lib/domain/types";

const instructions: Record<ActivityType, string> = {
  multiple_choice: "Choose the one answer that best matches the French.",
  fill_blank: "Type the missing French word, then check your answer.",
  typing: "Type the full answer in French, then check it.",
  sentence_builder: "Tap the French words in the order they belong.",
  dictation_placeholder: "Play the phrase, then type exactly what you hear.",
  speak_repeat_placeholder: "Listen to the model, say the phrase aloud, then complete the self-check.",
};

export function ActivityTaskGuide({ type }: { type: ActivityType }) {
  return (
    <p className="mt-5 rounded-xl border border-ink/10 bg-cream px-4 py-3 leading-6 text-ink/80">
      <span className="font-black text-ink">What to do: </span>
      {instructions[type]}
    </p>
  );
}
