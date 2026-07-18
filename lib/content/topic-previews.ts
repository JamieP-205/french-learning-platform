export type TopicStatus = "ready" | "practice_preview" | "planned";

export type TopicPhrase = {
  french: string;
  english: string;
  register: "formal" | "neutral everyday" | "casual spoken";
  note: string;
  acceptedAnswers: string[];
  commonTrap?: string;
};

export type TopicSelfCheck = {
  prompt: string;
  promptFrenchSegments: string[];
  answer: string;
  acceptedAnswers?: string[];
  reason: string;
};

export type TopicPreview = {
  slug: string;
  title: string;
  href?: string;
  status: TopicStatus;
  statusLabel: string;
  level: string;
  detail: string;
  description: string;
  outcome: string;
  sourceNote: string;
  phrases: TopicPhrase[];
  grammarFocus: string[];
  selfChecks: TopicSelfCheck[];
  comingNext: string[];
};

export const topicPreviews: TopicPreview[] = [
  {
    slug: "introduce-yourself",
    title: "Introductions",
    href: "/learn/introduce-yourself",
    status: "ready",
    statusLabel: "Ready",
    level: "A1",
    detail: "Mixed lesson",
    description: "Say who you are, give your age correctly, and talk about today.",
    outcome: "You can introduce yourself with a safe everyday version and avoid the common age mistake.",
    sourceNote: "Reviewed introduction lesson with clear answer checks and follow-up practice.",
    phrases: [
      {
        french: "Je m'appelle Jamie.",
        english: "My name is Jamie.",
        register: "neutral everyday",
        note: "Safe default for normal introductions.",
        acceptedAnswers: ["Je m'appelle Jamie.", "Je m'appelle Jamie"],
      },
      {
        french: "J'ai 20 ans.",
        english: "I am 20 years old.",
        register: "neutral everyday",
        note: "French uses avoir for age.",
        acceptedAnswers: ["J'ai 20 ans.", "J'ai 20 ans"],
        commonTrap: "Je suis 20 ans.",
      },
      {
        french: "Je viens de Belfast.",
        english: "I come from Belfast.",
        register: "neutral everyday",
        note: "Use de with where you are from.",
        acceptedAnswers: ["Je viens de Belfast.", "Je viens de Belfast"],
      },
    ],
    grammarFocus: ["avoir for age", "venir de", "neutral versus casual introductions"],
    selfChecks: [
      {
        prompt: "How do you say: I am 20 years old?",
        promptFrenchSegments: [],
        answer: "J'ai 20 ans.",
        reason: "French says you have 20 years, not you are 20 years.",
      },
    ],
    comingNext: ["More personal details", "Short conversation replies", "Listening with different speakers"],
  },
  {
    slug: "cafe-food",
    title: "Cafe and food",
    href: "/learn/cafe-food",
    status: "practice_preview",
    statusLabel: "Practice preview",
    level: "A1",
    detail: "Scenario preview",
    description: "Order simply, ask for prices, and use safer polite café phrases.",
    outcome: "You can order one item politely, ask the price, and avoid sounding too blunt.",
    sourceNote: "This topic is available for extra practice. A full lesson will be added after a final language review.",
    phrases: [
      {
        french: "Bonjour, je voudrais un café, s'il vous plaît.",
        english: "Hello, I would like a coffee, please.",
        register: "neutral everyday",
        note: "Polite and safe in cafés, restaurants, and shops.",
        acceptedAnswers: [
          "Bonjour, je voudrais un café, s'il vous plaît.",
          "Je voudrais un café, s'il vous plaît.",
          "Je voudrais un cafe, s'il vous plait.",
        ],
        commonTrap: "Je veux un café.",
      },
      {
        french: "Je prends un croissant.",
        english: "I will have a croissant.",
        register: "neutral everyday",
        note: "Natural for choosing or ordering something.",
        acceptedAnswers: ["Je prends un croissant.", "Je prends un croissant"],
      },
      {
        french: "C'est combien ?",
        english: "How much is it?",
        register: "neutral everyday",
        note: "Short, useful, and common when paying.",
        acceptedAnswers: ["C'est combien ?", "C'est combien", "C est combien"],
      },
      {
        french: "L'addition, s'il vous plaît.",
        english: "The bill, please.",
        register: "neutral everyday",
        note: "Useful in restaurants. In a café, you may also pay at the counter.",
        acceptedAnswers: [
          "L'addition, s'il vous plaît.",
          "L'addition s'il vous plaît.",
          "L addition s il vous plait",
        ],
      },
    ],
    grammarFocus: ["je voudrais for polite requests", "je prends for ordering", "s'il vous plaît", "c'est combien"],
    selfChecks: [
      {
        prompt: "Safer café phrase for: I want a coffee.",
        promptFrenchSegments: [],
        answer: "Je voudrais un café, s'il vous plaît.",
        reason: "Je veux can sound blunt. Je voudrais is safer and more polite.",
      },
      {
        prompt: "How do you ask: How much is it?",
        promptFrenchSegments: [],
        answer: "C'est combien ?",
        reason: "This is a short everyday phrase you can use when paying.",
      },
    ],
    comingNext: ["Longer café roleplay", "Menu listening", "Paying and asking for the bill"],
  },
  {
    slug: "travel-basics",
    title: "Travel basics",
    href: "/learn/travel-basics",
    status: "practice_preview",
    statusLabel: "Practice preview",
    level: "A1",
    detail: "Scenario preview",
    description: "Ask where something is, buy a ticket, ask for repeat help, and handle simple travel problems.",
    outcome: "You can ask for a station, buy a ticket, and recover when you do not understand.",
    sourceNote: "This topic is available for extra practice. A full lesson will be added after a final language review.",
    phrases: [
      {
        french: "Où est la gare ?",
        english: "Where is the station?",
        register: "neutral everyday",
        note: "A basic location question.",
        acceptedAnswers: ["Où est la gare ?", "Ou est la gare ?", "Où est la gare", "Ou est la gare"],
      },
      {
        french: "Je voudrais un billet pour Paris.",
        english: "I would like a ticket to Paris.",
        register: "neutral everyday",
        note: "Swap Paris for the place you need.",
        acceptedAnswers: [
          "Je voudrais un billet pour Paris.",
          "Je voudrais un billet pour Paris",
        ],
      },
      {
        french: "À quelle heure part le train ?",
        english: "What time does the train leave?",
        register: "neutral everyday",
        note: "Useful at stations and when checking schedules.",
        acceptedAnswers: [
          "À quelle heure part le train ?",
          "A quelle heure part le train ?",
          "À quelle heure part le train",
          "A quelle heure part le train",
        ],
      },
      {
        french: "Pouvez-vous répéter, s'il vous plaît ?",
        english: "Can you repeat, please?",
        register: "formal",
        note: "A safe polite rescue phrase when you miss something.",
        acceptedAnswers: [
          "Pouvez-vous répéter, s'il vous plaît ?",
          "Pouvez-vous répéter s'il vous plaît ?",
          "Pouvez vous repeter s il vous plait",
        ],
      },
      {
        french: "Je suis perdu.",
        english: "I am lost.",
        register: "neutral everyday",
        note: "Use perdue if the speaker is feminine.",
        acceptedAnswers: ["Je suis perdu.", "Je suis perdu", "Je suis perdue.", "Je suis perdue"],
      },
    ],
    grammarFocus: ["où est", "un billet pour", "à quelle heure", "polite vous rescue phrases", "perdu versus perdue"],
    selfChecks: [
      {
        prompt: "How do you ask: Where is the station?",
        promptFrenchSegments: [],
        answer: "Où est la gare ?",
        reason: "Où est means where is. La gare means the station.",
      },
      {
        prompt: "What phrase helps when someone speaks too fast?",
        promptFrenchSegments: [],
        answer: "Pouvez-vous répéter, s'il vous plaît ?",
        reason: "It is a safe polite way to ask someone to repeat.",
      },
    ],
    comingNext: ["Ticket-buying variations", "Getting unstuck while travelling", "Faster listening"],
  },
  {
    slug: "work-basics",
    title: "Work basics",
    href: "/learn/work-basics",
    status: "practice_preview",
    statusLabel: "Practice preview",
    level: "A2-B1",
    detail: "Goal preview",
    description: "Introduce your role, ask for clarification, and keep workplace French polite and simple.",
    outcome: "You can say what you do, ask someone to repeat, and explain that you are learning French.",
    sourceNote: "This topic is available for extra practice. A full lesson will be added after a final language review.",
    phrases: [
      {
        french: "Je travaille dans le marketing.",
        english: "I work in marketing.",
        register: "neutral everyday",
        note: "Swap the field for your own area: l'informatique, la vente, la finance.",
        acceptedAnswers: ["Je travaille dans le marketing.", "Je travaille dans le marketing"],
      },
      {
        french: "Je suis développeur.",
        english: "I am a developer.",
        register: "neutral everyday",
        note: "Use développeuse for a feminine speaker.",
        acceptedAnswers: ["Je suis développeur.", "Je suis développeur", "Je suis développeuse.", "Je suis développeuse"],
      },
      {
        french: "Pouvez-vous parler plus lentement ?",
        english: "Can you speak more slowly?",
        register: "formal",
        note: "Polite vous form; safe at work or with people you do not know well.",
        acceptedAnswers: [
          "Pouvez-vous parler plus lentement ?",
          "Pouvez vous parler plus lentement ?",
          "Pouvez-vous parler plus lentement",
        ],
      },
      {
        french: "Je suis en train d'apprendre le français.",
        english: "I am learning French.",
        register: "neutral everyday",
        note: "A useful repair phrase when you need patience from the other person.",
        acceptedAnswers: [
          "Je suis en train d'apprendre le français.",
          "Je suis en train d apprendre le francais",
        ],
      },
    ],
    grammarFocus: ["travailler dans", "job titles and gender agreement", "polite vous requests", "en train de"],
    selfChecks: [
      {
        prompt: "How do you politely ask someone to speak more slowly?",
        promptFrenchSegments: [],
        answer: "Pouvez-vous parler plus lentement ?",
        reason: "Pouvez-vous is a safe polite form, especially at work.",
      },
      {
        prompt: "How do you say: I work in marketing?",
        promptFrenchSegments: [],
        answer: "Je travaille dans le marketing.",
        reason: "Je travaille dans... is a practical way to give your work area.",
      },
    ],
    comingNext: ["Meeting phrases", "Email openings", "Role-specific vocabulary"],
  },
  {
    slug: "everyday-conversation",
    title: "Everyday conversation",
    href: "/learn/everyday-conversation",
    status: "practice_preview",
    statusLabel: "Practice preview",
    level: "A2-B1",
    detail: "Conversation preview",
    description: "Keep a simple conversation alive with opinions, reasons, and repair phrases.",
    outcome: "You can say what you think, give a simple reason, and recover when you miss something.",
    sourceNote: "This topic is available for extra practice. A full lesson will be added after a final language review.",
    phrases: [
      {
        french: "Je pense que c'est une bonne idée.",
        english: "I think it is a good idea.",
        register: "neutral everyday",
        note: "A simple opinion frame that works in many everyday situations.",
        acceptedAnswers: ["Je pense que c'est une bonne idée.", "Je pense que c est une bonne idee"],
      },
      {
        french: "Parce que c'est pratique.",
        english: "Because it is practical.",
        register: "neutral everyday",
        note: "Use parce que to give a reason.",
        acceptedAnswers: ["Parce que c'est pratique.", "Parce que c est pratique"],
      },
      {
        french: "Je ne suis pas sûr.",
        english: "I am not sure.",
        register: "neutral everyday",
        note: "Use sûre for a feminine speaker.",
        acceptedAnswers: ["Je ne suis pas sûr.", "Je ne suis pas sur", "Je ne suis pas sûre.", "Je ne suis pas sure"],
      },
      {
        french: "Comment dit-on ça en français ?",
        english: "How do you say that in French?",
        register: "neutral everyday",
        note: "A powerful phrase for turning gaps into learning moments.",
        acceptedAnswers: [
          "Comment dit-on ça en français ?",
          "Comment dit on ca en francais ?",
          "Comment dit-on ça en français",
        ],
      },
    ],
    grammarFocus: ["je pense que", "parce que", "negative ne... pas", "repair questions"],
    selfChecks: [
      {
        prompt: "How do you say: I think it is a good idea?",
        promptFrenchSegments: [],
        answer: "Je pense que c'est une bonne idée.",
        reason: "Je pense que gives a simple opinion frame.",
      },
      {
        prompt: "What phrase helps you ask for a missing word?",
        promptFrenchSegments: [],
        answer: "Comment dit-on ça en français ?",
        reason: "It lets you keep the conversation going while learning the exact word.",
      },
    ],
    comingNext: ["Contrasting opinions", "Short stories", "Branching conversations"],
  },
  {
    slug: "texting-casual-french",
    title: "Texting and casual French",
    status: "planned",
    statusLabel: "Planned",
    level: "A1-A2",
    detail: "Later",
    description: "Short messages, everyday replies, and safer casual wording.",
    outcome: "This will become a real spoken/texting topic after the first practical topics are stronger.",
    sourceNote: "Not active yet.",
    phrases: [],
    grammarFocus: [],
    selfChecks: [],
    comingNext: ["Casual greetings", "Short replies", "Register warnings"],
  },
];

export function getTopicPreview(slug: string) {
  return topicPreviews.find((topic) => topic.slug === slug);
}

export function getActiveTopicPreviews() {
  return topicPreviews.filter((topic) => topic.status !== "planned");
}


