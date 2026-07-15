import { getTopicPreview } from "@/lib/content/topic-previews";

export type SafeTutorPrompt = {
  id: string;
  question: string;
  headline: string;
  explanation: string;
  example: string;
  sourceLabel: string;
  href: string;
};

const intro = getTopicPreview("introduce-yourself");
const cafe = getTopicPreview("cafe-food");
const travel = getTopicPreview("travel-basics");

export const safeTutorPrompts: SafeTutorPrompt[] = [
  {
    id: "age-avoir",
    question: "Why is \u201cJe suis 20 ans\u201d wrong?",
    headline: "French uses avoir for age.",
    explanation:
      "For age, standard French says you have years rather than you are years. Use the verified intro pattern instead of translating word-for-word from English.",
    example: "J\u2019ai 20 ans.",
    sourceLabel: intro?.title ?? "Introductions",
    href: "/demo",
  },
  {
    id: "neutral-casual-intro",
    question: "Should I say \u201cJe m\u2019appelle\u201d or \u201cMoi, c\u2019est\u201d?",
    headline: "Use the neutral version first.",
    explanation:
      "\u201cJe m\u2019appelle ...\u201d is the safe everyday default. \u201cMoi, c\u2019est ...\u201d is more relaxed and spoken, useful with peers but less suited to formal writing.",
    example: "Je m\u2019appelle Jamie.",
    sourceLabel: intro?.title ?? "Introductions",
    href: "/learn/introduce-yourself",
  },
  {
    id: "polite-cafe",
    question: "How do I order without sounding blunt?",
    headline: "Use je voudrais for a safer polite request.",
    explanation:
      "In the caf\u00e9 preview, \u201cJe voudrais ..., s\u2019il vous pla\u00eet\u201d is the safer polite pattern. \u201cJe veux ...\u201d can sound too direct as a default.",
    example: "Bonjour, je voudrais un caf\u00e9, s\u2019il vous pla\u00eet.",
    sourceLabel: cafe?.title ?? "Cafe and food",
    href: "/learn/cafe-food",
  },
  {
    id: "repeat-please",
    question: "What should I say when I don\u2019t understand?",
    headline: "Use a polite rescue phrase.",
    explanation:
      "The travel preview gives a safe formal phrase for asking someone to repeat. It works well when you miss something or someone speaks quickly.",
    example: "Pouvez-vous r\u00e9p\u00e9ter, s\u2019il vous pla\u00eet ?",
    sourceLabel: travel?.title ?? "Travel basics",
    href: "/learn/travel-basics",
  },
];
