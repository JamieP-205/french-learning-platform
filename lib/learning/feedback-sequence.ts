import type { ActivityDefinition, MistakeType, ValidationResultV1 } from "@/lib/domain/types";

const promptsByRule: Record<string, string> = {
  "rule-age-avoir-v1": "Almost. French uses ‘to have’ for age. Which form belongs with je?",
  "rule-cafe-politeness-v1": "Almost. which request form sounds polite rather than direct here?",
  "rule-travel-politeness-v1": "Almost. which polite form asks a stranger to repeat something?",
  "phrase-je-viens-de-v1": "Almost. which word links venir to the place someone comes from?",
  "phrase-cafe-je-prends-v1": "Almost. where does the verb belong in this French sentence?",
  "phrase-cafe-combien-v1": "Almost. listen for the short question used to ask the price.",
  "phrase-cafe-addition-v1": "Almost. which polite phrase asks for the bill?",
  "phrase-travel-gare-v1": "Almost. which question pattern asks where a place is?",
  "phrase-travel-train-time-v1": "Almost. where do the time words belong in this question?",
  "phrase-travel-lost-v1": "Almost. which form agrees with the speaker in this sentence?",
};

const promptsByMistake: Partial<Record<MistakeType, string>> = {
  grammar: "Almost. which grammatical pattern from the teaching step fits here?",
  word_order: "Almost. which French word order did the teaching examples use?",
  register: "Almost. which option fits the relationship and situation better?",
  listening: "Almost. listen once more and rebuild the sounds in order.",
  "gender-agreement": "Almost. which ending must agree with the noun’s gender?",
  "article-elision": "Almost. what happens to the article before a vowel sound?",
  partitive: "Almost. which partitive article fits this quantity?",
  "tu-vous": "Almost. does this situation call for tu or vous?",
  "pc-vs-imparfait": "Almost. is this a completed event or background description?",
  "subjunctive-trigger": "Almost. which expression triggers the subjunctive here?",
  liaison: "Almost. which neighbouring sounds link together here?",
  "silent-final": "Almost. should the final consonant be heard in this context?",
  "faux-ami": "Almost. does this word mean what its English lookalike suggests?",
};

export function selfCorrectionPrompt(
  activity: ActivityDefinition,
  result: Pick<ValidationResultV1, "mistakeType" | "ruleIds">,
) {
  for (const ruleId of result.ruleIds) {
    const prompt = promptsByRule[ruleId];
    if (prompt) return prompt;
  }
  if (result.mistakeType) {
    const prompt = promptsByMistake[result.mistakeType];
    if (prompt) return prompt;
  }
  return activity.type === "sentence_builder"
    ? "Almost. compare the order with the taught example. Which chunk would you move?"
    : "Almost. which part of the taught form would you change before trying again?";
}
