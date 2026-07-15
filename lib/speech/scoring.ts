import { normalizeFrenchAnswer } from "@/lib/learning/answer-validation";

export type PronunciationFeedback = {
  // 0-1 word-level intelligibility against the closest accepted phrase.
  score: number;
  verdict: "match" | "close" | "retry";
  missingWords: string[];
  heard: string;
};

function words(value: string): string[] {
  // Elision-safe: strip apostrophes entirely so a transcript of "sil vous
  // plait" still counts against "s'il vous plaît".
  return normalizeFrenchAnswer(value, true)
    .replace(/'/g, "")
    .split(" ")
    .filter(Boolean);
}

// Word-overlap intelligibility scoring. Deliberately gentle: recognition of
// beginner speech is noisy, and the goal is confidence with feedback, not an
// exam. The verdict thresholds match that intent.
export function scorePronunciation(transcript: string, acceptedPhrases: string[]): PronunciationFeedback {
  const heardWords = new Set(words(transcript));
  let best: PronunciationFeedback = { score: 0, verdict: "retry", missingWords: [], heard: transcript };

  for (const phrase of acceptedPhrases) {
    const targetWords = words(phrase);
    if (targetWords.length === 0) continue;
    const missingWords = targetWords.filter((word) => !heardWords.has(word));
    const score = (targetWords.length - missingWords.length) / targetWords.length;
    if (score >= best.score) {
      best = {
        score,
        verdict: score >= 0.8 ? "match" : score >= 0.4 ? "close" : "retry",
        missingWords,
        heard: transcript,
      };
    }
  }

  return best;
}
