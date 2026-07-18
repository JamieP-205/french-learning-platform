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

function alignedTargetWordIndexes(target: string[], heard: string[]) {
  const lengths = Array.from({ length: target.length + 1 }, () => Array<number>(heard.length + 1).fill(0));
  for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
    for (let heardIndex = 1; heardIndex <= heard.length; heardIndex += 1) {
      lengths[targetIndex][heardIndex] = target[targetIndex - 1] === heard[heardIndex - 1]
        ? lengths[targetIndex - 1][heardIndex - 1] + 1
        : Math.max(lengths[targetIndex - 1][heardIndex], lengths[targetIndex][heardIndex - 1]);
    }
  }

  const matched = new Set<number>();
  let targetIndex = target.length;
  let heardIndex = heard.length;
  while (targetIndex > 0 && heardIndex > 0) {
    if (target[targetIndex - 1] === heard[heardIndex - 1]) {
      matched.add(targetIndex - 1);
      targetIndex -= 1;
      heardIndex -= 1;
    } else if (lengths[targetIndex - 1][heardIndex] >= lengths[targetIndex][heardIndex - 1]) {
      targetIndex -= 1;
    } else {
      heardIndex -= 1;
    }
  }
  return matched;
}

// Sequence-aware word scoring keeps the feedback gentle while still requiring
// the phrase to be recognisable in order. A shuffled bag of the right words is
// not treated as a successful spoken sentence.
export function scorePronunciation(transcript: string, acceptedPhrases: string[]): PronunciationFeedback {
  const heardWords = words(transcript);
  let best: PronunciationFeedback = { score: 0, verdict: "retry", missingWords: [], heard: transcript };

  for (const phrase of acceptedPhrases) {
    const targetWords = words(phrase);
    if (targetWords.length === 0) continue;
    const matchedIndexes = alignedTargetWordIndexes(targetWords, heardWords);
    const missingWords = targetWords.filter((_, index) => !matchedIndexes.has(index));
    const score = matchedIndexes.size / targetWords.length;
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
