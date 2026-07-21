// The single source of truth for playback speed. Learners repeatedly said the
// French was too fast, so the everyday rate sits below native pace and the
// slow rate leaves room to hear each sound. Both bundled MP3 playbackRate and
// speechSynthesis rate read from here; nothing should hardcode a number.
export const FRENCH_RATE_NORMAL = 0.85;
export const FRENCH_RATE_SLOW = 0.7;

// English prompts stay close to natural pace; they are instructions, not
// listening practice.
export const ENGLISH_RATE = 0.95;
