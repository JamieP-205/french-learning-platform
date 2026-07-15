import { afterEach, describe, expect, it, vi } from "vitest";
import {
  playTextAudio,
  stopTextAudio,
} from "../lib/speech/audio-playback";

class MockUtterance {
  lang = "";
  rate = 1;
  voice?: SpeechSynthesisVoice;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(readonly text: string) {}
}

class MockAudio {
  static instances: MockAudio[] = [];

  preload = "";
  playbackRate = 1;
  defaultPlaybackRate = 1;
  preservesPitch = false;
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();

  constructor(readonly src: string) {
    MockAudio.instances.push(this);
  }
}

function playbackEnvironment() {
  MockAudio.instances = [];
  const utterances: MockUtterance[] = [];
  const synthesis = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    speak: vi.fn((utterance: MockUtterance) => utterances.push(utterance)),
    cancel: vi.fn(),
    resume: vi.fn(),
  };
  vi.stubGlobal("window", {
    Audio: MockAudio,
    SpeechSynthesisUtterance: MockUtterance,
    speechSynthesis: synthesis,
    setTimeout,
    clearTimeout,
  });
  return { synthesis, utterances };
}

afterEach(() => {
  stopTextAudio();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bundled audio playback", () => {
  it("plays the bundled file before attempting browser speech", async () => {
    const { synthesis } = playbackEnvironment();
    const playback = playTextAudio({
      text: "Bonjour",
      language: "fr-FR",
      rate: 0.8,
      audioSource: "/audio/french/bonjour.mp3",
      owner: Symbol("test"),
    });

    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0]).toMatchObject({
      src: "/audio/french/bonjour.mp3",
      playbackRate: 0.8,
      defaultPlaybackRate: 0.8,
      preservesPitch: true,
    });
    expect(synthesis.speak).not.toHaveBeenCalled();

    MockAudio.instances[0].onended?.();
    await expect(playback).resolves.toEqual({ status: "completed" });
  });

  it("falls back to browser speech when the bundled file fails", async () => {
    const { synthesis, utterances } = playbackEnvironment();
    const playback = playTextAudio({
      text: "Bonjour",
      language: "fr-FR",
      audioSource: "/audio/french/missing.mp3",
      owner: Symbol("test"),
    });

    MockAudio.instances[0].onerror?.();
    await vi.waitFor(() => expect(synthesis.speak).toHaveBeenCalledTimes(1));
    expect(utterances[0]).toMatchObject({ text: "Bonjour", lang: "fr-FR" });
    utterances[0].onend?.();

    await expect(playback).resolves.toEqual({ status: "completed" });
  });

  it("reports failure when neither the bundled file nor browser speech can play", async () => {
    const { utterances } = playbackEnvironment();
    const playback = playTextAudio({
      text: "Bonjour",
      language: "fr-FR",
      audioSource: "/audio/french/missing.mp3",
      owner: Symbol("test"),
    });

    MockAudio.instances[0].onerror?.();
    await vi.waitFor(() => expect(utterances).toHaveLength(1));
    utterances[0].onerror?.({ error: "synthesis-failed" });

    await expect(playback).resolves.toEqual({
      status: "failed",
      reason: "The bundled audio could not play and browser speech is unavailable.",
    });
  });

  it("cancels only the playback owned by an unmounting control", async () => {
    playbackEnvironment();
    const owner = Symbol("owner");
    const otherOwner = Symbol("other");
    const playback = playTextAudio({
      text: "Bonjour",
      language: "fr-FR",
      audioSource: "/audio/french/bonjour.mp3",
      owner,
    });

    stopTextAudio(otherOwner);
    expect(MockAudio.instances[0].pause).not.toHaveBeenCalled();
    stopTextAudio(owner);

    expect(MockAudio.instances[0].pause).toHaveBeenCalledTimes(1);
    await expect(playback).resolves.toEqual({ status: "cancelled" });
  });
});
