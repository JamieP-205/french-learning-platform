"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SocialSnapshot } from "@/lib/domain/types";
import { AppShell } from "@/components/app-shell";
import { getBrowserAccessToken, getBrowserAuthHeaders, getBrowserSupabase } from "@/lib/auth/browser";

type SocialAction =
  | { action: "send_request"; friendCode: string }
  | { action: "respond_request"; requestId: string; decision: "accepted" | "declined" }
  | { action: "block"; targetUserId: string }
  | { action: "report"; targetUserId: string; reason: "spam" | "harassment" | "unsafe_content" | "other"; details?: string }
  | { action: "start_challenge"; friendUserId: string };

export default function FriendsPage() {
  const [social, setSocial] = useState<SocialSnapshot>();
  const [friendCode, setFriendCode] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();

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
    try {
      const response = await fetch("/api/social", {
        method: "POST",
        headers: await getBrowserAuthHeaders({ json: true }),
        body: JSON.stringify(action),
      });
      const payload = await response.json();
      if (!response.ok) setError(payload.error ?? "That social action failed.");
      else {
        setSocial(payload.social);
        if (action.action === "send_request") setFriendCode("");
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
          Add trusted friends, start a small co-op challenge, and keep safety controls close. Friends see habit signals,
          not private answers or mistakes.
        </p>

        {loading && <div className="card mt-7 animate-pulse">Loading your friend space...</div>}
        {error && <p className="status-error mt-7">{error}</p>}
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
                  <h2 className="mt-2 text-3xl font-black tracking-wide">{social.friendCode}</h2>
                  <p className="mt-3 text-sm text-ink/70">
                    Share this only with people you trust. They can send a request, and you approve before anything connects.
                  </p>
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
                    <input className="field" value={friendCode} onChange={(event) => setFriendCode(event.target.value)} placeholder="FRABC12345" />
                  </label>
                  <button className="button-primary mt-4" disabled={busy === "send" || !friendCode.trim()}>
                    {busy === "send" ? "Sending..." : "Send request"}
                  </button>
                </form>
              </div>
            </section>

            {social.activeChallenge && (
              <section className="card mt-6 bg-moss/10">
                <p className="eyebrow">Co-op challenge</p>
                <h2 className="mt-2 text-2xl font-black">{social.activeChallenge.title}</h2>
                <p className="mt-2 text-ink/75">{social.activeChallenge.description}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="eyebrow">Target</p>
                    <p className="mt-1 text-2xl font-black">{social.activeChallenge.targetSessions} sessions</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="eyebrow">Friend</p>
                    <p className="mt-1 text-2xl font-black">{social.activeChallenge.friend.displayName}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-4">
                    <p className="eyebrow">Status</p>
                    <p className="mt-1 text-2xl font-black">Active</p>
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
                          <p className="text-sm text-ink/70">
                            {request.from.currentLevel} learner, {request.from.currentStreak}-day streak
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button className="button-primary" disabled={busy === request.id} onClick={() => runAction(request.id, { action: "respond_request", requestId: request.id, decision: "accepted" })}>
                            Accept
                          </button>
                          <button className="button-secondary" disabled={busy === request.id} onClick={() => runAction(request.id, { action: "respond_request", requestId: request.id, decision: "declined" })}>
                            Decline
                          </button>
                        </div>
                      </div>
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
                        <button className="button-primary" disabled={Boolean(social.activeChallenge) || busy === `challenge-${connection.friend.userId}`} onClick={() => runAction(`challenge-${connection.friend.userId}`, { action: "start_challenge", friendUserId: connection.friend.userId })}>
                          Start co-op
                        </button>
                        <button className="button-secondary" disabled={busy === `report-${connection.friend.userId}`} onClick={() => runAction(`report-${connection.friend.userId}`, { action: "report", targetUserId: connection.friend.userId, reason: "other", details: "Learner reported from the friends page." })}>
                          Report
                        </button>
                        <button className="button-secondary" disabled={busy === `block-${connection.friend.userId}`} onClick={() => runAction(`block-${connection.friend.userId}`, { action: "block", targetUserId: connection.friend.userId })}>
                          Block
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-cream p-4 text-ink/75">
                  Add one trusted person by code. This is deliberately small and private for the public launch.
                </p>
              )}
            </section>

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
