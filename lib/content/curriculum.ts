import type {
  ActivityCurriculumRequirement,
  CefrLevel,
  ConceptDefinition,
  InlineGloss,
  MissionCurriculum,
  ScoredSegment,
  TeachingStep,
  VocabularyEntry,
} from "@/lib/domain/types";

const vocabulary = (
  form: string,
  lemma: string,
  pos: string,
  cefrLevel: CefrLevel,
  meaning: string,
): VocabularyEntry => ({ form, lemma, pos, cefrLevel, meaning });

const gloss = (form: string, meaning: string): InlineGloss => ({ form, meaning });

const scored = (
  source: ScoredSegment["source"],
  text: string,
  inlineGlosses: InlineGloss[] = [],
): ScoredSegment => ({ source, text, inlineGlosses });

const INTRODUCTION_CONCEPTS: ConceptDefinition[] = [
  {
    id: "concept-introduction-name",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Je m'appelle + name",
      meaning: "My name is Jamie.",
      metalinguisticRule:
        "The reflexive verb s'appeler is used for names. With je, the pronoun and verb elide: me appelle becomes m'appelle.",
      positiveExamples: ["Je m'appelle Jamie.", "Je m'appelle Samira."],
      contrastExamples: ["Je suis Jamie. (understandable, but not the taught neutral introduction pattern.)"],
      function: "Use it to introduce yourself in an everyday neutral conversation.",
      registerNote: "Neutral and safe with strangers, colleagues, and friends.",
      inputSegment: {
        text: "Je m'appelle Jamie.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("m'", "myself"),
          gloss("appelle", "call"),
          gloss("Jamie", "the speaker's name"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("m'", "me", "PRO", "A1", "myself"),
      vocabulary("appelle", "appeler", "VER", "A1", "call"),
    ],
  },
  {
    id: "concept-age-avoir",
    prerequisiteConceptIds: ["concept-introduction-name"],
    teachingStep: {
      form: "J'ai + number + ans",
      meaning: "I am 20 years old.",
      metalinguisticRule:
        "French expresses age with avoir (to have), not être (to be): j'ai, never je suis, before the age.",
      positiveExamples: ["J'ai 20 ans.", "J'ai 30 ans."],
      contrastExamples: ["Je suis 20 ans. ✗", "J'ai 20 ans. ✓"],
      function: "Use this pattern to state your age.",
      inputSegment: {
        text: "J'ai 20 ans.",
        inlineGlosses: [gloss("J'", "I"), gloss("ai", "have"), gloss("20", "twenty"), gloss("ans", "years")],
      },
    },
    vocabulary: [
      vocabulary("J'", "je", "PRO", "A1", "I"),
      vocabulary("ai", "avoir", "VER", "A1", "have"),
      vocabulary("ans", "an", "NOM", "A1", "years"),
      vocabulary("suis", "être", "VER", "A1", "am"),
    ],
  },
  {
    id: "concept-introduction-origin",
    prerequisiteConceptIds: ["concept-introduction-name"],
    teachingStep: {
      form: "Je viens de + place",
      meaning: "I come from Belfast.",
      metalinguisticRule: "Venir de identifies where someone comes from. Je takes the present-tense form viens.",
      positiveExamples: ["Je viens de Belfast.", "Je viens de Lyon."],
      contrastExamples: ["Je suis de Belfast. (possible for origin, but not the venir de pattern practised here.)"],
      function: "Use it to say where you come from.",
      inputSegment: {
        text: "Je viens de Belfast.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("viens", "come"),
          gloss("de", "from"),
          gloss("Belfast", "a place name"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("viens", "venir", "VER", "A1", "come"),
      vocabulary("de", "de", "PRP", "A1", "from"),
    ],
  },
  {
    id: "concept-introduction-daily-action",
    prerequisiteConceptIds: ["concept-introduction-name"],
    teachingStep: {
      form: "Aujourd'hui, j'étudie le français.",
      meaning: "Today, I am studying French.",
      metalinguisticRule:
        "Aujourd'hui places the action today. Before a vowel, je elides to j': j'étudie.",
      positiveExamples: ["Aujourd'hui, j'étudie le français.", "Aujourd'hui, j'étudie à Belfast."],
      contrastExamples: ["Aujourd'hui, je étudie… ✗", "Aujourd'hui, j'étudie… ✓"],
      function: "Use it to say what you are doing today.",
      inputSegment: {
        text: "Aujourd'hui, j'étudie le français.",
        inlineGlosses: [
          gloss("Aujourd'hui", "today"),
          gloss("j'", "I"),
          gloss("étudie", "study"),
          gloss("le", "the"),
          gloss("français", "French"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Aujourd'hui", "aujourd'hui", "ADV", "A1", "today"),
      vocabulary("j'", "je", "PRO", "A1", "I"),
      vocabulary("étudie", "étudier", "VER", "A1", "study"),
      vocabulary("le", "le", "DET:ART", "A1", "the"),
      vocabulary("français", "français", "NOM", "A2", "French"),
    ],
  },
  {
    id: "concept-introduction-register",
    prerequisiteConceptIds: ["concept-introduction-name"],
    teachingStep: {
      form: "Moi, c'est + name",
      meaning: "Me, I'm Jamie.",
      metalinguisticRule:
        "Moi is a stressed pronoun. C'est introduces the name as a relaxed spoken alternative to je m'appelle.",
      positiveExamples: ["Moi, c'est Jamie.", "Moi, c'est Samira."],
      contrastExamples: ["Je m'appelle Jamie. (neutral)", "Moi, c'est Jamie. (casual)"],
      function: "Use it for a relaxed spoken introduction.",
      registerNote: "Casual. Prefer je m'appelle as the neutral default with strangers or in formal settings.",
      inputSegment: {
        text: "Moi, c'est Jamie.",
        inlineGlosses: [
          gloss("Moi", "me"),
          gloss("c'", "it/this"),
          gloss("est", "is"),
          gloss("Jamie", "the speaker's name"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Moi", "moi", "PRO", "A1", "me"),
      vocabulary("c'", "ce", "PRO", "A1", "it/this"),
      vocabulary("est", "être", "VER", "A1", "is"),
    ],
  },
];

const INTRODUCTION_ACTIVITIES: ActivityCurriculumRequirement[] = [
  {
    activityId: "act-name-meaning-v1",
    requiredConceptIds: ["concept-introduction-name"],
    scoredSegments: [scored("prompt", "Je m'appelle Jamie")],
  },
  {
    activityId: "act-age-fill-v1",
    requiredConceptIds: ["concept-age-avoir"],
    scoredSegments: [scored("prompt", "J'___ 20 ans."), scored("accepted-answer", "ai")],
  },
  {
    activityId: "act-age-typing-v1",
    requiredConceptIds: ["concept-age-avoir"],
    scoredSegments: [scored("accepted-answer", "J'ai 20 ans")],
  },
  {
    activityId: "act-origin-builder-v1",
    requiredConceptIds: ["concept-introduction-origin"],
    scoredSegments: [
      scored("token", "Je"),
      scored("token", "viens"),
      scored("token", "de"),
      scored("token", "Belfast"),
      scored("accepted-answer", "Je viens de Belfast"),
    ],
  },
  {
    activityId: "act-dictation-v1",
    requiredConceptIds: ["concept-introduction-name"],
    scoredSegments: [
      scored("target", "Je m'appelle Jamie."),
      scored("accepted-answer", "Je m'appelle Jamie"),
    ],
  },
  {
    activityId: "act-speak-repeat-v1",
    requiredConceptIds: ["concept-introduction-daily-action"],
    scoredSegments: [
      scored("prompt", "Aujourd'hui, j'étudie le français."),
      scored("target", "Aujourd'hui, j'étudie le français."),
    ],
  },
  {
    activityId: "act-register-v1",
    requiredConceptIds: ["concept-introduction-register"],
    scoredSegments: [
      scored("choice", "Je m'appelle Jamie."),
      scored("choice", "Moi, c'est Jamie."),
    ],
  },
];

const CAFE_CONCEPTS: ConceptDefinition[] = [
  {
    id: "concept-cafe-polite-order",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Je voudrais + item, s'il vous plaît.",
      metalinguisticRule:
        "Je voudrais is a conventional polite request. Je veux expresses a direct want and can sound blunt as a default order.",
      positiveExamples: ["Je voudrais un café, s'il vous plaît.", "Bonjour, je voudrais un café."],
      contrastExamples: ["Je veux un café. (direct)", "Je voudrais un café. (safer polite default)"],
      function: "Use it to order an item politely.",
      registerNote: "Neutral and polite for cafés, restaurants, and shops.",
      inputSegment: {
        text: "Je voudrais un café, s'il vous plaît.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("voudrais", "would like"),
          gloss("un", "a"),
          gloss("café", "coffee"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("voudrais", "vouloir", "VER", "A1", "would like"),
      vocabulary("veux", "vouloir", "VER", "A1", "want"),
      vocabulary("un", "un", "DET:ART", "A1", "a"),
      vocabulary("café", "café", "NOM", "A1", "coffee"),
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("vous", "vous", "PRO", "A1", "you"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
      vocabulary("Bonjour", "bonjour", "NOM", "A1", "hello"),
    ],
  },
  {
    id: "concept-cafe-choose-item",
    prerequisiteConceptIds: ["concept-cafe-polite-order"],
    teachingStep: {
      form: "Je prends + item",
      metalinguisticRule: "Prendre means to take; in an ordering context, je prends naturally means I will have.",
      positiveExamples: ["Je prends un croissant.", "Je prends un café."],
      contrastExamples: ["Je suis un croissant. ✗", "Je prends un croissant. ✓"],
      function: "Use it to choose or order an item.",
      registerNote: "Neutral everyday spoken French.",
      inputSegment: {
        text: "Je prends un croissant.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("prends", "will have/take"),
          gloss("un", "a"),
          gloss("croissant", "croissant"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("prends", "prendre", "VER", "A1", "will have/take"),
      vocabulary("un", "un", "DET:ART", "A1", "a"),
      vocabulary("croissant", "croissant", "NOM", "A2", "croissant"),
    ],
  },
  {
    id: "concept-cafe-price",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "C'est combien ?",
      metalinguisticRule: "C'est combines ce and est. Combien asks about an amount or price.",
      positiveExamples: ["C'est combien ?", "Un café, c'est combien ?"],
      contrastExamples: ["Où est le café ? (asks where)", "C'est combien ? (asks the price)"],
      function: "Use it to ask how much something costs.",
      inputSegment: {
        text: "C'est combien ?",
        inlineGlosses: [gloss("C'", "it/this"), gloss("est", "is"), gloss("combien", "how much")],
      },
    },
    vocabulary: [
      vocabulary("C'", "ce", "PRO", "A1", "it/this"),
      vocabulary("est", "être", "VER", "A1", "is"),
      vocabulary("combien", "combien", "ADV", "A1", "how much"),
    ],
  },
  {
    id: "concept-cafe-bill",
    prerequisiteConceptIds: ["concept-cafe-polite-order"],
    teachingStep: {
      form: "L'addition, s'il vous plaît.",
      metalinguisticRule: "The feminine article la elides before a vowel: la addition becomes l'addition.",
      positiveExamples: ["L'addition, s'il vous plaît.", "Un café, s'il vous plaît."],
      contrastExamples: ["La addition… ✗", "L'addition… ✓"],
      function: "Use it to ask for the bill in a restaurant.",
      registerNote: "Neutral and polite.",
      inputSegment: {
        text: "L'addition, s'il vous plaît.",
        inlineGlosses: [
          gloss("L'", "the"),
          gloss("addition", "bill"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      // FLELex indexes the definite article under the generic lemma "le";
      // the teaching rule above carries the feminine form required here.
      vocabulary("L'", "le", "DET:ART", "A1", "the"),
      vocabulary("addition", "addition", "NOM", "A2", "bill"),
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("vous", "vous", "PRO", "A1", "you"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
    ],
  },
];

const CAFE_ACTIVITIES: ActivityCurriculumRequirement[] = [
  {
    activityId: "act-cafe-meaning-v1",
    requiredConceptIds: ["concept-cafe-polite-order"],
    scoredSegments: [scored("prompt", "Je voudrais un café, s'il vous plaît")],
  },
  {
    activityId: "act-cafe-politeness-v1",
    requiredConceptIds: ["concept-cafe-polite-order"],
    scoredSegments: [
      scored("choice", "Je veux un café."),
      scored("choice", "Je voudrais un café, s'il vous plaît."),
    ],
  },
  {
    activityId: "act-cafe-fill-order-v1",
    requiredConceptIds: ["concept-cafe-polite-order"],
    scoredSegments: [
      scored("prompt", "Bonjour, je voudrais un ___, s'il vous plaît."),
      scored("target", "Bonjour, je voudrais un café, s'il vous plaît."),
      scored("accepted-answer", "café"),
    ],
  },
  {
    activityId: "act-cafe-type-order-v1",
    requiredConceptIds: ["concept-cafe-polite-order"],
    scoredSegments: [
      scored("target", "Je voudrais un café, s'il vous plaît."),
      scored("accepted-answer", "Je voudrais un café, s'il vous plaît."),
      scored("accepted-answer", "Je voudrais un café s'il vous plaît."),
    ],
  },
  {
    activityId: "act-cafe-sentence-builder-v1",
    requiredConceptIds: ["concept-cafe-choose-item"],
    scoredSegments: [
      scored("token", "un"),
      scored("token", "croissant"),
      scored("token", "Je"),
      scored("token", "prends"),
      scored("accepted-answer", "Je prends un croissant."),
    ],
  },
  {
    activityId: "act-cafe-dictation-price-v1",
    requiredConceptIds: ["concept-cafe-price"],
    scoredSegments: [scored("target", "C'est combien ?"), scored("accepted-answer", "C'est combien ?")],
  },
  {
    activityId: "act-cafe-speak-bill-v1",
    requiredConceptIds: ["concept-cafe-bill"],
    scoredSegments: [
      scored("prompt", "L'addition, s'il vous plaît."),
      scored("target", "L'addition, s'il vous plaît."),
    ],
  },
];

const TRAVEL_CONCEPTS: ConceptDefinition[] = [
  {
    id: "concept-travel-location",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Où est + place ?",
      metalinguisticRule: "Où asks where. Est is the il/elle form of être, followed here by a place noun.",
      positiveExamples: ["Où est la gare ?", "Où est le café ?"],
      contrastExamples: ["Quand part le train ? (asks when)", "Où est la gare ? (asks where)"],
      function: "Use it to ask where a place is.",
      inputSegment: {
        text: "Où est la gare ?",
        inlineGlosses: [gloss("Où", "where"), gloss("est", "is"), gloss("la", "the"), gloss("gare", "station")],
      },
    },
    vocabulary: [
      vocabulary("Où", "où", "ADV", "A1", "where"),
      vocabulary("est", "être", "VER", "A1", "is"),
      vocabulary("la", "le", "DET:ART", "A1", "the"),
      vocabulary("gare", "gare", "NOM", "A1", "station"),
    ],
  },
  {
    id: "concept-travel-ticket",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Je voudrais un billet pour + destination.",
      metalinguisticRule: "Je voudrais makes the request polite. Pour introduces the destination on the ticket.",
      positiveExamples: ["Je voudrais un billet pour Paris.", "Je voudrais un billet pour Lyon."],
      contrastExamples: ["Je veux un billet. (direct)", "Je voudrais un billet. (safer polite default)"],
      function: "Use it to buy a ticket for a destination.",
      registerNote: "Neutral and polite for ticket counters.",
      inputSegment: {
        text: "Je voudrais un billet pour Paris.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("voudrais", "would like"),
          gloss("un", "a"),
          gloss("billet", "ticket"),
          gloss("pour", "for/to"),
          gloss("Paris", "a destination"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("voudrais", "vouloir", "VER", "A1", "would like"),
      vocabulary("un", "un", "DET:ART", "A1", "a"),
      vocabulary("billet", "billet", "NOM", "A1", "ticket"),
      vocabulary("pour", "pour", "PRP", "A1", "for/to"),
    ],
  },
  {
    id: "concept-travel-departure-time",
    prerequisiteConceptIds: ["concept-travel-location"],
    teachingStep: {
      form: "À quelle heure part + transport ?",
      metalinguisticRule: "À quelle heure asks at what time. Part is the present-tense il/elle form of partir.",
      positiveExamples: ["À quelle heure part le train ?", "À quelle heure part le bus ?"],
      contrastExamples: ["Où est le train ? (asks where)", "À quelle heure part le train ? (asks when it leaves)"],
      function: "Use it to ask when transport leaves.",
      inputSegment: {
        text: "À quelle heure part le train ?",
        inlineGlosses: [
          gloss("À", "at"),
          gloss("quelle", "what"),
          gloss("heure", "time/hour"),
          gloss("part", "leaves"),
          gloss("le", "the"),
          gloss("train", "train"),
        ],
      },
    },
    vocabulary: [
      vocabulary("À", "à", "PRP", "A1", "at"),
      vocabulary("quelle", "quel", "PRO", "A1", "what"),
      vocabulary("heure", "heure", "NOM", "A1", "time/hour"),
      vocabulary("part", "partir", "VER", "A1", "leaves"),
      vocabulary("le", "le", "DET:ART", "A1", "the"),
      vocabulary("train", "train", "NOM", "A1", "train"),
    ],
  },
  {
    id: "concept-travel-repeat-help",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Pouvez-vous répéter, s'il vous plaît ?",
      metalinguisticRule:
        "Pouvez-vous uses inversion with vous to make a polite question. Répéter is the infinitive after pouvez.",
      positiveExamples: ["Pouvez-vous répéter, s'il vous plaît ?", "Pouvez-vous parler lentement ?"],
      contrastExamples: ["Répète ! (informal command)", "Pouvez-vous répéter ? (polite request)"],
      function: "Use it to ask someone to repeat what they said.",
      registerNote: "Formal/polite vous; safe with strangers.",
      inputSegment: {
        text: "Pouvez-vous répéter, s'il vous plaît ?",
        inlineGlosses: [
          gloss("Pouvez", "can"),
          gloss("vous", "you"),
          gloss("répéter", "repeat"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Pouvez", "pouvoir", "VER", "A1", "can"),
      vocabulary("vous", "vous", "PRO", "A1", "you"),
      vocabulary("répéter", "répéter", "VER", "A1", "repeat"),
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
    ],
  },
  {
    id: "concept-travel-lost",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Je suis perdu / perdue.",
      metalinguisticRule: "Perdu agrees with the speaker: perdu for masculine, perdue for feminine.",
      positiveExamples: ["Je suis perdu.", "Je suis perdue."],
      contrastExamples: ["Je suis perdu. (masculine speaker)", "Je suis perdue. (feminine speaker)"],
      function: "Use it to say that you are lost.",
      registerNote: "Neutral. Either agreement is accepted according to the speaker.",
      inputSegment: {
        text: "Je suis perdu.",
        inlineGlosses: [gloss("Je", "I"), gloss("suis", "am"), gloss("perdu", "lost")],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("suis", "être", "VER", "A1", "am"),
      vocabulary("perdu", "perdu", "ADJ", "A2", "lost (masculine)"),
      vocabulary("perdue", "perdu", "ADJ", "A2", "lost (feminine)"),
    ],
  },
];

const TRAVEL_ACTIVITIES: ActivityCurriculumRequirement[] = [
  {
    activityId: "act-travel-meaning-gare-v1",
    requiredConceptIds: ["concept-travel-location"],
    scoredSegments: [scored("prompt", "Où est la gare ?")],
  },
  {
    activityId: "act-travel-fill-gare-v1",
    requiredConceptIds: ["concept-travel-location"],
    scoredSegments: [
      scored("prompt", "Où est la ___ ?"),
      scored("target", "Où est la gare ?"),
      scored("accepted-answer", "gare"),
    ],
  },
  {
    activityId: "act-travel-type-ticket-v1",
    requiredConceptIds: ["concept-travel-ticket"],
    scoredSegments: [
      scored("target", "Je voudrais un billet pour Paris."),
      scored("accepted-answer", "Je voudrais un billet pour Paris."),
      scored("accepted-answer", "Je voudrais un billet pour Paris"),
    ],
  },
  {
    activityId: "act-travel-sentence-builder-time-v1",
    requiredConceptIds: ["concept-travel-departure-time"],
    scoredSegments: [
      scored("token", "part"),
      scored("token", "À"),
      scored("token", "quelle"),
      scored("token", "heure"),
      scored("token", "le"),
      scored("token", "train"),
      scored("accepted-answer", "À quelle heure part le train ?"),
    ],
  },
  {
    activityId: "act-travel-dictation-repeat-v1",
    requiredConceptIds: ["concept-travel-repeat-help"],
    scoredSegments: [
      scored("target", "Pouvez-vous répéter, s'il vous plaît ?"),
      scored("accepted-answer", "Pouvez-vous répéter, s'il vous plaît ?"),
      scored("accepted-answer", "Pouvez vous répéter s'il vous plaît ?"),
      scored("accepted-answer", "Pouvez vous repeter s'il vous plait"),
    ],
  },
  {
    activityId: "act-travel-fill-lost-v1",
    requiredConceptIds: ["concept-travel-lost"],
    scoredSegments: [
      scored("prompt", "Je suis ___."),
      scored("target", "Je suis perdu."),
      scored("accepted-answer", "perdu"),
      scored("accepted-answer", "perdue"),
    ],
  },
  {
    activityId: "act-travel-speak-lost-v1",
    requiredConceptIds: ["concept-travel-lost"],
    scoredSegments: [scored("prompt", "Je suis perdu."), scored("target", "Je suis perdu.")],
  },
];

export const ROLEPLAY_CONCEPTS: ConceptDefinition[] = [
  {
    id: "concept-roleplay-cafe-greeting",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Bonjour, je voudrais + item, s'il vous plaît.",
      metalinguisticRule:
        "Je voudrais is the safer polite request. Je prends is neutral; je veux is more direct and is not the beginner default with a server.",
      positiveExamples: ["Bonjour, je voudrais un café, s'il vous plaît.", "Je prends un café, s'il vous plaît."],
      contrastExamples: ["Je veux un café. (too direct as the opening default)"],
      function: "Use the polite request to open a café exchange.",
      registerNote: "Use vous with a server unless invited to use tu.",
      inputSegment: {
        text: "Bonjour ! Vous désirez ? — Je voudrais un café, s'il vous plaît.",
        inlineGlosses: [
          gloss("Bonjour", "hello"),
          gloss("Vous", "you"),
          gloss("désirez", "would like/want"),
          gloss("Je", "I"),
          gloss("voudrais", "would like"),
          gloss("un", "a"),
          gloss("café", "coffee"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Bonjour", "bonjour", "NOM", "A1", "hello"),
      vocabulary("Vous", "vous", "PRO", "A1", "you"),
      vocabulary("désirez", "désirer", "VER", "A1", "would like/want"),
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("voudrais", "vouloir", "VER", "A1", "would like"),
      vocabulary("prends", "prendre", "VER", "A1", "will have/take"),
      vocabulary("veux", "vouloir", "VER", "A1", "want"),
      vocabulary("un", "un", "DET:ART", "A1", "a"),
      vocabulary("café", "café", "NOM", "A1", "coffee"),
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
    ],
  },
  {
    id: "concept-roleplay-cafe-price",
    prerequisiteConceptIds: ["concept-roleplay-cafe-greeting"],
    teachingStep: {
      form: "C'est combien ?",
      metalinguisticRule: "C'est combien ? is the everyday price question. Quel est le prix ? is correct but more formal.",
      positiveExamples: ["C'est combien ?", "Quel est le prix ?"],
      contrastExamples: ["Combien café ? ✗ (it lacks the required structure)"],
      function: "Use it to ask the price at the counter.",
      inputSegment: {
        text: "Bien sûr. Autre chose ? — C'est combien ?",
        inlineGlosses: [
          gloss("Bien", "well"),
          gloss("sûr", "sure"),
          gloss("Autre", "other"),
          gloss("chose", "thing"),
          gloss("C'", "it/this"),
          gloss("est", "is"),
          gloss("combien", "how much"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Bien", "bien", "ADV", "A1", "well"),
      vocabulary("sûr", "sûr", "ADJ", "A1", "sure"),
      vocabulary("Autre", "autre", "ADJ", "A1", "other"),
      vocabulary("chose", "chose", "NOM", "A1", "thing"),
      vocabulary("C'", "ce", "PRO", "A1", "it/this"),
      vocabulary("est", "être", "VER", "A1", "is"),
      vocabulary("combien", "combien", "ADV", "A1", "how much"),
      vocabulary("Quel", "quel", "PRO", "A1", "what/which"),
      vocabulary("le", "le", "DET:ART", "A1", "the"),
      vocabulary("prix", "prix", "NOM", "A1", "price"),
      vocabulary("café", "café", "NOM", "A1", "coffee"),
    ],
  },
  {
    id: "concept-roleplay-cafe-close",
    prerequisiteConceptIds: ["concept-roleplay-cafe-price"],
    teachingStep: {
      form: "Merci, bonne journée.",
      metalinguisticRule: "Bonne agrees with the feminine noun journée. Merci makes the service-exchange close explicit.",
      positiveExamples: ["Merci, bonne journée.", "Merci beaucoup."],
      contrastExamples: ["OK. (understandable but misses the polite close)"],
      function: "Use it to close a service exchange politely.",
      inputSegment: {
        text: "Deux euros cinquante. — Merci, bonne journée.",
        inlineGlosses: [
          gloss("Deux", "two"),
          gloss("euros", "euros"),
          gloss("cinquante", "fifty"),
          gloss("Merci", "thank you"),
          gloss("bonne", "good"),
          gloss("journée", "day"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Deux", "deux", "NOM", "B2", "two"),
      vocabulary("euros", "euro", "NOM", "A1", "euros"),
      vocabulary("cinquante", "cinquante", "ADJ", "A2", "fifty"),
      vocabulary("Merci", "merci", "NOM", "A1", "thank you"),
      vocabulary("bonne", "bon", "ADJ", "A1", "good"),
      vocabulary("journée", "journée", "NOM", "A1", "day"),
    ],
  },
  {
    id: "concept-roleplay-station-location",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Excusez-moi, où est la gare, s'il vous plaît ?",
      metalinguisticRule:
        "Excusez-moi and s'il vous plaît frame the location question politely when addressing a stranger.",
      positiveExamples: ["Excusez-moi, où est la gare, s'il vous plaît ?", "Où est la gare ?"],
      contrastExamples: ["La gare ? (may work with pointing, but is not a reliable polite sentence)"],
      function: "Use it to ask a stranger where the station is.",
      registerNote: "Polite vous form for a stranger.",
      inputSegment: {
        text: "Oui ? — Excusez-moi, où est la gare, s'il vous plaît ?",
        inlineGlosses: [
          gloss("Oui", "yes"),
          gloss("Excusez", "excuse"),
          gloss("moi", "me"),
          gloss("où", "where"),
          gloss("est", "is"),
          gloss("la", "the"),
          gloss("gare", "station"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Oui", "oui", "INT", "A1", "yes"),
      vocabulary("Excusez", "excuser", "VER", "A1", "excuse"),
      vocabulary("moi", "moi", "PRO", "A1", "me"),
      vocabulary("où", "où", "ADV", "A1", "where"),
      vocabulary("est", "être", "VER", "A1", "is"),
      vocabulary("la", "le", "DET:ART", "A1", "the"),
      vocabulary("gare", "gare", "NOM", "A1", "station"),
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("vous", "vous", "PRO", "A1", "you"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
    ],
  },
  {
    id: "concept-roleplay-repeat-help",
    prerequisiteConceptIds: ["concept-roleplay-station-location"],
    teachingStep: {
      form: "Pouvez-vous répéter, s'il vous plaît ?",
      metalinguisticRule:
        "Pouvez-vous uses polite inversion. The infinitive répéter follows the conjugated modal pouvez.",
      positiveExamples: ["Pouvez-vous répéter, s'il vous plaît ?", "Pouvez-vous parler plus lentement ?"],
      contrastExamples: ["Quoi ? (too abrupt for a stranger)"],
      function: "Use it to recover when you did not understand a stranger.",
      registerNote: "Formal/polite vous.",
      inputSegment: {
        text: "Prenez la deuxième rue à gauche, puis continuez tout droit. — Pouvez-vous répéter, s'il vous plaît ?",
        inlineGlosses: [
          gloss("Prenez", "take"),
          gloss("la", "the"),
          gloss("deuxième", "second"),
          gloss("rue", "street"),
          gloss("à", "to/at"),
          gloss("gauche", "left"),
          gloss("puis", "then"),
          gloss("continuez", "continue"),
          gloss("tout", "straight/all"),
          gloss("droit", "straight"),
          gloss("Pouvez", "can"),
          gloss("vous", "you"),
          gloss("répéter", "repeat"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Prenez", "prendre", "VER", "A1", "take"),
      vocabulary("la", "le", "DET:ART", "A1", "the"),
      vocabulary("rue", "rue", "NOM", "A1", "street"),
      vocabulary("à", "à", "PRP", "A1", "to/at"),
      vocabulary("gauche", "gauche", "NOM", "A1", "left"),
      vocabulary("puis", "puis", "ADV", "A1", "then"),
      vocabulary("continuez", "continuer", "VER", "A1", "continue"),
      vocabulary("tout", "tout", "ADV", "A1", "straight/all"),
      vocabulary("droit", "droit", "ADJ", "A1", "straight"),
      vocabulary("Pouvez", "pouvoir", "VER", "A1", "can"),
      vocabulary("vous", "vous", "PRO", "A1", "you"),
      vocabulary("répéter", "répéter", "VER", "A1", "repeat"),
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
      vocabulary("parler", "parler", "VER", "A1", "speak"),
      vocabulary("plus", "plus", "ADV", "A1", "more"),
      vocabulary("lentement", "lentement", "ADV", "A1", "slowly"),
      vocabulary("Quoi", "quoi", "PRO", "A1", "what"),
    ],
  },
  {
    id: "concept-roleplay-bakery-order",
    prerequisiteConceptIds: ["concept-roleplay-cafe-greeting"],
    teachingStep: {
      form: "Je voudrais une baguette, s'il vous plaît.",
      metalinguisticRule:
        "The polite counter order is one reusable chunk: je voudrais + the item + s'il vous plaît. Swap the item and the same sentence works in any shop.",
      positiveExamples: ["Je voudrais une baguette, s'il vous plaît.", "Je voudrais un croissant, s'il vous plaît."],
      contrastExamples: ["Donne-moi une baguette. (a command, and tu with a stranger)"],
      function: "Order at a bakery or any shop counter.",
      registerNote: "Use vous with staff. Donne-moi is a tu command and lands rudely.",
      inputSegment: {
        text: "Bonjour ! Vous désirez ? — Je voudrais une baguette, s'il vous plaît.",
        inlineGlosses: [
          gloss("Bonjour", "hello"),
          gloss("Vous", "you"),
          gloss("désirez", "would like/want"),
          gloss("Je", "I"),
          gloss("voudrais", "would like"),
          gloss("une", "a"),
          gloss("baguette", "baguette"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      vocabulary("une", "un", "DET:ART", "A1", "a"),
      vocabulary("baguette", "baguette", "NOM", "A2", "baguette"),
      vocabulary("Donne", "donner", "VER", "A1", "give"),
      vocabulary("moi", "moi", "PRO", "A1", "me"),
    ],
  },
  {
    id: "concept-roleplay-bakery-close",
    prerequisiteConceptIds: ["concept-roleplay-bakery-order", "concept-roleplay-cafe-close"],
    teachingStep: {
      form: "C'est tout, merci.",
      metalinguisticRule:
        "Et avec ceci ? asks if you want anything else. C'est tout, merci answers it and closes politely; a bare non sounds cold.",
      positiveExamples: ["C'est tout, merci.", "Merci, au revoir."],
      contrastExamples: ["Non. (understandable, but cold in a service exchange)"],
      function: "Answer the anything-else question and end a shop exchange.",
      inputSegment: {
        text: "Et avec ceci ? — C'est tout, merci.",
        inlineGlosses: [
          gloss("Et", "and"),
          gloss("avec", "with"),
          gloss("ceci", "this"),
          gloss("C'", "it"),
          gloss("est", "is"),
          gloss("tout", "all"),
          gloss("merci", "thank you"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Et", "et", "KON", "A1", "and"),
      vocabulary("avec", "avec", "PRP", "A1", "with"),
      vocabulary("ceci", "ceci", "PRO", "A2", "this"),
      vocabulary("tout", "tout", "PRO", "A1", "all"),
      vocabulary("Non", "non", "ADV", "A1", "no"),
      vocabulary("au", "au", "PRP:det", "A1", "to the"),
      vocabulary("revoir", "revoir", "VER", "A1", "see again"),
    ],
  },
  {
    id: "concept-roleplay-meet-intro",
    prerequisiteConceptIds: ["concept-introduction-name", "concept-introduction-register"],
    teachingStep: {
      form: "Bonjour, oui. Je m'appelle Jamie.",
      metalinguisticRule:
        "Answer a yes-or-no welcome with more than oui: greet, confirm, and give your name so the conversation can continue.",
      positiveExamples: ["Bonjour, oui. Je m'appelle Jamie.", "Salut, moi c'est Jamie."],
      contrastExamples: ["Oui. (answers the question but closes the conversation)"],
      function: "Introduce yourself when someone greets you first.",
      registerNote: "Salut fits peers you already know. Bonjour is the safe first-day default.",
      inputSegment: {
        text: "Vous êtes nouveau ici ? — Bonjour, oui. Je m'appelle Jamie.",
        inlineGlosses: [
          gloss("Vous", "you"),
          gloss("êtes", "are"),
          gloss("nouveau", "new"),
          gloss("ici", "here"),
          gloss("Bonjour", "hello"),
          gloss("oui", "yes"),
          gloss("Je", "I"),
          gloss("m'", "myself"),
          gloss("appelle", "call"),
          gloss("Jamie", "(a name)"),
        ],
      },
    },
    vocabulary: [
      vocabulary("êtes", "être", "VER", "A1", "are"),
      vocabulary("nouveau", "nouveau", "ADJ", "A1", "new"),
      vocabulary("ici", "ici", "ADV", "A1", "here"),
      vocabulary("oui", "oui", "INT", "A1", "yes"),
      vocabulary("Salut", "salut", "NOM", "A1", "hi"),
    ],
  },
  {
    id: "concept-roleplay-meet-origin",
    prerequisiteConceptIds: ["concept-introduction-origin", "concept-roleplay-meet-intro"],
    teachingStep: {
      form: "Vous venez d'où ?",
      metalinguisticRule:
        "Venez is the vous form of venir. Answer the d'où question with the practised pattern: je viens de + place.",
      positiveExamples: ["Je viens de Belfast.", "Je viens de Paris."],
      contrastExamples: ["Belfast. (one word answers the question but drops the conversation)"],
      function: "Say where you are from when someone new asks.",
      inputSegment: {
        text: "Moi, c'est Claire. Vous venez d'où ? — Je viens de Belfast.",
        inlineGlosses: [
          gloss("Moi", "me"),
          gloss("c'", "it"),
          gloss("est", "is"),
          gloss("Claire", "(a name)"),
          gloss("Vous", "you"),
          gloss("venez", "come"),
          gloss("d'", "from"),
          gloss("où", "where"),
          gloss("Je", "I"),
          gloss("viens", "come"),
          gloss("de", "from"),
          gloss("Belfast", "(a city)"),
        ],
      },
    },
    vocabulary: [
      vocabulary("venez", "venir", "VER", "A1", "come"),
      vocabulary("où", "où", "ADV", "A1", "where"),
      vocabulary("suis", "être", "VER", "A1", "am"),
    ],
  },
  {
    id: "concept-roleplay-meet-close",
    prerequisiteConceptIds: ["concept-roleplay-cafe-close", "concept-roleplay-meet-intro"],
    teachingStep: {
      form: "Merci, bonne journée à vous aussi !",
      metalinguisticRule:
        "Returning the wish with à vous aussi turns a goodbye into a warm exchange instead of a one-way close.",
      positiveExamples: ["Merci, bonne journée à vous aussi !", "Merci !"],
      contrastExamples: ["(A silent nod.) (reads as cold when someone wishes you well)"],
      function: "Accept a good-day wish and return it.",
      inputSegment: {
        text: "Bonne journée ! — Merci, bonne journée à vous aussi !",
        inlineGlosses: [
          gloss("Bonne", "good"),
          gloss("journée", "day"),
          gloss("Merci", "thank you"),
          gloss("à", "to"),
          gloss("vous", "you"),
          gloss("aussi", "too"),
        ],
      },
    },
    vocabulary: [
      vocabulary("à", "à", "PRP", "A1", "to"),
      vocabulary("aussi", "aussi", "ADV", "A1", "too"),
    ],
  },
];

const ROLEPLAY_ACTIVITIES: ActivityCurriculumRequirement[] = [
  {
    activityId: "roleplay:cafe-counter:greeting",
    requiredConceptIds: ["concept-roleplay-cafe-greeting"],
    scoredSegments: [
      scored("prompt", "Bonjour ! Vous désirez ?"),
      scored("choice", "Bonjour, je voudrais un café, s'il vous plaît."),
      scored("choice", "Je prends un café."),
      scored("choice", "Je veux un café."),
    ],
  },
  {
    activityId: "roleplay:cafe-counter:price",
    requiredConceptIds: ["concept-roleplay-cafe-price"],
    scoredSegments: [
      scored("prompt", "Bien sûr. Autre chose ?"),
      scored("choice", "C'est combien ?"),
      scored("choice", "Quel est le prix ?"),
      scored("choice", "Combien café ?"),
    ],
  },
  {
    activityId: "roleplay:cafe-counter:close",
    requiredConceptIds: ["concept-roleplay-cafe-close"],
    scoredSegments: [
      scored("prompt", "Deux euros cinquante."),
      scored("choice", "Merci, bonne journée."),
    ],
  },
  {
    activityId: "roleplay:station-help:ask-location",
    requiredConceptIds: ["concept-roleplay-station-location"],
    scoredSegments: [
      scored("prompt", "Oui ?"),
      scored("choice", "Excusez-moi, où est la gare, s'il vous plaît ?"),
      scored("choice", "Où est la gare ?"),
      scored("choice", "La gare ?"),
    ],
  },
  {
    activityId: "roleplay:station-help:recover",
    requiredConceptIds: ["concept-roleplay-repeat-help"],
    scoredSegments: [
      scored("prompt", "Prenez la deuxième rue à gauche, puis continuez tout droit."),
      scored("choice", "Pouvez-vous répéter, s'il vous plaît ?"),
      scored("choice", "Pouvez-vous parler plus lentement ?"),
      scored("choice", "Quoi ?"),
    ],
  },
  {
    activityId: "roleplay:bakery-counter:order",
    requiredConceptIds: ["concept-roleplay-bakery-order"],
    scoredSegments: [
      scored("prompt", "Bonjour ! Vous désirez ?"),
      scored("choice", "Bonjour, je voudrais une baguette, s'il vous plaît."),
      scored("choice", "Une baguette, s'il vous plaît."),
      scored("choice", "Donne-moi une baguette."),
    ],
  },
  {
    activityId: "roleplay:bakery-counter:anything-else",
    requiredConceptIds: ["concept-roleplay-bakery-close"],
    scoredSegments: [
      scored("prompt", "Et avec ceci ?"),
      scored("choice", "C'est tout, merci."),
      scored("choice", "C'est tout."),
      scored("choice", "Non."),
    ],
  },
  {
    activityId: "roleplay:bakery-counter:pay-close",
    requiredConceptIds: ["concept-roleplay-bakery-close"],
    scoredSegments: [
      scored("prompt", "Deux euros, s'il vous plaît."),
      scored("choice", "Merci, bonne journée !"),
      scored("choice", "Merci, au revoir."),
    ],
  },
  {
    activityId: "roleplay:meeting-colleague:introduce",
    requiredConceptIds: ["concept-roleplay-meet-intro"],
    scoredSegments: [
      scored("prompt", "Bonjour ! Vous êtes nouveau ici ?"),
      scored("choice", "Bonjour, oui. Je m'appelle Jamie."),
      scored("choice", "Salut, moi c'est Jamie."),
      scored("choice", "Oui."),
    ],
  },
  {
    activityId: "roleplay:meeting-colleague:origin",
    requiredConceptIds: ["concept-roleplay-meet-origin"],
    scoredSegments: [
      scored("prompt", "Moi, c'est Claire. Vous venez d'où ?"),
      scored("choice", "Je viens de Belfast."),
      scored("choice", "Je suis de Belfast."),
      scored("choice", "Belfast."),
    ],
  },
  {
    activityId: "roleplay:meeting-colleague:welcome",
    requiredConceptIds: ["concept-roleplay-meet-close"],
    scoredSegments: [
      scored("prompt", "Bonne journée !"),
      scored("choice", "Merci, bonne journée à vous aussi !"),
      scored("choice", "Merci !"),
    ],
  },
];

export const LISTENING_CONCEPTS: ConceptDefinition[] = [
  {
    id: "concept-listen-introduction",
    prerequisiteConceptIds: [],
    teachingStep: {
      ...INTRODUCTION_CONCEPTS[0].teachingStep,
      form: "Bonjour, je m'appelle + name.",
      positiveExamples: ["Bonjour, je m'appelle Jamie.", ...INTRODUCTION_CONCEPTS[0].teachingStep.positiveExamples],
      inputSegment: {
        text: "Bonjour, je m'appelle Jamie.",
        inlineGlosses: [
          gloss("Bonjour", "hello"),
          gloss("je", "I"),
          gloss("m'", "myself"),
          gloss("appelle", "call"),
          gloss("Jamie", "the speaker's name"),
        ],
      },
    },
    vocabulary: [vocabulary("Bonjour", "bonjour", "NOM", "A1", "hello"), ...INTRODUCTION_CONCEPTS[0].vocabulary],
  },
  {
    id: "concept-listen-cafe",
    prerequisiteConceptIds: [],
    teachingStep: CAFE_CONCEPTS[0].teachingStep,
    vocabulary: CAFE_CONCEPTS[0].vocabulary,
  },
  {
    id: "concept-listen-age",
    prerequisiteConceptIds: [],
    teachingStep: {
      ...INTRODUCTION_CONCEPTS[1].teachingStep,
      positiveExamples: ["J'ai vingt ans.", "J'ai trente ans."],
      inputSegment: {
        text: "J'ai vingt ans.",
        inlineGlosses: [gloss("J'", "I"), gloss("ai", "have"), gloss("vingt", "twenty"), gloss("ans", "years")],
      },
    },
    vocabulary: INTRODUCTION_CONCEPTS[1].vocabulary,
  },
  {
    id: "concept-listen-origin",
    prerequisiteConceptIds: [],
    teachingStep: INTRODUCTION_CONCEPTS[2].teachingStep,
    vocabulary: INTRODUCTION_CONCEPTS[2].vocabulary,
  },
  {
    id: "concept-listen-location",
    prerequisiteConceptIds: [],
    teachingStep: {
      ...TRAVEL_CONCEPTS[0].teachingStep,
      positiveExamples: ["Où est la gare, s'il vous plaît ?", "Où est le café, s'il vous plaît ?"],
      inputSegment: {
        text: "Où est la gare, s'il vous plaît ?",
        inlineGlosses: [
          gloss("Où", "where"),
          gloss("est", "is"),
          gloss("la", "the"),
          gloss("gare", "station"),
          gloss("s'", "if"),
          gloss("il", "it"),
          gloss("vous", "you"),
          gloss("plaît", "pleases"),
        ],
      },
    },
    vocabulary: [
      ...TRAVEL_CONCEPTS[0].vocabulary,
      vocabulary("s'", "si", "KON", "A1", "if"),
      vocabulary("il", "il", "PRO", "A1", "it"),
      vocabulary("vous", "vous", "PRO", "A1", "you"),
      vocabulary("plaît", "plaire", "VER", "A1", "pleases"),
    ],
  },
];

const LISTENING_ACTIVITIES: ActivityCurriculumRequirement[] = [
  {
    activityId: "listen:shadow-bonjour",
    requiredConceptIds: ["concept-listen-introduction"],
    scoredSegments: [scored("target", "Bonjour, je m'appelle Jamie.")],
  },
  {
    activityId: "listen:shadow-cafe",
    requiredConceptIds: ["concept-listen-cafe"],
    scoredSegments: [scored("target", "Je voudrais un café, s'il vous plaît.")],
  },
  {
    activityId: "listen:shadow-age",
    requiredConceptIds: ["concept-listen-age"],
    scoredSegments: [scored("target", "J'ai vingt ans.")],
  },
  {
    activityId: "listen:shadow-origin",
    requiredConceptIds: ["concept-listen-origin"],
    scoredSegments: [scored("target", "Je viens de Belfast.")],
  },
  {
    activityId: "listen:shadow-question",
    requiredConceptIds: ["concept-listen-location"],
    scoredSegments: [scored("target", "Où est la gare, s'il vous plaît ?")],
  },
];

const speakingConceptIds = [
  "concept-speak-shadow-bonjour",
  "concept-speak-shadow-cafe",
  "concept-speak-shadow-age",
  "concept-speak-shadow-origin",
  "concept-speak-shadow-question",
] as const;

export const SPEAKING_CONCEPTS: ConceptDefinition[] = LISTENING_CONCEPTS.map((concept, index) => ({
  ...concept,
  id: speakingConceptIds[index],
  prerequisiteConceptIds: [],
}));

const SPEAKING_ACTIVITIES: ActivityCurriculumRequirement[] = LISTENING_ACTIVITIES.map((activity, index) => ({
  activityId: `speak:${activity.activityId.slice("listen:".length)}`,
  requiredConceptIds: [speakingConceptIds[index]],
  scoredSegments: activity.scoredSegments,
}));

export const TOPIC_PREVIEW_CONCEPTS: ConceptDefinition[] = [
  {
    id: "concept-preview-work-marketing",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Je travaille dans le marketing.",
      metalinguisticRule: "Use travailler dans before a field or sector to say the area you work in.",
      positiveExamples: ["Je travaille dans le marketing.", "Je travaille dans la finance."],
      contrastExamples: ["Je suis le marketing. (this does not express your field of work)"],
      function: "Use it to tell someone your field of work.",
      registerNote: "Neutral and suitable at work.",
      inputSegment: {
        text: "Je travaille dans le marketing.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("travaille", "work"),
          gloss("dans", "in"),
          gloss("le", "the"),
          gloss("marketing", "marketing"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("travaille", "travailler", "VER", "A1", "work"),
      vocabulary("dans", "dans", "PRP", "A1", "in"),
      vocabulary("le", "le", "DET:ART", "A1", "the"),
      vocabulary("marketing", "marketing", "NOM", "B2", "marketing"),
    ],
  },
  {
    id: "concept-preview-opinion",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Je pense que + statement.",
      metalinguisticRule: "Je pense que introduces an opinion; the statement follows que.",
      positiveExamples: ["Je pense que c'est une bonne idée.", "Je pense que c'est pratique."],
      contrastExamples: ["Je pense c'est une bonne idée. (spoken, but the taught neutral form keeps que)"],
      function: "Use it to give a simple opinion.",
      registerNote: "Neutral everyday French.",
      inputSegment: {
        text: "Je pense que c'est une bonne idée.",
        inlineGlosses: [
          gloss("Je", "I"),
          gloss("pense", "think"),
          gloss("que", "that"),
          gloss("c'", "it/this"),
          gloss("est", "is"),
          gloss("une", "a"),
          gloss("bonne", "good"),
          gloss("idée", "idea"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Je", "je", "PRO", "A1", "I"),
      vocabulary("pense", "penser", "VER", "A1", "think"),
      vocabulary("que", "que", "KON", "A1", "that"),
      vocabulary("c'", "ce", "PRO", "A1", "it/this"),
      vocabulary("est", "être", "VER", "A1", "is"),
      vocabulary("une", "un", "DET:ART", "A1", "a"),
      vocabulary("bonne", "bon", "ADJ", "A1", "good"),
      vocabulary("idée", "idée", "NOM", "A1", "idea"),
    ],
  },
  {
    id: "concept-preview-missing-word",
    prerequisiteConceptIds: [],
    teachingStep: {
      form: "Comment dit-on ça en français ?",
      metalinguisticRule: "Dit-on is an inversion question: the verb comes before the subject on.",
      positiveExamples: ["Comment dit-on ça en français ?", "Comment dit-on train en français ?"],
      contrastExamples: ["Comment ça dit ? (not the taught standard question)"],
      function: "Use it to ask for a French word you do not know.",
      registerNote: "Neutral and reusable with teachers, friends, or strangers.",
      inputSegment: {
        text: "Comment dit-on ça en français ?",
        inlineGlosses: [
          gloss("Comment", "how"),
          gloss("dit", "says"),
          gloss("on", "one/we"),
          gloss("ça", "that"),
          gloss("en", "in"),
          gloss("français", "French"),
        ],
      },
    },
    vocabulary: [
      vocabulary("Comment", "comment", "ADV", "A1", "how"),
      vocabulary("dit", "dire", "VER", "A1", "says"),
      vocabulary("on", "on", "PRO", "A1", "one/we"),
      vocabulary("ça", "cela", "PRO", "A1", "that"),
      vocabulary("en", "en", "PRP", "A1", "in"),
      vocabulary("français", "français", "NOM", "A2", "French"),
    ],
  },
];

const TOPIC_PREVIEW_ACTIVITIES: ActivityCurriculumRequirement[] = [
  { activityId: "preview:introduce-yourself:0", requiredConceptIds: ["concept-age-avoir"], scoredSegments: [scored("accepted-answer", "J'ai 20 ans.")] },
  { activityId: "preview:cafe-food:0", requiredConceptIds: ["concept-cafe-polite-order"], scoredSegments: [scored("accepted-answer", "Je voudrais un café, s'il vous plaît.")] },
  { activityId: "preview:cafe-food:1", requiredConceptIds: ["concept-cafe-price"], scoredSegments: [scored("accepted-answer", "C'est combien ?")] },
  { activityId: "preview:travel-basics:0", requiredConceptIds: ["concept-travel-location"], scoredSegments: [scored("accepted-answer", "Où est la gare ?")] },
  { activityId: "preview:travel-basics:1", requiredConceptIds: ["concept-travel-repeat-help"], scoredSegments: [scored("accepted-answer", "Pouvez-vous répéter, s'il vous plaît ?")] },
  { activityId: "preview:work-basics:0", requiredConceptIds: ["concept-roleplay-repeat-help"], scoredSegments: [scored("accepted-answer", "Pouvez-vous parler plus lentement ?")] },
  { activityId: "preview:work-basics:1", requiredConceptIds: ["concept-preview-work-marketing"], scoredSegments: [scored("accepted-answer", "Je travaille dans le marketing.")] },
  { activityId: "preview:everyday-conversation:0", requiredConceptIds: ["concept-preview-opinion"], scoredSegments: [scored("accepted-answer", "Je pense que c'est une bonne idée.")] },
  { activityId: "preview:everyday-conversation:1", requiredConceptIds: ["concept-preview-missing-word"], scoredSegments: [scored("accepted-answer", "Comment dit-on ça en français ?")] },
];

export const ROLEPLAY_TEACHING_STEPS: TeachingStep[] = ROLEPLAY_CONCEPTS.map((concept) => concept.teachingStep);
export const LISTENING_TEACHING_STEPS: TeachingStep[] = LISTENING_CONCEPTS.map((concept) => concept.teachingStep);

export const CURRICULUM_MISSIONS: MissionCurriculum[] = [
  {
    missionId: "mission-introduce-yourself-v1",
    concepts: INTRODUCTION_CONCEPTS,
    activities: INTRODUCTION_ACTIVITIES,
  },
  {
    missionId: "mission-cafe-food-v1",
    concepts: CAFE_CONCEPTS,
    activities: CAFE_ACTIVITIES,
  },
  {
    missionId: "mission-travel-basics-v1",
    concepts: TRAVEL_CONCEPTS,
    activities: TRAVEL_ACTIVITIES,
  },
  {
    missionId: "standalone-roleplay",
    concepts: ROLEPLAY_CONCEPTS,
    activities: ROLEPLAY_ACTIVITIES,
  },
  {
    missionId: "standalone-listening",
    concepts: LISTENING_CONCEPTS,
    activities: LISTENING_ACTIVITIES,
  },
  {
    missionId: "standalone-speaking",
    concepts: SPEAKING_CONCEPTS,
    activities: SPEAKING_ACTIVITIES,
  },
  {
    missionId: "standalone-topic-previews",
    concepts: TOPIC_PREVIEW_CONCEPTS,
    activities: TOPIC_PREVIEW_ACTIVITIES,
  },
];

const allConcepts = CURRICULUM_MISSIONS.flatMap((mission) => mission.concepts);
const conceptsById = new Map(allConcepts.map((concept) => [concept.id, concept]));
const activityRequirements = CURRICULUM_MISSIONS.flatMap((mission) => mission.activities);
const activitiesById = new Map(activityRequirements.map((activity) => [activity.activityId, activity]));

export function getMissionCurriculum(missionId: string): MissionCurriculum | undefined {
  return CURRICULUM_MISSIONS.find((mission) => mission.missionId === missionId);
}

export function getConceptDefinition(conceptId: string): ConceptDefinition | undefined {
  return conceptsById.get(conceptId);
}

export function getActivityCurriculum(activityId: string): ActivityCurriculumRequirement | undefined {
  return activitiesById.get(activityId);
}

export function getConceptDefinitionsForActivity(activityId: string): ConceptDefinition[] {
  const requirement = getActivityCurriculum(activityId);
  if (!requirement) return [];

  const ordered: ConceptDefinition[] = [];
  const visited = new Set<string>();

  const include = (conceptId: string) => {
    if (visited.has(conceptId)) return;
    visited.add(conceptId);

    const concept = getConceptDefinition(conceptId);
    if (!concept) return;
    concept.prerequisiteConceptIds.forEach(include);
    ordered.push(concept);
  };

  requirement.requiredConceptIds.forEach(include);
  return ordered;
}

export function getTeachingStepsForActivity(activityId: string): TeachingStep[] {
  return getConceptDefinitionsForActivity(activityId).map((concept) => concept.teachingStep);
}

export function getRoleplayActivityId(scenarioId: string, turnId: string): string {
  return `roleplay:${scenarioId}:${turnId}`;
}

export function getListeningActivityId(phraseId: string): string {
  return `listen:${phraseId}`;
}

export function getSpeakingActivityId(phraseId: string): string {
  return `speak:${phraseId}`;
}

export function getTopicPreviewActivityId(topicSlug: string, selfCheckIndex: number): string {
  return `preview:${topicSlug}:${selfCheckIndex}`;
}

export function getRoleplayTeachingStep(scenarioId: string, turnId: string): TeachingStep | undefined {
  return getTeachingStepsForActivity(getRoleplayActivityId(scenarioId, turnId)).at(-1);
}

export function getListeningTeachingStep(phraseId: string): TeachingStep | undefined {
  return getTeachingStepsForActivity(getListeningActivityId(phraseId)).at(-1);
}

export function getSpeakingConceptDefinition(phraseId: string): ConceptDefinition | undefined {
  return getConceptDefinitionsForActivity(getSpeakingActivityId(phraseId)).at(-1);
}

export function getTopicPreviewConceptDefinition(topicSlug: string, selfCheckIndex: number): ConceptDefinition | undefined {
  return getConceptDefinitionsForActivity(getTopicPreviewActivityId(topicSlug, selfCheckIndex)).at(-1);
}
