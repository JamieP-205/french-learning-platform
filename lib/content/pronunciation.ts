import { FRENCH_AUDIO_BY_TEXT } from "@/lib/content/french-audio";

// Curated pronunciation practice targeting the sounds English speakers most
// often struggle with. Every entry is standard, verified beginner French;
// notes describe mouth position in plain language rather than IPA.

export type MinimalPair = {
  id: string;
  focus: string;
  note: string;
  left: { french: string; english: string };
  right: { french: string; english: string };
};

export const MINIMAL_PAIRS: MinimalPair[] = [
  {
    id: "pair-u-ou-tu-tout",
    focus: "u vs ou",
    note: "For French « u », say “ee” and round your lips like “oo” without moving your tongue. « ou » is the plain “oo”.",
    left: { french: "tu", english: "you" },
    right: { french: "tout", english: "everything" },
  },
  {
    id: "pair-u-ou-vu-vous",
    focus: "u vs ou",
    note: "Same contrast in real words you will use daily.",
    left: { french: "vu", english: "seen" },
    right: { french: "vous", english: "you (formal/plural)" },
  },
  {
    id: "pair-nasal-an-on",
    focus: "nasal an vs on",
    note: "Both are nasal, but « on » is rounder — lips push forward. Air goes through the nose, and the n is not pronounced as a consonant.",
    left: { french: "blanc", english: "white" },
    right: { french: "blond", english: "blond" },
  },
  {
    id: "pair-nasal-in-an",
    focus: "nasal in vs an",
    note: "« in » is brighter and closer to the front of the mouth than « an ».",
    left: { french: "vin", english: "wine" },
    right: { french: "vent", english: "wind" },
  },
  {
    id: "pair-e-eu",
    focus: "é vs eu",
    note: "« eu » is like the vowel in English “her” without the r. Keep it short and relaxed.",
    left: { french: "des", english: "some" },
    right: { french: "deux", english: "two" },
  },
];

export type ShadowingPhrase = {
  id: string;
  french: string;
  english: string;
  focus: string;
  audioSource: string;
};

export const SHADOWING_PHRASES: ShadowingPhrase[] = [
  {
    id: "shadow-bonjour",
    french: "Bonjour, je m'appelle Jamie.",
    english: "Hello, my name is Jamie.",
    focus: "rhythm and linking",
    audioSource: FRENCH_AUDIO_BY_TEXT["Bonjour, je m'appelle Jamie."],
  },
  {
    id: "shadow-cafe",
    french: "Je voudrais un café, s'il vous plaît.",
    english: "I would like a coffee, please.",
    focus: "polite request melody",
    audioSource: FRENCH_AUDIO_BY_TEXT["Je voudrais un café, s'il vous plaît."],
  },
  {
    id: "shadow-age",
    french: "J'ai vingt ans.",
    english: "I am twenty years old.",
    focus: "nasal an",
    audioSource: FRENCH_AUDIO_BY_TEXT["J'ai vingt ans."],
  },
  {
    id: "shadow-origin",
    french: "Je viens de Belfast.",
    english: "I come from Belfast.",
    focus: "steady even syllables",
    audioSource: FRENCH_AUDIO_BY_TEXT["Je viens de Belfast."],
  },
  {
    id: "shadow-question",
    french: "Où est la gare, s'il vous plaît ?",
    english: "Where is the station, please?",
    focus: "rising question intonation",
    audioSource: FRENCH_AUDIO_BY_TEXT["Où est la gare, s'il vous plaît ?"],
  },
];
