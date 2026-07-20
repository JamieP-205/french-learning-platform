"use client";

import { useEffect, useRef, useState } from "react";
import {
  canPlayTextAudio,
  playTextAudio,
  stopTextAudio,
} from "@/lib/speech/audio-playback";
import type { SpeechPlaybackOutcome } from "@/lib/speech/browser-speech";

type PlaybackState = "checking" | "idle" | "playing" | "completed" | "error";

export function SpeechPlaybackButton({
  text,
  language = "fr-FR",
  rate = 1,
  label,
  replayLabel = "Play again",
  audioSource,
  labelLanguage,
  className = "button-secondary",
  disabled = false,
  showUnavailableMessage = true,
  onOutcome,
}: {
  text: string;
  language?: string;
  rate?: number;
  label: string;
  replayLabel?: string;
  audioSource?: string;
  labelLanguage?: string;
  className?: string;
  disabled?: boolean;
  showUnavailableMessage?: boolean;
  onOutcome?: (outcome: SpeechPlaybackOutcome) => void;
}) {
  const [supported, setSupported] = useState<boolean>();
  const [state, setState] = useState<PlaybackState>("checking");
  const [error, setError] = useState<string>();
  const owner = useRef(Symbol("speech-playback-button"));
  const mounted = useRef(false);

  useEffect(() => {
    const playbackOwner = owner.current;
    mounted.current = true;
    const timeoutId = window.setTimeout(() => {
      const canPlay = canPlayTextAudio(audioSource);
      setSupported(canPlay);
      setState(canPlay ? "idle" : "error");
    }, 0);
    return () => {
      mounted.current = false;
      window.clearTimeout(timeoutId);
      stopTextAudio(playbackOwner);
    };
  }, [audioSource]);

  async function play() {
    setState("playing");
    setError(undefined);
    const outcome = await playTextAudio({
      text,
      language,
      rate,
      audioSource,
      owner: owner.current,
    });
    if (!mounted.current) return;
    onOutcome?.(outcome);
    if (outcome.status === "completed") {
      setState("completed");
      return;
    }
    if (outcome.status === "cancelled") {
      setState("idle");
      return;
    }
    setState("error");
    setError(
      outcome.status === "unavailable"
        ? "Audio playback is not available in this browser or device."
        : `${outcome.reason} Check that this tab is not muted, then try again.`,
    );
  }

  if (supported === false) {
    return showUnavailableMessage ? (
      <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink/75" role="status">
        Audio playback is not available in this browser or device.
      </p>
    ) : null;
  }

  const buttonLabel =
    state === "checking"
      ? "Checking audio…"
      : state === "playing"
        ? "Playing…"
        : state === "completed"
          ? replayLabel
          : state === "error"
            ? `Try again: ${label}`
            : label;
  const languageTaggedLabel = (value: string) =>
    labelLanguage ? <span lang={labelLanguage}>{value}</span> : value;
  const buttonContent =
    state === "idle"
      ? languageTaggedLabel(label)
      : state === "completed" && labelLanguage
        ? <>{languageTaggedLabel(replayLabel)}<span className="sr-only">, play again</span></>
        : state === "error" && labelLanguage
          ? <>Try again: {languageTaggedLabel(label)}</>
          : buttonLabel;

  return (
    <div>
      <button
        type="button"
        className={`${className} min-h-11 min-w-11`}
        disabled={disabled || state === "checking" || state === "playing"}
        data-playback-state={state}
        data-audio-source={audioSource}
        onClick={play}
      >
        {buttonContent}
      </button>
      {error && (
        <p className="mt-2 max-w-md text-sm font-bold text-coral" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
