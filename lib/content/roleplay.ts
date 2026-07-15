export type RegisterComparison = {
  id: string;
  context: string;
  formal: string;
  neutral: string;
  casual: string;
  avoid: string;
  explanation: string;
};

export type RoleplayChoice = {
  id: string;
  text: string;
  language: "fr" | "en";
  register: "formal" | "neutral" | "casual" | "too_blunt";
  outcome: "strong" | "safe" | "repair";
  feedback: string;
};

export type RoleplayTurn = {
  id: string;
  npcLine: string;
  npcLineLanguage: "fr" | "en";
  task: string;
  choices: RoleplayChoice[];
};

export type RoleplayScenario = {
  id: string;
  title: string;
  setting: string;
  goal: string;
  level: "A1" | "A2";
  turns: RoleplayTurn[];
  sourceNote: string;
};

export const registerComparisons: RegisterComparison[] = [
  {
    id: "coffee-request",
    context: "Ordering one coffee",
    formal: "Je voudrais un café, s'il vous plaît.",
    neutral: "Je prends un café, s'il vous plaît.",
    casual: "Un café, s'il te plaît.",
    avoid: "Je veux un café.",
    explanation: "Je voudrais is the safest beginner default. Je veux is understandable, but it can sound too direct as an opening order.",
  },
  {
    id: "repeat-help",
    context: "Asking a stranger to repeat",
    formal: "Pouvez-vous répéter, s'il vous plaît ?",
    neutral: "Vous pouvez répéter, s'il vous plaît ?",
    casual: "Tu peux répéter ?",
    avoid: "Répète.",
    explanation: "Use vous with strangers, staff, and public situations. Imperatives like Repete are too abrupt here.",
  },
  {
    id: "not-understood",
    context: "Recovering when you miss something",
    formal: "Excusez-moi, je n'ai pas compris.",
    neutral: "Désolé, je n'ai pas compris.",
    casual: "J'ai pas compris.",
    avoid: "Quoi ?",
    explanation: "The neutral version is useful almost everywhere. Quoi alone can sound sharp if you are asking for help.",
  },
];

export const roleplayScenarios: RoleplayScenario[] = [
  {
    id: "cafe-counter",
    title: "Cafe counter",
    setting: "A small cafe. The server is polite but busy.",
    goal: "Order a coffee, ask the price, and close the exchange politely.",
    level: "A1",
    sourceNote: "Uses the reviewed cafe preview phrases and the scored cafe mission phrase set.",
    turns: [
      {
        id: "greeting",
        npcLine: "Bonjour ! Vous désirez ?",
        npcLineLanguage: "fr",
        task: "Open with a safe polite order.",
        choices: [
          {
            id: "voudrais",
            text: "Bonjour, je voudrais un café, s'il vous plaît.",
            language: "fr",
            register: "formal",
            outcome: "strong",
            feedback: "Best default. Polite, complete, and safe with a server.",
          },
          {
            id: "prends",
            text: "Je prends un café.",
            language: "fr",
            register: "neutral",
            outcome: "safe",
            feedback: "Natural, but adding s'il vous plait makes it warmer in a service situation.",
          },
          {
            id: "veux",
            text: "Je veux un café.",
            language: "fr",
            register: "too_blunt",
            outcome: "repair",
            feedback: "Understandable, but too direct as a beginner default. Prefer je voudrais.",
          },
        ],
      },
      {
        id: "price",
        npcLine: "Bien sûr. Autre chose ?",
        npcLineLanguage: "fr",
        task: "Ask how much it costs.",
        choices: [
          {
            id: "combien",
            text: "C'est combien ?",
            language: "fr",
            register: "neutral",
            outcome: "strong",
            feedback: "Good. Short and normal when paying.",
          },
          {
            id: "prix",
            text: "Quel est le prix ?",
            language: "fr",
            register: "formal",
            outcome: "safe",
            feedback: "Correct, but less everyday at a cafe counter than C'est combien ?",
          },
          {
            id: "cost",
            text: "Combien café ?",
            language: "fr",
            register: "too_blunt",
            outcome: "repair",
            feedback: "Missing structure. Use C'est combien ? as the reliable chunk.",
          },
        ],
      },
      {
        id: "close",
        npcLine: "Deux euros cinquante.",
        npcLineLanguage: "fr",
        task: "Close politely.",
        choices: [
          {
            id: "merci",
            text: "Merci, bonne journée.",
            language: "fr",
            register: "neutral",
            outcome: "strong",
            feedback: "Good close. Short, polite, and natural.",
          },
          {
            id: "ok",
            text: "OK.",
            language: "en",
            register: "casual",
            outcome: "safe",
            feedback: "Not wrong, but it misses an easy politeness win.",
          },
          {
            id: "silent",
            text: "No reply.",
            language: "en",
            register: "too_blunt",
            outcome: "repair",
            feedback: "In a service exchange, a quick merci is the safer habit.",
          },
        ],
      },
    ],
  },
  {
    id: "station-help",
    title: "Station help",
    setting: "You are near a station and need help from a stranger.",
    goal: "Ask where the station is and recover if the reply is too fast.",
    level: "A1",
    sourceNote: "Uses the reviewed travel preview phrases and polite vous rescue language.",
    turns: [
      {
        id: "ask-location",
        npcLine: "Oui ?",
        npcLineLanguage: "fr",
        task: "Ask where the station is.",
        choices: [
          {
            id: "gare-polty",
            text: "Excusez-moi, où est la gare, s'il vous plaît ?",
            language: "fr",
            register: "formal",
            outcome: "strong",
            feedback: "Strong travel phrase. Excusez-moi and s'il vous plait make the request safe.",
          },
          {
            id: "gare-short",
            text: "Où est la gare ?",
            language: "fr",
            register: "neutral",
            outcome: "safe",
            feedback: "Correct and understandable. Add excusez-moi for a stranger.",
          },
          {
            id: "gare-one-word",
            text: "La gare ?",
            language: "fr",
            register: "too_blunt",
            outcome: "repair",
            feedback: "It might work with pointing, but it is not a reliable polite sentence.",
          },
        ],
      },
      {
        id: "recover",
        npcLine: "Prenez la deuxième rue à gauche, puis continuez tout droit.",
        npcLineLanguage: "fr",
        task: "You missed the answer. Ask them to repeat.",
        choices: [
          {
            id: "repeter-vous",
            text: "Pouvez-vous répéter, s'il vous plaît ?",
            language: "fr",
            register: "formal",
            outcome: "strong",
            feedback: "Best rescue phrase. Polite, clear, and reusable.",
          },
          {
            id: "lentement",
            text: "Pouvez-vous parler plus lentement ?",
            language: "fr",
            register: "formal",
            outcome: "strong",
            feedback: "Also excellent. It asks for a slower answer rather than only another fast one.",
          },
          {
            id: "quoi",
            text: "Quoi ?",
            language: "fr",
            register: "too_blunt",
            outcome: "repair",
            feedback: "Too abrupt for asking a stranger for help. Use pouvez-vous...",
          },
        ],
      },
    ],
  },
];

export function getRoleplayScenario(id: string) {
  return roleplayScenarios.find((scenario) => scenario.id === id);
}
