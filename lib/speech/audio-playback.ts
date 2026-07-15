"use client";

import {
  speakText,
  speechSupport,
  stopSpeaking,
  type SpeechPlaybackOutcome,
} from "@/lib/speech/browser-speech";

type PlaybackOwner = symbol;

let activeOwner: PlaybackOwner | undefined;
let activeAudio:
  | {
      element: HTMLAudioElement;
      settle: (outcome: SpeechPlaybackOutcome) => void;
    }
  | undefined;

export function mediaAudioSupport() {
  return typeof window !== "undefined" && typeof window.Audio === "function";
}

function stopActiveMedia(outcome: SpeechPlaybackOutcome = { status: "cancelled" }) {
  const playback = activeAudio;
  if (!playback) return;
  activeAudio = undefined;
  playback.element.pause();
  try {
    playback.element.currentTime = 0;
  } catch {
    // Some browser media implementations reject seeking before metadata loads.
  }
  playback.settle(outcome);
}

function playBundledAudio(source: string, rate: number): Promise<SpeechPlaybackOutcome> {
  if (!mediaAudioSupport() || !source) return Promise.resolve({ status: "unavailable" });

  return new Promise((resolve) => {
    const audio = new window.Audio(source);
    audio.preload = "auto";
    audio.playbackRate = rate;
    audio.defaultPlaybackRate = rate;
    audio.preservesPitch = true;

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      settle({ status: "failed", reason: "The bundled audio took too long to play." });
    }, 30_000);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      audio.onended = null;
      audio.onerror = null;
      audio.onabort = null;
      if (activeAudio?.element === audio) activeAudio = undefined;
    };
    const settle = (outcome: SpeechPlaybackOutcome) => {
      if (settled) return;
      settled = true;
      if (outcome.status === "failed") audio.pause();
      cleanup();
      resolve(outcome);
    };

    activeAudio = { element: audio, settle };
    audio.onended = () => settle({ status: "completed" });
    audio.onabort = () => settle({ status: "cancelled" });
    audio.onerror = () => settle({ status: "failed", reason: "The bundled audio file could not be played." });

    try {
      void Promise.resolve(audio.play()).catch(() => {
        settle({ status: "failed", reason: "The bundled audio file could not be played." });
      });
    } catch {
      settle({ status: "failed", reason: "The bundled audio file could not be played." });
    }
  });
}

export function stopTextAudio(owner?: PlaybackOwner) {
  if (owner && activeOwner !== owner) return;
  activeOwner = undefined;
  stopActiveMedia();
  stopSpeaking();
}

export function canPlayTextAudio(audioSource?: string) {
  return Boolean(audioSource && mediaAudioSupport()) || speechSupport().canSpeak;
}

export async function playTextAudio({
  text,
  language,
  rate = 0.9,
  audioSource,
  owner,
}: {
  text: string;
  language: string;
  rate?: number;
  audioSource?: string;
  owner: PlaybackOwner;
}): Promise<SpeechPlaybackOutcome> {
  stopTextAudio();
  activeOwner = owner;

  let bundledFailure: SpeechPlaybackOutcome | undefined;
  if (audioSource) {
    const bundledOutcome = await playBundledAudio(audioSource, rate);
    if (activeOwner !== owner) return { status: "cancelled" };
    if (bundledOutcome.status === "completed" || bundledOutcome.status === "cancelled") {
      activeOwner = undefined;
      return bundledOutcome;
    }
    bundledFailure = bundledOutcome;
  }

  const browserOutcome = await speakText(text, { language, rate });
  if (activeOwner !== owner) return { status: "cancelled" };
  activeOwner = undefined;

  if (
    bundledFailure?.status === "failed" &&
    (browserOutcome.status === "failed" || browserOutcome.status === "unavailable")
  ) {
    return {
      status: "failed",
      reason: "The bundled audio could not play and browser speech is unavailable.",
    };
  }
  return browserOutcome;
}
