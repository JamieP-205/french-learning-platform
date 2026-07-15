// Fixed, bundled audio keeps core listening practice working when a browser
// has no French speech-synthesis voice or its speech service is unavailable.
// Keep this map explicit: tests verify that every declared path exists.
export const FRENCH_AUDIO_BY_TEXT = {
  "Bonjour, je m'appelle Jamie.": "/audio/french/bonjour-je-mappelle-jamie.mp3",
  "Je m'appelle Jamie.": "/audio/french/je-mappelle-jamie.mp3",
  "Je voudrais un café, s'il vous plaît.": "/audio/french/je-voudrais-un-cafe-sil-vous-plait.mp3",
  "Bonjour, je voudrais un café, s'il vous plaît.":
    "/audio/french/bonjour-je-voudrais-un-cafe-sil-vous-plait.mp3",
  "J'ai vingt ans.": "/audio/french/jai-vingt-ans.mp3",
  "Je viens de Belfast.": "/audio/french/je-viens-de-belfast.mp3",
  "Où est la gare, s'il vous plaît ?": "/audio/french/ou-est-la-gare-sil-vous-plait.mp3",
  "Aujourd'hui, j'étudie le français.": "/audio/french/aujourdhui-jetudie-le-francais.mp3",
  "C'est combien ?": "/audio/french/cest-combien.mp3",
  "L'addition, s'il vous plaît.": "/audio/french/laddition-sil-vous-plait.mp3",
  "Où est la gare ?": "/audio/french/ou-est-la-gare.mp3",
  "Je voudrais un billet pour Paris.": "/audio/french/je-voudrais-un-billet-pour-paris.mp3",
  "Pouvez-vous répéter, s'il vous plaît ?": "/audio/french/pouvez-vous-repeter-sil-vous-plait.mp3",
  "Je suis perdu.": "/audio/french/je-suis-perdu.mp3",
} as const satisfies Readonly<Record<string, string>>;

export type BundledFrenchText = keyof typeof FRENCH_AUDIO_BY_TEXT;

export function audioSourceForFrench(text: string): string | undefined {
  const normalised = text.normalize("NFC").replace(/\s+/g, " ").trim();
  return (FRENCH_AUDIO_BY_TEXT as Readonly<Record<string, string>>)[normalised];
}
