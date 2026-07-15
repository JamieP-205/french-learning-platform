"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserAccessToken, getBrowserAuthHeaders } from "@/lib/auth/browser";

export function ScoredMissionStartButton({
  missionSlug,
  label = "Start scored mission",
  mode = "normal",
  className = "button-primary",
}: {
  missionSlug: string;
  label?: string;
  mode?: "normal" | "short";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  async function startMission() {
    setStarting(true);
    setError(undefined);

    const accessToken = await getBrowserAccessToken();
    const headers = await getBrowserAuthHeaders({ json: true });

    const response = await fetch("/api/session/start", {
      method: "POST",
      headers,
      body: JSON.stringify({ missionSlug, mode }),
    });

    const payload = await response.json().catch(() => ({
      error: "Response was not valid JSON.",
    }));

    setStarting(false);

    if (!response.ok) {
      if (response.status === 401 && !accessToken) {
        router.push(`/auth/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
        return;
      }

      if (response.status === 409) {
        router.push("/onboarding");
        return;
      }

      setError(payload.error ?? "This mission could not start yet. Try Today, or sign in again if your session expired.");
      return;
    }

    router.push(`/lesson/${payload.session.id}`);
  }

  return (
    <div>
      <button className={className} disabled={starting} onClick={startMission}>
        {starting ? "Starting..." : label}
      </button>

      {error && (
        <p className="status-error mt-3" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
