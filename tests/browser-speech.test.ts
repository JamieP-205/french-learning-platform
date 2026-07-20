import { afterEach, describe, expect, it, vi } from "vitest";
import {
  speakEnglish,
  speakFrench,
  speechSupport,
  stopSpeaking,
  type SpeechPlaybackOutcome,
} from "../lib/speech/browser-speech";
import { FRENCH_RATE_NORMAL } from "../lib/speech/speech-rates";

class MockUtterance {
  lang = "";
  rate = 1;
  voice?: SpeechSynthesisVoice;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(readonly text: string) {}
}

function speechEnvironment() {
  const utterances: MockUtterance[] = [];
  const frenchVoice = { lang: "fr-FR", name: "French test voice" } as SpeechSynthesisVoice;
  const englishVoice = { lang: "en-GB", name: "English test voice" } as SpeechSynthesisVoice;
  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: vi.fn(() => [englishVoice, frenchVoice]),
    addEventListener: vi.fn(),
    speak: vi.fn((utterance: MockUtterance) => utterances.push(utterance)),
    cancel: vi.fn(),
    resume: vi.fn(),
  };
  vi.stubGlobal("window", {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: MockUtterance,
    setTimeout,
    clearTimeout,
  });
  return { synth, utterances, frenchVoice, englishVoice };
}

afterEach(() => {
  stopSpeaking();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("browser speech playback", () => {
  it("does not claim playback support when the utterance API is missing", () => {
    vi.stubGlobal("window", { speechSynthesis: { speak: vi.fn() } });

    expect(speechSupport().canSpeak).toBe(false);
  });

  it("reports completion only after the browser ends French playback", async () => {
    const { synth, utterances, frenchVoice } = speechEnvironment();
    let outcome: SpeechPlaybackOutcome | undefined;

    const playback = speakFrench("Bonjour", { rate: 0.8 }).then((result) => {
      outcome = result;
      return result;
    });

    expect(synth.cancel).not.toHaveBeenCalled();
    expect(outcome).toBeUndefined();
    expect(utterances).toHaveLength(1);
    expect(utterances[0]).toMatchObject({ text: "Bonjour", lang: "fr-FR", rate: 0.8, voice: frenchVoice });

    utterances[0].onend?.();
    await expect(playback).resolves.toEqual({ status: "completed" });
  });

  it("speaks French at the learner-friendly default rate", async () => {
    const { utterances } = speechEnvironment();
    const playback = speakFrench("Bonjour");

    expect(utterances[0]).toMatchObject({ text: "Bonjour", lang: "fr-FR", rate: FRENCH_RATE_NORMAL });

    utterances[0].onend?.();
    await expect(playback).resolves.toEqual({ status: "completed" });
  });

  it("surfaces a synthesis error instead of treating a silent failure as success", async () => {
    const { utterances } = speechEnvironment();
    const playback = speakFrench("Bonjour");

    utterances[0].onerror?.({ error: "synthesis-failed" });

    await expect(playback).resolves.toEqual({
      status: "failed",
      reason: "The browser could not play this audio.",
    });
  });

  it("fails a silent playback that never emits a browser event", async () => {
    vi.useFakeTimers();
    const { synth } = speechEnvironment();
    const playback = speakFrench("Bonjour");

    await vi.advanceTimersByTimeAsync(8_000);

    await expect(playback).resolves.toEqual({
      status: "failed",
      reason: "Playback did not start or finish.",
    });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels the previous outcome when another phrase starts", async () => {
    const { synth, utterances } = speechEnvironment();
    const first = speakFrench("Bonjour");
    const second = speakFrench("Au revoir");

    await expect(first).resolves.toEqual({ status: "cancelled" });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(utterances).toHaveLength(2);

    utterances[1].onend?.();
    await expect(second).resolves.toEqual({ status: "completed" });
  });

  it("uses an English voice for the walking-mode instruction", async () => {
    const { utterances, englishVoice } = speechEnvironment();
    const playback = speakEnglish("Say in French: hello");

    expect(utterances[0]).toMatchObject({ lang: "en-GB", voice: englishVoice });
    utterances[0].onend?.();
    await expect(playback).resolves.toEqual({ status: "completed" });
  });
});
