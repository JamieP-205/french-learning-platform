"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getBrowserAuthHeaders } from "@/lib/auth/browser";

type Message = { kind: "success" | "error"; text: string; reauth?: boolean };

export default function PrivacyPage() {
  const [message, setMessage] = useState<Message>();
  const [confirming, setConfirming] = useState(false);
  const [busyAction, setBusyAction] = useState<"export" | "delete">();

  async function exportData() {
    setBusyAction("export");
    setMessage(undefined);

    try {
      const response = await fetch("/api/privacy/export", {
        method: "POST",
        headers: await getBrowserAuthHeaders(),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setMessage({
          kind: "error",
          text: payload.error ?? "Your export could not be prepared. Check your connection and try again.",
          reauth: response.status === 401 || response.status === 403,
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "learning-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage({ kind: "success", text: "Your learning-data export is ready." });
    } catch {
      setMessage({ kind: "error", text: "Your export could not be prepared. Check your connection and try again." });
    } finally {
      setBusyAction(undefined);
    }
  }

  async function deleteData() {
    setBusyAction("delete");
    setMessage(undefined);

    try {
      const response = await fetch("/api/privacy/delete", {
        method: "POST",
        headers: await getBrowserAuthHeaders(),
      });
      const payload = response.ok ? undefined : await response.json().catch(() => ({}));
      setMessage(response.ok
        ? {
            kind: "success",
            text: "Your learner data has been deleted. Limited block or report records may be kept for safety and abuse prevention.",
          }
        : {
            kind: "error",
            text: payload?.error ?? "Deletion could not be completed. Check your connection and try again.",
            reauth: response.status === 401 || response.status === 403,
          });
      if (response.ok) setConfirming(false);
    } catch {
      setMessage({ kind: "error", text: "Deletion could not be completed. Check your connection and try again." });
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Privacy centre</p>
        <h1 className="mt-2 text-4xl font-black">Clear choices about your learning data.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Learning without an account does not create a profile. Your progress, preferences, and review reminders are
          saved only in this browser&apos;s local storage on this device. Account-based learning stores the minimum data
          needed for progress, review, tutor safety, and optional social features.
        </p>

        <section className="card mt-7 max-w-3xl space-y-6">
          <div>
            <h2 className="font-black">No-account demo</h2>
            <p className="mt-2 text-ink/70">
              The public lessons use reviewed content and do not call the AI tutor. Attempts, mistakes, preferences,
              and review reminders can be saved in local storage so you can continue on this device. They are not sent
              to our server. You can export or reset them from Settings, and clearing this site&apos;s browser data also
              removes them.
            </p>
          </div>

          <div>
            <h2 className="font-black">What we store for learning</h2>
            <p className="mt-2 text-ink/70">
              Profile preferences, required consents, attempts, mistakes, review timing, streak state, friend-code
              social records, co-op challenges, and concise tutor safety logs. Voice recordings are not stored.
            </p>
          </div>

          <div>
            <h2 className="font-black">What we do not do</h2>
            <p className="mt-2 text-ink/70">
              We do not rely on a model to remember you, sell your learning history, store speech recordings, or use
              generated content as official course content.
            </p>
          </div>

          <div>
            <h2 className="font-black">AI tutor notice</h2>
            <p className="mt-2 text-ink/70">
              If enabled for an account session, tutor requests include only what is needed to help with the current
              activity: the question, your submitted answer, the checked result, relevant reviewed notes, and safety rules.
              Account, session, and attempt identifiers are not sent. Generative explanations are disabled by default;
              if enabled after review, the request opts out of provider response storage, although limited provider
              security and abuse-monitoring retention may still apply under the approved service terms.
            </p>
          </div>

          <div>
            <h2 className="font-black">Age and consent</h2>
            <p className="mt-2 text-ink/70">
              Onboarding requires a 13+ self-declaration and required policy consents. Before a broad public launch,
              the consent language, retention approach, support process, and youth safeguards still need formal approval.
            </p>
          </div>

          <div>
            <h2 className="font-black">Deletion and safety records</h2>
            <p className="mt-2 text-ink/70">
              Deleting learner data removes the profile and learning history connected to your account. Limited block
              or report records may be retained to protect other learners, prevent abuse, and preserve the integrity of
              safety investigations. Access to those records is restricted. Your sign-in remains active; you can create
              a fresh learner profile later or manage the sign-in itself through the account provider.
            </p>
            <p className="mt-2 text-ink/70">
              Rate-limit and abuse-prevention events may remain for up to eight days before they are removed.
            </p>
            <p className="mt-2 text-ink/70">
              If you are an authorised content editor, restricted attribution remains with the version history needed
              to audit published lessons. It is not shown to learners and is anonymised if the sign-in account is deleted.
            </p>
          </div>

          <div>
            <h2 className="font-black">Account data controls</h2>
            <p className="mt-2 text-ink/70">
              The controls below apply to signed-in account data. To export or clear progress saved only in this browser,
              use the browser progress controls in{" "}
              <Link className="font-bold underline" href="/settings">Settings</Link>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="button-secondary" type="button" onClick={exportData} disabled={busyAction !== undefined}>
              {busyAction === "export" ? "Preparing export..." : "Export my data"}
            </button>
            {confirming ? (
              <>
                <p className="status-coaching w-full" role="alert">
                  This removes your learner profile and account learning history, not the sign-in itself. It cannot be undone.
                  Limited safety records may be retained.
                </p>
                <button
                  className="button-primary bg-coral hover:bg-coral/90"
                  type="button"
                  onClick={deleteData}
                  disabled={busyAction !== undefined}
                >
                  {busyAction === "delete" ? "Deleting..." : "Yes, delete my learner data"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busyAction !== undefined}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button className="button-secondary" type="button" onClick={() => setConfirming(true)}>
                Delete my learner data
              </button>
            )}
            <Link className="button-secondary" href="/terms">
              Terms and safety
            </Link>
          </div>

          {message && (
            <div className={message.kind === "success" ? "status-success" : "status-error"}>
              <p role={message.kind === "success" ? "status" : "alert"}>{message.text}</p>
              {message.reauth && (
                <Link
                  className="mt-3 inline-block font-black underline decoration-2 underline-offset-4"
                  href="/auth/sign-in?reauth=1&redirectTo=/privacy"
                >
                  Sign in again
                </Link>
              )}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
