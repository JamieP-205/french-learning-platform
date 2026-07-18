"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SocialSnapshot } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";
import { formatFriendCode } from "@/lib/social/friend-code";

type SocialAction =
  | { action: "rotate_code"; requestId?: string }
  | { action: "send_request"; friendCode: string }
  | { action: "respond_request"; requestId: string; decision: "accepted" | "declined" }
  | { action: "block"; targetUserId: string; requestId?: string }
  | { action: "unblock"; targetUserId: string; requestId?: string }
  | { action: "report"; targetUserId: string; reason: ReportReason; details?: string; requestId?: string }
  | { action: "start_challenge"; friendUserId: string };

type ReportReason = "spam" | "harassment" | "unsafe_content" | "other";

function SocialReportForm({
  displayName,
  busy,
  reason,
  details,
  onReasonChange,
  onDetailsChange,
  onSubmit,
}: {
  displayName: string;
  busy: boolean;
  reason: ReportReason;
  details: string;
  onReasonChange: (reason: ReportReason) => void;
  onDetailsChange: (details: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-4 rounded-2xl border border-coral/20 bg-white/70 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="font-black">Report {displayName}</p>
      <p className="mt-1 text-sm text-ink/70">Reports are private and do not notify the other learner.</p>
      <label className="mt-3 block text-sm font-bold">
        Reason
        <select className="field" value={reason} onChange={(event) => onReasonChange(event.target.value as ReportReason)}>
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="unsafe_content">Unsafe content</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="mt-3 block text-sm font-bold">
        Details (optional)
        <textarea
          className="field min-h-24"
          maxLength={500}
          value={details}
          onChange={(event) => onDetailsChange(event.target.value)}
          placeholder="Share only what is needed to review the report."
        />
      </label>
      <button className="button-primary mt-3" disabled={busy}>
        {busy ? "Sending report..." : "Send report"}
      </button>
    </form>
  );
}

export default function FriendsPage() {
  const [social, setSocial] = useState<SocialSnapshot>();
  const [friendCode, setFriendCode] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [reportingUserId, setReportingUserId] = useState<string>();
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const retryRequestIds = useRef(new Map<string, string>());

  async function loadSocial() {
    setLoading(true);
    setError(undefined);
    try {
      const accessToken = await getBrowserAccessToken();
      if (!accessToken && getBrowserSupabase()) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/social", { headers: await getBrowserAuthHeaders() });
      const payload = await response.json();
      if (!response.ok) setError(payload.error ?? "Friends could not load.");
      else setSocial(payload.social);
    } catch {
      setError("Friends could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(key: string, action: SocialAction) {
    setBusy(key);
    setError(undefined);
    const needsIdempotencyKey =
      action.action === "rotate_code" ||
      action.action === "report" ||
      action.action === "block" ||
      action.action === "unblock";
    const requestId = needsIdempotencyKey
      ? retryRequestIds.current.get(key) ?? crypto.randomUUID()
      : undefined;
    if (requestId) retryRequestIds.current.set(key, requestId);
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify(requestId ? { ...action, requestId } : action),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          retryRequestIds.current.delete(key);
        }
        setError(payload.error ?? "That social action failed.");
      } else {
        retryRequestIds.current.delete(key);
        setSocial(payload.social);
        if (action.action === "send_request") setFriendCode("");
        if (action.action === "report") {
          setReportingUserId(undefined);
          setReportReason("spam");
          setReportDetails("");
        }
      }
    } catch {
      setError("That social action failed.");
    } finally {
      setBusy(undefined);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSocial();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const signedOut = !loading && !social && !error && getBrowserSupabase();

  return (
    <AppShell>
      <main className="py-10">
        <p className="eyebrow">Friends</p>
        <h1 className="mt-2 text-4xl font-black">Learn beside someone, without turning French into a leaderboard.</h1>
        <p className="mt-4 max-w-3xl text-ink/75">
          Add trusted friends, start a small co-op challenge, and keep safety controls close. Friends see session totals
          and streaks, never private answers or mistakes.
        </p>

        {loading && <div className="card mt-7 animate-pulse">Loading your friend space...</div>}
        {error && <p className="status-error mt-7" role="alert">{error}</p>}
        {signedOut && (
          <section className="card mt-7">
            <h2 className="text-2xl font-black">Sign in to use friends</h2>
            <p className="mt-3 text-ink/75">Friend codes and co-op challenges need an account so learners can control who sees them.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="button-primary" href="/auth/sign-in?redirectTo=/friends">Sign in</Link>
              <Link className="button-secondary" href="/demo">Use no-account demo</Link>
            </div>
          </section>
        )}

        {social && (
          <>
            <section className="card mt-7">
              <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <p className="eyebrow">Your friend code</p>
                  <h2 className="mt-2 break-words text-xl font-black tracking-wide sm:text-2xl">{formatFriendCode(social.friendCode)}</h2>
                  <p className="mt-3 text-sm text-ink/70">
                    Share this only with people you trust. They can send a request, and you approve before anything connects.
                  </p>
                  <button
                    className="mt-3 min-h-11 text-sm font-bold text-coral underline decoration-2 underline-offset-4 disabled:opacity-60"
                    type="button"
                    disabled={busy === "rotate-code"}
                    onClick={() => {
                      if (window.confirm("Replace your friend code? Your old code will stop working immediately.")) {
                        void runAction("rotate-code", { action: "rotate_code" });
                      }
                    }}
                  >
                    {busy === "rotate-code" ? "Replacing code..." : "Replace this code"}
                  </button>
                </div>
                <form
                  className="rounded-2xl bg-cream p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (friendCode.trim()) void runAction("send", { action: "send_request", friendCode });
                  }}
                >
                  <label className="block font-bold">
                    Add by friend code
                    <input
                      className="field"
                      value={friendCode}
                      onChange={(event) => setFriendCode(event.target.value)}
                      placeholder="FR-1234-ABCD-5678-EF90-1234"
                      maxLength={32}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <button className="button-primary mt-4" disabled={busy === "send" || !friendCode.trim()}>
                    {busy === "send" ? "Sending..." : "Send request"}
                  </button>
                </form>
              </div>
            </section>

            {social.activeChallenge && (
              <section className="card mt-6 bg-moss/10">
                <p className="eyebrow">{social.activeChallenge.status === "completed" ? "Challenge complete" : "Co-op challenge"}</p>
                <h2 className="mt-2 text-2xl font-black">{social.activeChallenge.title}</h2>
                <p className="mt-2 text-ink/75">{social.activeChallenge.description}</p>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/70" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-moss transition-[width]"
                    style={{ width: `${Math.min(100, Math.round((social.activeChallenge.combinedProgress / social.activeChallenge.targetSessions) * 100))}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-bold text-ink/75">
                  Together: {Math.min(social.activeChallenge.combinedProgress, social.activeChallenge.targetSessions)} of {social.activeChallenge.targetSessions} sessions
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="eyebrow">You</p>
                    <p className="mt-1 text-2xl font-black">{social.activeChallenge.yourProgress} sessions</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="eyebrow">{social.activeChallenge.friend.displayName}</p>
                    <p className="mt-1 text-2xl font-black">{social.activeChallenge.friendProgress} sessions</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="eyebrow">Status</p>
                    <p className="mt-1 text-2xl font-black">{social.activeChallenge.status === "completed" ? "Completed" : "Active"}</p>
                  </div>
                </div>
              </section>
            )}

            {social.incomingRequests.length > 0 && (
              <section className="card mt-6">
                <p className="eyebrow">Requests</p>
                <h2 className="mt-2 text-2xl font-black">Approve who joins your learning circle.</h2>
                <div className="mt-5 grid gap-3">
                  {social.incomingRequests.map((request) => (
                    <article key={request.id} className="rounded-2xl bg-cream p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-black">{request.from.displayName}</h3>
                          <p className="text-sm text-ink/70">Sent you a private friend request.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="button-primary" disabled={busy === request.id} onClick={() => runAction(request.id, { action: "respond_request", requestId: request.id, decision: "accepted" })}>
                            Accept
                          </button>
                          <button className="button-secondary" disabled={busy === request.id} onClick={() => runAction(request.id, { action: "respond_request", requestId: request.id, decision: "declined" })}>
                            Decline
                          </button>
                          <button
                            className="button-secondary"
                            type="button"
                            disabled={busy === `report-${request.from.userId}`}
                            aria-expanded={reportingUserId === request.from.userId}
                            onClick={() => {
                              if (reportingUserId === request.from.userId) {
                                setReportingUserId(undefined);
                              } else {
                                setReportingUserId(request.from.userId);
                                setReportReason("spam");
                                setReportDetails("");
                              }
                            }}
                          >
                            {reportingUserId === request.from.userId ? "Cancel report" : "Report"}
                          </button>
                          <button
                            className="button-secondary"
                            type="button"
                            disabled={busy === `block-${request.from.userId}`}
                            onClick={() => {
                              if (window.confirm(`Block ${request.from.displayName}? This removes the request and stops new requests or challenges. You can undo this under Blocked learners.`)) {
                                void runAction(`block-${request.from.userId}`, { action: "block", targetUserId: request.from.userId });
                              }
                            }}
                          >
                            Block
                          </button>
                        </div>
                      </div>
                      {reportingUserId === request.from.userId && (
                        <SocialReportForm
                          displayName={request.from.displayName}
                          busy={busy === `report-${request.from.userId}`}
                          reason={reportReason}
                          details={reportDetails}
                          onReasonChange={setReportReason}
                          onDetailsChange={setReportDetails}
                          onSubmit={() => {
                            void runAction(`report-${request.from.userId}`, {
                              action: "report",
                              targetUserId: request.from.userId,
                              reason: reportReason,
                              ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
                            });
                          }}
                        />
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="card mt-6">
              <p className="eyebrow">Your friends</p>
              <h2 className="mt-2 text-2xl font-black">{social.friends.length ? "Small circle, shared momentum." : "No friends added yet."}</h2>
              {social.friends.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {social.friends.map((connection) => (
                    <article key={connection.id} className="rounded-2xl bg-cream p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{connection.friend.displayName}</h3>
                          <p className="mt-1 text-sm text-ink/70">
                            {connection.friend.completedSessions} sessions, {connection.friend.currentStreak}-day streak
                          </p>
                        </div>
                        <span className="rounded-full bg-moss/15 px-3 py-1 text-xs font-black">{connection.friend.currentLevel}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button className="button-primary" disabled={social.activeChallenge?.status === "active" || busy === `challenge-${connection.friend.userId}`} onClick={() => runAction(`challenge-${connection.friend.userId}`, { action: "start_challenge", friendUserId: connection.friend.userId })}>
                          Start co-op
                        </button>
                        <button
                          className="button-secondary"
                          type="button"
                          disabled={busy === `report-${connection.friend.userId}`}
                          aria-expanded={reportingUserId === connection.friend.userId}
                          onClick={() => {
                            if (reportingUserId === connection.friend.userId) {
                              setReportingUserId(undefined);
                            } else {
                              setReportingUserId(connection.friend.userId);
                              setReportReason("spam");
                              setReportDetails("");
                            }
                          }}
                        >
                          {reportingUserId === connection.friend.userId ? "Cancel report" : "Report"}
                        </button>
                        <button
                          className="button-secondary"
                          type="button"
                          disabled={busy === `block-${connection.friend.userId}`}
                          onClick={() => {
                            if (window.confirm(`Block ${connection.friend.displayName}? This removes the friendship and stops new requests or challenges. You can undo this under Blocked learners.`)) {
                              void runAction(`block-${connection.friend.userId}`, { action: "block", targetUserId: connection.friend.userId });
                            }
                          }}
                        >
                          Block
                        </button>
                      </div>
                      {reportingUserId === connection.friend.userId && (
                        <SocialReportForm
                          displayName={connection.friend.displayName}
                          busy={busy === `report-${connection.friend.userId}`}
                          reason={reportReason}
                          details={reportDetails}
                          onReasonChange={setReportReason}
                          onDetailsChange={setReportDetails}
                          onSubmit={() => {
                            void runAction(`report-${connection.friend.userId}`, {
                              action: "report",
                              targetUserId: connection.friend.userId,
                              reason: reportReason,
                              ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
                            });
                          }}
                        />
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-cream p-4 text-ink/75">
                  Start with one trusted person. Nothing connects until you accept a request.
                </p>
              )}
            </section>

            {social.blockedUsers.length > 0 && (
              <section className="card mt-6">
                <p className="eyebrow">Blocked learners</p>
                <h2 className="mt-2 text-2xl font-black">People who cannot contact you here.</h2>
                <p className="mt-3 text-sm text-ink/70">
                  Unblocking does not restore a friendship. It allows that learner to send a new request if they have your current friend code.
                </p>
                <ul className="mt-5 grid gap-3 md:grid-cols-2">
                  {social.blockedUsers.map((blockedUser) => (
                    <li
                      key={blockedUser.userId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream p-4"
                    >
                      <span className="font-black">{blockedUser.displayName}</span>
                      <button
                        className="button-secondary"
                        type="button"
                        disabled={busy === `unblock-${blockedUser.userId}`}
                        onClick={() => {
                          if (window.confirm(`Unblock ${blockedUser.displayName}? They will not be added back as a friend.`)) {
                            void runAction(`unblock-${blockedUser.userId}`, {
                              action: "unblock",
                              targetUserId: blockedUser.userId,
                            });
                          }
                        }}
                      >
                        {busy === `unblock-${blockedUser.userId}` ? "Unblocking..." : "Unblock"}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {social.outgoingRequests.length > 0 && (
              <section className="card mt-6">
                <p className="eyebrow">Sent requests</p>
                <ul className="mt-4 space-y-3">
                  {social.outgoingRequests.map((request) => (
                    <li key={request.id} className="rounded-2xl bg-cream p-4 font-bold">
                      Waiting for {request.to.displayName}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}
