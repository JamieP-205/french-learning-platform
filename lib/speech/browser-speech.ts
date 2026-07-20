"use client";

// Browser-first speech layer. Synthesis and recognition both come from free
// Web APIs; a paid provider can implement the same outcomes later without
// teaching screens having to pretend that silent playback succeeded.

export type SpeechSupport = {
  canSpeak: boolean;
  canListen: boolean;
};

export type SpeechPlaybackOutcome =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "unavailable" }
  | { status: "failed"; reason: string };

type SpeechRecognitionResultLike = { transcript: string; confidence: number };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionConstructor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === "undefined") return undefined;
  const candidate = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition;
}

function synthesisEnvironment() {
  if (typeof window === "undefined") return undefined;
  const candidate = window as typeof window & {
    SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
  };
  if (!candidate.speechSynthesis || typeof candidate.SpeechSynthesisUtterance !== "function") return undefined;
  if (typeof candidate.speechSynthesis.speak !== "function") return undefined;
  return {
    synth: candidate.speechSynthesis,
    Utterance: candidate.SpeechSynthesisUtterance,
  };
}

export function speechSupport(): SpeechSupport {
  return {
    canSpeak: Boolean(synthesisEnvironment()),
    canListen: Boolean(recognitionConstructor()),
  };
}

let voicesWarmedUp = false;

// Some browsers return an empty voice list until voiceschanged fires; warming
// up early makes later playback more likely to use an installed matching voice.
export function warmUpVoices() {
  const environment = synthesisEnvironment();
  if (voicesWarmedUp || !environment) return;
  voicesWarmedUp = true;
  environment.synth.getVoices();
  environment.synth.addEventListener?.("voiceschanged", () => environment.synth.getVoices(), { once: true });
}

function matchingVoice(synth: SpeechSynthesis, language: string): SpeechSynthesisVoice | undefined {
  const normalisedLanguage = language.toLowerCase();
  const baseLanguage = normalisedLanguage.split("-")[0];
  const voices = synth.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === normalisedLanguage) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(`${baseLanguage}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase() === baseLanguage)
  );
}

let settleActivePlayback: ((outcome: SpeechPlaybackOutcome) => void) | undefined;

export function speakText(
  text: string,
  { language, rate = 0.9 }: { language: string; rate?: number },
): Promise<SpeechPlaybackOutcome> {
  const environment = synthesisEnvironment();
  if (!environment || !text.trim()) return Promise.resolve({ status: "unavailable" });

  warmUpVoices();
  const { synth, Utterance } = environment;

  // Only cancel when something is actually active. Calling cancel immediately
  // before the first speak() can make Chromium silently drop that first utterance.
  if (settleActivePlayback || synth.speaking || synth.pending) {
    settleActivePlayback?.({ status: "cancelled" });
    settleActivePlayback = undefined;
    synth.cancel();
  }
  if (synth.paused) synth.resume();

  return new Promise((resolve) => {
    const utterance = new Utterance(text);
    utterance.lang = language;
    utterance.rate = rate;
    const voice = matchingVoice(synth, language);
    if (voice) utterance.voice = voice;

    let settled = false;
    const timeoutMs = Math.max(8_000, Math.min(30_000, (text.length / Math.max(rate, 0.4)) * 180));
    const timeoutId = window.setTimeout(() => {
      settle({ status: "failed", reason: "Playback did not start or finish." });
      synth.cancel();
    }, timeoutMs);
    const settle = (outcome: SpeechPlaybackOutcome) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (settleActivePlayback === settle) settleActivePlayback = undefined;
      resolve(outcome);
    };

    settleActivePlayback = settle;
    utterance.onend = () => settle({ status: "completed" });
    utterance.onerror = (event) => {
      const reason = event.error === "canceled" || event.error === "interrupted" ? "Playback was stopped." : "The browser could not play this audio.";
      settle(event.error === "canceled" || event.error === "interrupted" ? { status: "cancelled" } : { status: "failed", reason });
    };

    try {
      synth.speak(utterance);
    } catch {
      settle({ status: "failed", reason: "The browser could not start audio playback." });
    }
  });
}

export function speakFrench(text: string, { rate = 0.9 }: { rate?: number } = {}) {
  return speakText(text, { language: "fr-FR", rate });
}

export function speakEnglish(text: string, { rate = 0.95 }: { rate?: number } = {}) {
  return speakText(text, { language: "en-GB", rate });
}

export function stopSpeaking() {
  const environment = synthesisEnvironment();
  if (!environment) return;
  settleActivePlayback?.({ status: "cancelled" });
  settleActivePlayback = undefined;
  environment.synth.cancel();
}

export type ListenOutcome =
  | { status: "result"; transcript: string; alternatives: { transcript: string; confidence: number }[] }
  | { status: "no-speech" }
  | { status: "denied" }
  | { status: "error" };

// One-shot French recognition. Resolves when the utterance ends, so callers
// only manage a simple listening flag.
export function listenOnceInFrench(): Promise<ListenOutcome> {
  const Recognition = recognitionConstructor();
  if (!Recognition) return Promise.resolve({ status: "error" });

  return new Promise((resolve) => {
    const recognition = new Recognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    let settled = false;
    const settle = (outcome: ListenOutcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    recognition.onresult = (event) => {
      const alternatives = event.results[0];
      const candidates: { transcript: string; confidence: number }[] = [];
      for (let index = 0; index < (alternatives?.length ?? 0); index += 1) {
        const candidate = alternatives[index];
        const transcript = candidate?.transcript?.trim();
        if (transcript) candidates.push({ transcript, confidence: candidate.confidence ?? 0 });
      }
      const best = candidates[0];
      settle(best ? { status: "result", transcript: best.transcript, alternatives: candidates } : { status: "no-speech" });
    };
    recognition.onerror = (event) => {
      settle(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? { status: "denied" }
          : event.error === "no-speech"
            ? { status: "no-speech" }
            : { status: "error" },
      );
    };
    recognition.onend = () => settle({ status: "no-speech" });

    try {
      recognition.start();
    } catch {
      settle({ status: "error" });
    }
  });
}
