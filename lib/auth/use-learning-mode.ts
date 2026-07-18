"use client";

import { useEffect, useState } from "react";
import { localLearningStorageKey } from "@/lib/local-learning/progress";

export type LearningMode = "loading" | "local" | "account" | "unavailable";

export function useLearningMode() {
  const [mode, setMode] = useState<LearningMode>("loading");

  useEffect(() => {
    let cancelled = false;

    async function resolveMode() {
      try {
        const response = await fetch("/api/learning-mode", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || (payload.mode !== "local" && payload.mode !== "account")) {
          throw new Error("Invalid learning-mode response.");
        }

        // Browser-only journeys and account-backed test journeys share the
        // development server. Local evidence or an explicit local preview wins
        // there, while production account sessions always remain account mode.
        const localDevelopmentJourney = payload.developmentDemo && (
          new URLSearchParams(window.location.search).get("mode") === "local" ||
          window.localStorage.getItem(localLearningStorageKey) !== null
        );
        if (!cancelled) setMode(localDevelopmentJourney ? "local" : payload.mode);
      } catch {
        // Account-backed and device-only learning are deliberately separate.
        // An unknown mode must fail closed so a transient error cannot show or
        // mutate browser-only progress for a signed-in learner.
        if (!cancelled) setMode("unavailable");
      }
    }

    void resolveMode();
    return () => {
      cancelled = true;
    };
  }, []);

  return mode;
}
