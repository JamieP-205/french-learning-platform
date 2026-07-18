"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";

export function ScoredMissionStartButton({
  missionSlug,
  label = "Start full lesson",
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
  const requestId = useRef<string | undefined>(undefined);

  async function startMission() {
    setStarting(true);
    setError(undefined);
    requestId.current ??= crypto.randomUUID();

    try {
      const headers = await getBrowserAuthHeaders({ json: true });
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers,
        body: JSON.stringify({ requestId: requestId.current, missionSlug, mode }),
      });
      const payload = (await response.json().catch(() => undefined)) as
        | { error?: string; session?: { id?: string } }
        | undefined;

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/auth/sign-in?redirectTo=${encodeURIComponent(pathname)}`);
          return;
        }

        if (response.status === 409) {
          router.push("/onboarding");
          return;
        }

        setError(payload?.error ?? "We couldn’t start this lesson. Check your connection and try again.");
        return;
      }

      if (!payload?.session?.id) {
        throw new Error("Missing session details");
      }

      router.push(`/lesson/${payload.session.id}`);
    } catch {
      setError("We couldn’t start this lesson. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <button className={className} type="button" disabled={starting} onClick={startMission}>
        {starting ? "Starting..." : error ? "Try again" : label}
      </button>

      {error && (
        <p className="status-error mt-3" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
