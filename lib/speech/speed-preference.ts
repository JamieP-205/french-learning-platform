"use client";

import { useSyncExternalStore } from "react";
import { FRENCH_RATE_NORMAL, FRENCH_RATE_SLOW } from "@/lib/speech/speech-rates";

// The learner's chosen audio speed, readable synchronously by any playback
// component. Settings screens write it (and persist it to the profile or the
// local-mode preferences); playback buttons only ever read it.

export type SpeechSpeed = "normal" | "slow";

const STORAGE_KEY = "french-for-life:speech-speed:v1";
const UPDATED_EVENT = "french-for-life:speech-speed-updated";

export function getStoredSpeechSpeed(): SpeechSpeed {
  if (typeof window === "undefined") return "normal";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "slow" ? "slow" : "normal";
  } catch {
    return "normal";
  }
}

export function setStoredSpeechSpeed(speed: SpeechSpeed) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, speed);
  } catch {
    // Private browsing can refuse storage; the in-page event still updates
    // every open playback control.
  }
  window.dispatchEvent(new Event(UPDATED_EVENT));
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(UPDATED_EVENT, onStoreChange);
  };
}

export function useSpeechSpeed(): SpeechSpeed {
  return useSyncExternalStore(subscribe, getStoredSpeechSpeed, () => "normal");
}

// For code paths that receive the profile on load: adopt the account's saved
// speed without firing update events when nothing changed.
export function syncStoredSpeechSpeed(speed: SpeechSpeed | undefined) {
  if (!speed || speed === getStoredSpeechSpeed()) return;
  setStoredSpeechSpeed(speed);
}

export function frenchRateForSpeed(speed: SpeechSpeed) {
  return speed === "slow" ? FRENCH_RATE_SLOW : FRENCH_RATE_NORMAL;
}
